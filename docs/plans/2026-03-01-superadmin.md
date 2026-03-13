# Superadmin Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate `/superadmin` web panel to manage all tenant companies — create, list, reset passwords, delete — accessible only with a master password from `.env`.

**Architecture:** Backend adds a `/api/superadmin/*` route group protected by a separate JWT (signed with `SUPERADMIN_JWT_SECRET`). Frontend adds two completely separate pages (`/superadmin/login` and `/superadmin`) with their own auth context, isolated from the normal tenant auth. No DB user needed — superadmin password lives only in `.env`.

**Tech Stack:** Same as rest of project — Express + TypeScript backend, React + Shadcn/UI frontend, React Query for data fetching.

---

## Context

- **DB tables use snake_case** (not PascalCase): `companies`, `users`, `properties`, `units`, `tenants`, `contracts`, etc.
- **DB user:** `immo` (not `postgres`)
- **Backend patterns:** Routes → Controllers → Services → Prisma. Auth middleware in `src/middleware/`. Env config in `src/config/env.ts`.
- **Frontend patterns:** Pages in `src/pages/`. Contexts in `src/contexts/`. API client at `src/lib/api.ts`.
- **Existing env vars:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — we add `SUPERADMIN_SECRET` and `SUPERADMIN_JWT_SECRET`.
- **Existing auth middleware:** `src/middleware/auth.ts` — read this before writing `requireSuperAdmin`.

---

## Task 1: Backend — Env config + requireSuperAdmin middleware

**Files:**
- Modify: `backend/src/config/env.ts`
- Create: `backend/src/middleware/requireSuperAdmin.ts`

**Step 1: Read existing files**

Read `backend/src/config/env.ts` and `backend/src/middleware/auth.ts` to understand the patterns.

**Step 2: Add new env vars to env.ts**

In `env.ts`, add to the Zod schema and export:
```typescript
SUPERADMIN_SECRET: z.string().min(16),
SUPERADMIN_JWT_SECRET: z.string().min(32),
```

**Step 3: Create requireSuperAdmin.ts**

```typescript
// backend/src/middleware/requireSuperAdmin.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw new AppError(401, "Nicht autorisiert");
  const token = auth.slice(7);
  try {
    jwt.verify(token, env.SUPERADMIN_JWT_SECRET);
    next();
  } catch {
    throw new AppError(401, "Ungültiger Superadmin-Token");
  }
}
```

**Step 4: TypeScript check**
```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors from new files. If env.ts has errors because SUPERADMIN_SECRET/SUPERADMIN_JWT_SECRET are not set in .env, add them to `backend/.env`:
```
SUPERADMIN_SECRET=superadmin-geheimnis-min16zeichen
SUPERADMIN_JWT_SECRET=superadmin-jwt-secret-min32-zeichen-lang
```

**Step 5: Commit**
```bash
git add backend/src/config/env.ts backend/src/middleware/requireSuperAdmin.ts backend/.env
git commit -m "feat(superadmin): add env vars and requireSuperAdmin middleware"
```

---

## Task 2: Backend — Controller + Routes + Registration

**Files:**
- Create: `backend/src/controllers/superadmin.controller.ts`
- Create: `backend/src/routes/superadmin.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Read backend/src/routes/index.ts**

Understand how other routers are registered (e.g. importRouter pattern).

**Step 2: Create superadmin.controller.ts**

```typescript
// backend/src/controllers/superadmin.controller.ts
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function login(req: Request, res: Response): Promise<void> {
  const { password } = req.body as { password?: string };
  if (!password || password !== env.SUPERADMIN_SECRET) {
    throw new AppError(401, "Falsches Passwort");
  }
  const token = jwt.sign({ superadmin: true }, env.SUPERADMIN_JWT_SECRET, { expiresIn: "8h" });
  res.json({ data: { token } });
}

export async function getStats(req: Request, res: Response): Promise<void> {
  const [companies, users, properties, tenants, contracts] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.property.count(),
    prisma.tenant.count(),
    prisma.contract.count(),
  ]);
  res.json({ data: { companies, users, properties, tenants, contracts } });
}

export async function getCompanies(req: Request, res: Response): Promise<void> {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          properties: true,
          tenants: true,
          contracts: true,
        },
      },
    },
  });
  res.json({ data: companies });
}

export async function createCompany(req: Request, res: Response): Promise<void> {
  const { companyName, adminEmail, adminPassword, adminName } = req.body as {
    companyName: string;
    adminEmail: string;
    adminPassword: string;
    adminName?: string;
  };
  if (!companyName || !adminEmail || !adminPassword) {
    throw new AppError(400, "companyName, adminEmail und adminPassword sind Pflichtfelder");
  }
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const passwordHash = await bcrypt.hash(adminPassword, env.BCRYPT_COST ?? 12);

  const company = await prisma.$transaction(async (tx) => {
    const c = await tx.company.create({
      data: { name: companyName, slug, address: "", taxNumber: "" },
    });
    await tx.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminName ?? "Admin",
        role: "ADMIN",
        companyId: c.id,
      },
    });
    return c;
  });

  res.status(201).json({ data: { companyId: company.id, companyName, adminEmail } });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const companyId = Number(req.params.id);
  const { email, newPassword } = req.body as { email: string; newPassword: string };
  if (!email || !newPassword) throw new AppError(400, "email und newPassword erforderlich");

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_COST ?? 12);
  const updated = await prisma.user.updateMany({
    where: { email, companyId },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });
  if (updated.count === 0) throw new AppError(404, "User nicht gefunden");
  res.json({ data: { updated: updated.count } });
}

export async function deleteCompany(req: Request, res: Response): Promise<void> {
  const companyId = Number(req.params.id);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "Firma nicht gefunden");

  await prisma.$transaction(async (tx) => {
    // Delete in dependency order
    await tx.$executeRaw`DELETE FROM audit_logs WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM dunning_records WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM rent_payments WHERE contract_id IN (SELECT id FROM contracts WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM contracts WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM documents WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM document_templates WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM meter_readings WHERE meter_id IN (SELECT id FROM meters WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId}))`;
    await tx.$executeRaw`DELETE FROM meters WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM maintenance_tickets WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM maintenance_schedules WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM handover_protocols WHERE unit_id IN (SELECT id FROM units WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId}))`;
    await tx.$executeRaw`DELETE FROM units WHERE property_id IN (SELECT id FROM properties WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM properties WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM tenants WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM bank_transactions WHERE bank_account_id IN (SELECT id FROM bank_accounts WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM transactions WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM recurring_transactions WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM bank_accounts WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM calendar_events WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM email_attachments WHERE message_id IN (SELECT id FROM email_messages WHERE account_id IN (SELECT id FROM email_accounts WHERE company_id = ${companyId}))`;
    await tx.$executeRaw`DELETE FROM email_messages WHERE account_id IN (SELECT id FROM email_accounts WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM email_accounts WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM company_accounting_settings WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE company_id = ${companyId})`;
    await tx.$executeRaw`DELETE FROM users WHERE company_id = ${companyId}`;
    await tx.$executeRaw`DELETE FROM companies WHERE id = ${companyId}`;
  });

  res.json({ data: { deleted: company.name } });
}
```

**Step 3: Create superadmin.routes.ts**

```typescript
// backend/src/routes/superadmin.routes.ts
import { Router } from "express";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin.js";
import * as ctrl from "../controllers/superadmin.controller.js";

const router = Router();

router.post("/login", ctrl.login);
router.get("/stats", requireSuperAdmin, ctrl.getStats);
router.get("/companies", requireSuperAdmin, ctrl.getCompanies);
router.post("/companies", requireSuperAdmin, ctrl.createCompany);
router.post("/companies/:id/reset-password", requireSuperAdmin, ctrl.resetPassword);
router.delete("/companies/:id", requireSuperAdmin, ctrl.deleteCompany);

export { router as superadminRouter };
```

**Step 4: Register in index.ts**

Add import:
```typescript
import { superadminRouter } from "./superadmin.routes.js";
```

Add route (NO requireAuth/tenantGuard — superadmin has its own auth):
```typescript
router.use("/superadmin", superadminRouter);
```

**Step 5: TypeScript check**
```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Fix any errors. Common issues: `env.BCRYPT_COST` might be string — cast with `Number(env.BCRYPT_COST)`.

**Step 6: Commit**
```bash
git add backend/src/controllers/superadmin.controller.ts backend/src/routes/superadmin.routes.ts backend/src/routes/index.ts
git commit -m "feat(superadmin): add backend controller and routes"
```

---

## Task 3: Frontend — SuperAdminContext + API hook

**Files:**
- Create: `cozy-estate-central/src/contexts/SuperAdminContext.tsx`
- Create: `cozy-estate-central/src/hooks/api/useSuperAdmin.ts`

**Step 1: Read src/lib/api.ts**

Understand how the existing `api()` function works and what `ApiError` looks like.

**Step 2: Create SuperAdminContext.tsx**

```tsx
// cozy-estate-central/src/contexts/SuperAdminContext.tsx
import { createContext, useContext, useState, useEffect } from "react";

interface SuperAdminContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const SuperAdminContext = createContext<SuperAdminContextType | null>(null);
const STORAGE_KEY = "superadmin_token";

export function SuperAdminProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const login = (t: string) => {
    localStorage.setItem(STORAGE_KEY, t);
    setToken(t);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  };

  return (
    <SuperAdminContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdminAuth() {
  const ctx = useContext(SuperAdminContext);
  if (!ctx) throw new Error("useSuperAdminAuth must be used within SuperAdminProvider");
  return ctx;
}
```

**Step 3: Create useSuperAdmin.ts**

```typescript
// cozy-estate-central/src/hooks/api/useSuperAdmin.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/superadmin";

async function superadminFetch<T>(
  path: string,
  token: string | null,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Fehler");
  return json;
}

export function useSuperAdminStats(token: string | null) {
  return useQuery({
    queryKey: ["superadmin", "stats"],
    queryFn: () => superadminFetch<{ data: Record<string, number> }>("/stats", token),
    enabled: !!token,
  });
}

export function useSuperAdminCompanies(token: string | null) {
  return useQuery({
    queryKey: ["superadmin", "companies"],
    queryFn: () => superadminFetch<{ data: unknown[] }>("/companies", token),
    enabled: !!token,
  });
}

export function useSuperAdminLogin() {
  return useMutation({
    mutationFn: (password: string) =>
      superadminFetch<{ data: { token: string } }>("/login", null, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
  });
}

export function useCreateCompany(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { companyName: string; adminEmail: string; adminPassword: string; adminName?: string }) =>
      superadminFetch("/companies", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin"] }),
  });
}

export function useResetCompanyPassword(token: string | null) {
  return useMutation({
    mutationFn: ({ companyId, email, newPassword }: { companyId: number; email: string; newPassword: string }) =>
      superadminFetch(`/companies/${companyId}/reset-password`, token, {
        method: "POST",
        body: JSON.stringify({ email, newPassword }),
      }),
  });
}

export function useDeleteCompany(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: number) =>
      superadminFetch(`/companies/${companyId}`, token, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin"] }),
  });
}
```

**Step 4: TypeScript check**
```bash
cd cozy-estate-central && npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**
```bash
git add cozy-estate-central/src/contexts/SuperAdminContext.tsx cozy-estate-central/src/hooks/api/useSuperAdmin.ts
git commit -m "feat(superadmin): add SuperAdminContext and API hooks"
```

---

## Task 4: Frontend — SuperAdminLogin page

**Files:**
- Create: `cozy-estate-central/src/pages/SuperAdminLogin.tsx`

**Step 1: Create SuperAdminLogin.tsx**

```tsx
// cozy-estate-central/src/pages/SuperAdminLogin.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSuperAdminLogin } from "@/hooks/api/useSuperAdmin";
import { useSuperAdminAuth } from "@/contexts/SuperAdminContext";

export default function SuperAdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useSuperAdminAuth();
  const navigate = useNavigate();
  const mutation = useSuperAdminLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await mutation.mutateAsync(password);
      login(res.data.token);
      navigate("/superadmin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falsches Passwort");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm border border-border/60 shadow-sm">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl">Superadmin</CardTitle>
          <p className="text-sm text-muted-foreground">Nur für interne Verwaltung</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Master-Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Einloggen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: TypeScript check**
```bash
cd cozy-estate-central && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**
```bash
git add cozy-estate-central/src/pages/SuperAdminLogin.tsx
git commit -m "feat(superadmin): add SuperAdminLogin page"
```

---

## Task 5: Frontend — SuperAdmin Dashboard page

**Files:**
- Create: `cozy-estate-central/src/pages/SuperAdmin.tsx`

**Step 1: Create SuperAdmin.tsx**

```tsx
// cozy-estate-central/src/pages/SuperAdmin.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Home, FileText, LogOut, Plus, KeyRound, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSuperAdminAuth } from "@/contexts/SuperAdminContext";
import {
  useSuperAdminStats,
  useSuperAdminCompanies,
  useCreateCompany,
  useResetCompanyPassword,
  useDeleteCompany,
} from "@/hooks/api/useSuperAdmin";

interface Company {
  id: number;
  name: string;
  createdAt: string;
  _count: { users: number; properties: number; tenants: number; contracts: number };
}

export default function SuperAdmin() {
  const { token, logout } = useSuperAdminAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const stats = useSuperAdminStats(token);
  const companies = useSuperAdminCompanies(token);
  const createCompany = useCreateCompany(token);
  const resetPassword = useResetCompanyPassword(token);
  const deleteCompany = useDeleteCompany(token);

  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState<Company | null>(null);
  const [showDelete, setShowDelete] = useState<Company | null>(null);

  const [createForm, setCreateForm] = useState({ companyName: "", adminEmail: "", adminPassword: "", adminName: "" });
  const [resetForm, setResetForm] = useState({ email: "", newPassword: "" });

  const handleLogout = () => { logout(); navigate("/superadmin/login"); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCompany.mutateAsync(createForm);
      toast({ title: "Firma angelegt", description: `${createForm.companyName} wurde erstellt.` });
      setShowCreate(false);
      setCreateForm({ companyName: "", adminEmail: "", adminPassword: "", adminName: "" });
    } catch (err) {
      toast({ title: "Fehler", description: err instanceof Error ? err.message : "Fehler", variant: "destructive" });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReset) return;
    try {
      await resetPassword.mutateAsync({ companyId: showReset.id, ...resetForm });
      toast({ title: "Passwort zurückgesetzt" });
      setShowReset(null);
      setResetForm({ email: "", newPassword: "" });
    } catch (err) {
      toast({ title: "Fehler", description: err instanceof Error ? err.message : "Fehler", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    try {
      await deleteCompany.mutateAsync(showDelete.id);
      toast({ title: "Firma gelöscht", description: `${showDelete.name} wurde entfernt.` });
      setShowDelete(null);
    } catch (err) {
      toast({ title: "Fehler", description: err instanceof Error ? err.message : "Fehler", variant: "destructive" });
    }
  };

  const s = stats.data?.data;
  const list = (companies.data?.data ?? []) as Company[];

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="bg-card border-b border-border/60 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Superadmin</h1>
          <p className="text-xs text-muted-foreground">Kundenverwaltung</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
          <LogOut className="h-4 w-4" /> Abmelden
        </Button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Firmen", value: s?.companies, icon: Building2 },
            { label: "Benutzer", value: s?.users, icon: Users },
            { label: "Immobilien", value: s?.properties, icon: Home },
            { label: "Mieter", value: s?.tenants, icon: Users },
            { label: "Verträge", value: s?.contracts, icon: FileText },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border border-border/60">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-2xl font-semibold">{value ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Companies Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold">Alle Firmen</h2>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Neue Firma
            </Button>
          </div>
          <div className="rounded-md border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Firmenname</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Immobilien</TableHead>
                  <TableHead>Mieter</TableHead>
                  <TableHead>Verträge</TableHead>
                  <TableHead>Angelegt</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Firmen</TableCell></TableRow>
                )}
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground text-xs">{c.id}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c._count.users}</TableCell>
                    <TableCell>{c._count.properties}</TableCell>
                    <TableCell>{c._count.tenants}</TableCell>
                    <TableCell>{c._count.contracts}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("de-DE")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="Passwort zurücksetzen"
                          onClick={() => { setShowReset(c); setResetForm({ email: "", newPassword: "" }); }}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Firma löschen"
                          onClick={() => setShowDelete(c)}
                          className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      {/* Create Company Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Firma anlegen</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <Label>Firmenname</Label>
              <Input value={createForm.companyName} onChange={e => setCreateForm(f => ({ ...f, companyName: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Admin-E-Mail</Label>
              <Input type="email" value={createForm.adminEmail} onChange={e => setCreateForm(f => ({ ...f, adminEmail: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Admin-Passwort</Label>
              <Input type="text" value={createForm.adminPassword} onChange={e => setCreateForm(f => ({ ...f, adminPassword: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Admin-Name (optional)</Label>
              <Input value={createForm.adminName} onChange={e => setCreateForm(f => ({ ...f, adminName: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createCompany.isPending}>
                {createCompany.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Anlegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!showReset} onOpenChange={() => setShowReset(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Passwort zurücksetzen — {showReset?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleReset} className="space-y-3">
            <div className="space-y-1">
              <Label>User-E-Mail</Label>
              <Input type="email" value={resetForm.email} onChange={e => setResetForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Neues Passwort</Label>
              <Input type="text" value={resetForm.newPassword} onChange={e => setResetForm(f => ({ ...f, newPassword: e.target.value }))} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReset(null)}>Abbrechen</Button>
              <Button type="submit" disabled={resetPassword.isPending}>
                {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Zurücksetzen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Firma löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{showDelete?.name}</strong> und alle zugehörigen Daten werden unwiderruflich gelöscht.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCompany.isPending}>
              {deleteCompany.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: TypeScript check**
```bash
cd cozy-estate-central && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**
```bash
git add cozy-estate-central/src/pages/SuperAdmin.tsx
git commit -m "feat(superadmin): add SuperAdmin dashboard page"
```

---

## Task 6: Frontend — Routes registrieren + Provider einbinden

**Files:**
- Modify: `cozy-estate-central/src/App.tsx`
- Modify: `cozy-estate-central/src/main.tsx` (or wherever QueryClientProvider is)

**Step 1: Read App.tsx and main.tsx**

**Step 2: Modify App.tsx**

Add imports:
```tsx
import SuperAdminLogin from "./pages/SuperAdminLogin";
import SuperAdminDashboard from "./pages/SuperAdmin";
import { SuperAdminProvider } from "./contexts/SuperAdminContext";
import { useSuperAdminAuth } from "./contexts/SuperAdminContext";
```

Add a `SuperAdminGuard` component before the `App` function:
```tsx
function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSuperAdminAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAuthenticated) navigate("/superadmin/login");
  }, [isAuthenticated, navigate]);
  return isAuthenticated ? <>{children}</> : null;
}
```

Wrap the whole Router content in `<SuperAdminProvider>` (or just the superadmin routes).

Add routes outside the existing `ProtectedRoute` section:
```tsx
<Route path="/superadmin/login" element={<SuperAdminLogin />} />
<Route path="/superadmin" element={
  <SuperAdminGuard>
    <SuperAdminDashboard />
  </SuperAdminGuard>
} />
```

**Step 3: TypeScript check**
```bash
cd cozy-estate-central && npx tsc --noEmit 2>&1 | head -20
```

Fix any errors.

**Step 4: Manual test in browser**

```bash
cd cozy-estate-central && npm run dev
```

1. Navigate to `http://localhost:8080/superadmin/login`
2. Enter the SUPERADMIN_SECRET from backend/.env
3. Dashboard loads with stats and company list
4. "Neue Firma" dialog works
5. Password reset works
6. Delete shows confirmation dialog

**Step 5: Commit**
```bash
git add cozy-estate-central/src/App.tsx
git commit -m "feat(superadmin): register superadmin routes and provider"
```

---

## Task 7: Push + Server deploy

**Step 1: Push**
```bash
git push
```

**Step 2: Server update**
```bash
# On server
cd /root/immoverwaltung
git stash && git pull origin master
docker compose up -d --build
```

**Step 3: Add SUPERADMIN_SECRET to server .env**

On server, add to both `.env` and `backend/.env`:
```bash
echo 'SUPERADMIN_SECRET=<dein-sicheres-passwort>' >> .env
echo 'SUPERADMIN_JWT_SECRET=<zufälliger-string-32-zeichen>' >> backend/.env
echo 'SUPERADMIN_SECRET=<dein-sicheres-passwort>' >> backend/.env
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then restart backend:
```bash
docker compose restart backend
```

**Step 4: Test on production**

Navigate to `https://hasverl.xyz/superadmin/login` and verify everything works.
