# Administration Area Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/administration` page (ADMIN-only) with 5 tabs: Firma, Mitarbeiter (mit Custom Roles), E-Mail (SMTP), Bankanbindung, DATEV. Includes per-company SMTP settings and a custom role permission system.

**Architecture:** New Prisma models `CustomRole` and `CompanySmtpSettings`. Backend: `administration.routes.ts` with ADMIN-only endpoints. Frontend: `Administration.tsx` replaces `/users` + adds SMTP config. Custom Roles are frontend-only (page visibility), not API RBAC.

**Tech Stack:** Prisma 6 migration, Express 5 router, AES-256-GCM (existing `encryptString`/`decryptString`), nodemailer, React + Shadcn/UI, React Query

**Design doc:** `docs/plans/2026-03-01-admin-area-design.md`

---

## Task 1: Prisma schema — add CustomRole + CompanySmtpSettings + User.customRoleId

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Add the two new models and extend User**

In `backend/prisma/schema.prisma`, make three changes:

**Change 1 — Add to `Company` model** (after the last relation, before `@@map("companies")`):

```prisma
  customRoles       CustomRole[]
  smtpSettings      CompanySmtpSettings?
```

**Change 2 — Add to `User` model** (after `companyId Int @map("company_id")`):

```prisma
  customRoleId Int?       @map("custom_role_id")
```

And add to `User` relations (after `refreshTokens RefreshToken[]`):

```prisma
  customRole    CustomRole? @relation(fields: [customRoleId], references: [id], onDelete: SetNull)
```

**Change 3 — Add two new models** (after the `RefreshToken` model block):

```prisma
// ─── CustomRole (Benutzerdefinierte Rollen) ──────────────────
model CustomRole {
  id        Int      @id @default(autoincrement())
  companyId Int      @map("company_id")
  name      String
  pages     String[] @default([])
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  users   User[]

  @@map("custom_roles")
}

// ─── CompanySmtpSettings (Pro-Firma SMTP) ────────────────────
model CompanySmtpSettings {
  id            Int     @id @default(autoincrement())
  companyId     Int     @unique @map("company_id")
  host          String
  port          Int     @default(587)
  secure        Boolean @default(false)
  user          String
  encryptedPass String  @map("encrypted_pass")
  fromAddress   String  @map("from_address")
  fromName      String  @map("from_name")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("company_smtp_settings")
}
```

**Step 2: Create and run migration**

```bash
cd backend
npm run db:migrate
# When prompted for migration name, enter: add_custom_roles_and_company_smtp
```

Expected output: `Your database is now in sync with your schema.`

**Step 3: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
cd backend
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add CustomRole + CompanySmtpSettings + User.customRoleId"
```

---

## Task 2: Backend — Administration SMTP endpoints

**Files:**
- Create: `backend/src/controllers/administration.controller.ts`
- Create: `backend/src/routes/administration.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Create the controller**

Create `backend/src/controllers/administration.controller.ts`:

```typescript
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { encryptString, decryptString } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import nodemailer from "nodemailer";

// ─── SMTP ────────────────────────────────────────────────────

export async function getSmtpHandler(req: Request, res: Response) {
  const smtp = await prisma.companySmtpSettings.findUnique({
    where: { companyId: req.companyId! },
  });

  if (!smtp) {
    res.json({ data: null });
    return;
  }

  // Never return the encrypted password
  const { encryptedPass: _, ...safe } = smtp;
  res.json({ data: safe });
}

export async function putSmtpHandler(req: Request, res: Response) {
  const { host, port, secure, user, password, fromAddress, fromName } = req.body as {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password?: string;
    fromAddress: string;
    fromName: string;
  };

  const existing = await prisma.companySmtpSettings.findUnique({
    where: { companyId: req.companyId! },
  });

  let encryptedPass: string;
  if (password) {
    encryptedPass = encryptString(password);
  } else if (existing) {
    encryptedPass = existing.encryptedPass; // keep existing password
  } else {
    throw new AppError(400, "Passwort ist erforderlich");
  }

  const smtp = await prisma.companySmtpSettings.upsert({
    where: { companyId: req.companyId! },
    create: { companyId: req.companyId!, host, port, secure, user, encryptedPass, fromAddress, fromName },
    update: { host, port, secure, user, encryptedPass, fromAddress, fromName },
  });

  const { encryptedPass: __, ...safe } = smtp;
  res.json({ data: safe });
}

export async function testSmtpHandler(req: Request, res: Response) {
  const smtp = await prisma.companySmtpSettings.findUnique({
    where: { companyId: req.companyId! },
  });

  if (!smtp) {
    throw new AppError(400, "Kein SMTP konfiguriert");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: decryptString(smtp.encryptedPass) },
  });

  // Send test mail to the current admin user
  const adminUser = await prisma.user.findUnique({ where: { id: req.user!.id } });

  try {
    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromAddress}>`,
      to: adminUser!.email,
      subject: "SMTP Test — ImmoVerwalt",
      html: "<p>Der SMTP-Versand funktioniert korrekt.</p>",
    });
    res.json({ data: { success: true, message: `Test-Mail an ${adminUser!.email} gesendet` } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    throw new AppError(502, `SMTP-Test fehlgeschlagen: ${message}`);
  }
}
```

**Step 2: Create the routes file**

Create `backend/src/routes/administration.routes.ts`:

```typescript
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import {
  getSmtpHandler,
  putSmtpHandler,
  testSmtpHandler,
  getRolesHandler,
  createRoleHandler,
  updateRoleHandler,
  deleteRoleHandler,
  setUserCustomRoleHandler,
} from "../controllers/administration.controller.js";

const router = Router();

// All routes are ADMIN-only
router.use(requireRole("ADMIN"));

// SMTP
router.get("/smtp", getSmtpHandler);
router.put("/smtp", putSmtpHandler);
router.post("/smtp/test", testSmtpHandler);

// Custom Roles
router.get("/roles", getRolesHandler);
router.post("/roles", createRoleHandler);
router.patch("/roles/:id", updateRoleHandler);
router.delete("/roles/:id", deleteRoleHandler);

// User role assignment
router.patch("/users/:id/role", setUserCustomRoleHandler);

export { router as administrationRouter };
```

**Step 3: Register the router in index.ts**

In `backend/src/routes/index.ts`, add import after the existing superadminRouter import:

```typescript
import { administrationRouter } from "./administration.routes.js";
```

And add the route registration (after the import route, before `export`):

```typescript
router.use("/administration", requireAuth, tenantGuard, administrationRouter);
```

**Step 4: Verify TypeScript**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors (roles handlers referenced in routes don't exist yet — this will fail; proceed to Task 3 first, then verify).

**Step 5: Commit** (after Task 3 is done and TypeScript passes):

```bash
git add backend/src/controllers/administration.controller.ts backend/src/routes/administration.routes.ts backend/src/routes/index.ts
git commit -m "feat(api): add /administration SMTP endpoints"
```

---

## Task 3: Backend — Custom Roles endpoints

**Files:**
- Modify: `backend/src/controllers/administration.controller.ts` (add role handlers)

**Step 1: Add role handlers to the controller**

Append to `backend/src/controllers/administration.controller.ts`:

```typescript
// ─── Custom Roles ────────────────────────────────────────────

export async function getRolesHandler(req: Request, res: Response) {
  const roles = await prisma.customRole.findMany({
    where: { companyId: req.companyId! },
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  res.json({ data: roles });
}

export async function createRoleHandler(req: Request, res: Response) {
  const { name, pages } = req.body as { name: string; pages: string[] };

  if (!name?.trim()) throw new AppError(400, "Name ist erforderlich");

  const role = await prisma.customRole.create({
    data: { companyId: req.companyId!, name: name.trim(), pages: pages ?? [] },
    include: { _count: { select: { users: true } } },
  });

  res.status(201).json({ data: role });
}

export async function updateRoleHandler(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const { name, pages } = req.body as { name?: string; pages?: string[] };

  // Verify role belongs to this company
  const existing = await prisma.customRole.findFirst({
    where: { id, companyId: req.companyId! },
  });
  if (!existing) throw new AppError(404, "Rolle nicht gefunden");

  const role = await prisma.customRole.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(pages !== undefined && { pages }),
    },
    include: { _count: { select: { users: true } } },
  });

  res.json({ data: role });
}

export async function deleteRoleHandler(req: Request, res: Response) {
  const id = parseInt(req.params.id);

  const existing = await prisma.customRole.findFirst({
    where: { id, companyId: req.companyId! },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) throw new AppError(404, "Rolle nicht gefunden");

  if (existing._count.users > 0) {
    throw new AppError(409, "Rolle kann nicht gelöscht werden (Benutzer zugewiesen)");
  }

  await prisma.customRole.delete({ where: { id } });
  res.status(204).send();
}

export async function setUserCustomRoleHandler(req: Request, res: Response) {
  const userId = parseInt(req.params.id);
  const { customRoleId } = req.body as { customRoleId: number | null };

  // Verify user belongs to this company
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId: req.companyId! },
  });
  if (!user) throw new AppError(404, "Benutzer nicht gefunden");

  // If assigning a role, verify it belongs to this company
  if (customRoleId !== null && customRoleId !== undefined) {
    const role = await prisma.customRole.findFirst({
      where: { id: customRoleId, companyId: req.companyId! },
    });
    if (!role) throw new AppError(404, "Rolle nicht gefunden");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { customRoleId: customRoleId ?? null },
    include: { customRole: true },
  });

  const { passwordHash, failedLoginAttempts, lockedUntil, ...safe } = updated;
  res.json({ data: safe });
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add backend/src/controllers/administration.controller.ts backend/src/routes/administration.routes.ts backend/src/routes/index.ts
git commit -m "feat(api): add /administration SMTP + custom roles endpoints"
```

---

## Task 4: Update email.ts for per-company SMTP + auth.service.ts for customRole in /auth/me

**Files:**
- Modify: `backend/src/config/email.ts`
- Modify: `backend/src/services/auth.service.ts`

**Step 1: Refactor email.ts**

Replace the full contents of `backend/src/config/email.ts` with:

```typescript
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "./env.js";
import { logger } from "../lib/logger.js";
import { decryptString } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";

let serverTransporter: Transporter | null = null;

export const isEmailEnabled = !!env.SMTP_HOST;

if (isEmailEnabled) {
  serverTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  logger.info({ smtp: `${env.SMTP_HOST}:${env.SMTP_PORT}` }, "E-Mail-Versand aktiviert");
} else {
  logger.info("E-Mail-Versand deaktiviert (SMTP_HOST nicht konfiguriert)");
}

/** Get transporter for a specific company (falls back to server .env). */
async function getCompanyTransporter(companyId: number): Promise<{ transporter: Transporter; from: string } | null> {
  const settings = await prisma.companySmtpSettings.findUnique({ where: { companyId } });

  if (settings) {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: decryptString(settings.encryptedPass) },
    });
    return { transporter, from: `"${settings.fromName}" <${settings.fromAddress}>` };
  }

  if (serverTransporter) {
    return { transporter: serverTransporter, from: env.SMTP_FROM };
  }

  return null;
}

/** Send mail for a specific company (uses company SMTP or server fallback). */
export async function sendMailForCompany(
  companyId: number,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const config = await getCompanyTransporter(companyId);
  if (!config) return false;

  try {
    await config.transporter.sendMail({ from: config.from, to, subject, html });
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "E-Mail-Versand fehlgeschlagen");
    return false;
  }
}

/** Legacy: send mail using server transporter (no company context). */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!serverTransporter) return false;

  try {
    await serverTransporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "E-Mail-Versand fehlgeschlagen");
    return false;
  }
}
```

**Step 2: Update auth.service.ts — getProfile includes customRole**

In `backend/src/services/auth.service.ts`, find the `getProfile` function (line ~196) and change it from:

```typescript
export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true },
  });
```

To:

```typescript
export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true, customRole: true },
  });
```

**Step 3: Verify TypeScript**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add backend/src/config/email.ts backend/src/services/auth.service.ts
git commit -m "feat(email): per-company SMTP fallback; include customRole in /auth/me"
```

---

## Task 5: Frontend — permissions.ts + AuthContext User type

**Files:**
- Create: `cozy-estate-central/src/lib/permissions.ts`
- Modify: `cozy-estate-central/src/contexts/AuthContext.tsx`

**Step 1: Create permissions.ts**

Create `cozy-estate-central/src/lib/permissions.ts`:

```typescript
export const PAGE_KEYS = [
  "dashboard",
  "properties",
  "tenants",
  "contracts",
  "finances",
  "maintenance",
  "calendar",
  "postfach",
  "anfragen",
  "vorlagen",
  "berichte",
  "notifications",
  "import",
] as const;

export type PageKey = typeof PAGE_KEYS[number];

export interface CustomRole {
  id: number;
  name: string;
  pages: string[];
}

export function canAccess(
  user: { role: string; customRole?: CustomRole | null },
  page: PageKey
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.customRole) return user.customRole.pages.includes(page);
  // Legacy roles: VERWALTER, BUCHHALTER, READONLY all have full visibility
  return true;
}
```

**Step 2: Update AuthContext — add customRole to User interface**

In `cozy-estate-central/src/contexts/AuthContext.tsx`, change the `User` interface from:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number;
}
```

To:

```typescript
interface CustomRole {
  id: number;
  name: string;
  pages: string[];
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number;
  customRole?: CustomRole | null;
}
```

**Step 3: Verify TypeScript**

```bash
cd cozy-estate-central
npm run build 2>&1 | head -30
```

Expected: No type errors related to the changes.

**Step 4: Commit**

```bash
git add cozy-estate-central/src/lib/permissions.ts cozy-estate-central/src/contexts/AuthContext.tsx
git commit -m "feat(frontend): add permissions.ts + customRole to User type"
```

---

## Task 6: Frontend — API hooks (useAdminSmtp + useCustomRoles)

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useAdminSmtp.ts`
- Create: `cozy-estate-central/src/hooks/api/useCustomRoles.ts`

**Step 1: Create useAdminSmtp.ts**

Create `cozy-estate-central/src/hooks/api/useAdminSmtp.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SmtpSettings {
  id: number;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromAddress: string;
  fromName: string;
}

export interface SmtpInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  fromAddress: string;
  fromName: string;
}

export function useAdminSmtp() {
  return useQuery<SmtpSettings | null>({
    queryKey: ["admin", "smtp"],
    queryFn: async () => {
      const res = await api<{ data: SmtpSettings | null }>("/administration/smtp");
      return res.data;
    },
  });
}

export function useSaveSmtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SmtpInput) =>
      api<{ data: SmtpSettings }>("/administration/smtp", { method: "PUT", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "smtp"] }),
  });
}

export function useTestSmtp() {
  return useMutation({
    mutationFn: () =>
      api<{ data: { success: boolean; message: string } }>("/administration/smtp/test", {
        method: "POST",
      }),
  });
}
```

**Step 2: Create useCustomRoles.ts**

Create `cozy-estate-central/src/hooks/api/useCustomRoles.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CustomRole } from "@/lib/permissions";

export interface CustomRoleWithCount extends CustomRole {
  _count: { users: number };
}

export function useCustomRoles() {
  return useQuery<CustomRoleWithCount[]>({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const res = await api<{ data: CustomRoleWithCount[] }>("/administration/roles");
      return res.data;
    },
  });
}

export function useCreateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; pages: string[] }) =>
      api<{ data: CustomRoleWithCount }>("/administration/roles", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useUpdateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; pages?: string[] }) =>
      api<{ data: CustomRoleWithCount }>(`/administration/roles/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useDeleteCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`/administration/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useSetUserCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, customRoleId }: { userId: number; customRoleId: number | null }) =>
      api(`/administration/users/${userId}/role`, { method: "PATCH", body: { customRoleId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
  });
}
```

**Step 3: Verify TypeScript**

```bash
cd cozy-estate-central
npm run build 2>&1 | head -30
```

Expected: No errors.

**Step 4: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useAdminSmtp.ts cozy-estate-central/src/hooks/api/useCustomRoles.ts
git commit -m "feat(frontend): add useAdminSmtp + useCustomRoles hooks"
```

---

## Task 7: Frontend — Administration.tsx (5 Tabs)

**Files:**
- Create: `cozy-estate-central/src/pages/Administration.tsx`

The page has 5 tabs. The content for tabs `bank` and `datev` is a redirect/notice since those remain in their own pages for non-admin users. The actual bank and DATEV UIs are embedded here for ADMIN.

**Step 1: Read existing pages for reuse**

Read these files to understand what to copy:
- `cozy-estate-central/src/pages/Users.tsx` — full content for Mitarbeiter tab
- `cozy-estate-central/src/pages/Settings.tsx` — for Firma tab structure (company data fields)
- `cozy-estate-central/src/pages/BankIntegration.tsx` — for Bank tab

**Step 2: Create Administration.tsx**

Create `cozy-estate-central/src/pages/Administration.tsx`:

```tsx
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Users, Mail, Landmark, BarChart3, Shield,
  Plus, Pencil, Trash2, Send, Eye, EyeOff, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAdminSmtp, useSaveSmtp, useTestSmtp, type SmtpInput } from "@/hooks/api/useAdminSmtp";
import {
  useCustomRoles,
  useCreateCustomRole,
  useUpdateCustomRole,
  useDeleteCustomRole,
  useSetUserCustomRole,
  type CustomRoleWithCount,
} from "@/hooks/api/useCustomRoles";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetUserPassword, useUnlockUser } from "@/hooks/api/useUsers";
import { PAGE_KEYS } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";

// ─── Page label mapping ──────────────────────────────────────
const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  properties: "Immobilien",
  tenants: "Mieter",
  contracts: "Verträge",
  finances: "Finanzen",
  maintenance: "Wartung",
  calendar: "Kalender",
  postfach: "Postfach",
  anfragen: "Anfragen",
  vorlagen: "Vorlagen",
  berichte: "Berichte",
  notifications: "Benachrichtigungen",
  import: "Datenimport",
};

// ─── SMTP Tab ────────────────────────────────────────────────
function SmtpTab() {
  const { toast } = useToast();
  const { data: smtp, isLoading } = useAdminSmtp();
  const saveSmtp = useSaveSmtp();
  const testSmtp = useTestSmtp();

  const [form, setForm] = useState<SmtpInput>({
    host: smtp?.host ?? "",
    port: smtp?.port ?? 587,
    secure: smtp?.secure ?? false,
    user: smtp?.user ?? "",
    password: "",
    fromAddress: smtp?.fromAddress ?? "",
    fromName: smtp?.fromName ?? "",
  });
  const [showPass, setShowPass] = useState(false);

  // Sync form when data loads
  const [synced, setSynced] = useState(false);
  if (smtp && !synced) {
    setForm({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user,
      password: "",
      fromAddress: smtp.fromAddress,
      fromName: smtp.fromName,
    });
    setSynced(true);
  }

  async function handleSave() {
    try {
      await saveSmtp.mutateAsync(form);
      toast({ title: "SMTP gespeichert" });
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  async function handleTest() {
    try {
      const res = await testSmtp.mutateAsync();
      toast({ title: res.data.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast({ title: `Test fehlgeschlagen: ${msg}`, variant: "destructive" });
    }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>SMTP-Konfiguration</CardTitle>
          <CardDescription>
            Konfigurieren Sie den E-Mail-Server für System-E-Mails (Passwort-Reset, Mahnungen etc.).
            Wenn kein SMTP konfiguriert ist, wird der Server-Standard verwendet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>SMTP-Host</Label>
              <Input
                placeholder="smtp.example.com"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Port</Label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: parseInt(e.target.value) || 587 }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.secure}
              onCheckedChange={(v) => setForm((f) => ({ ...f, secure: v }))}
            />
            <Label>TLS/SSL (Port 465)</Label>
          </div>

          <div className="space-y-1">
            <Label>Benutzername</Label>
            <Input
              value={form.user}
              onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label>Passwort {smtp && "(leer lassen = unverändert)"}</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder={smtp ? "••••••••" : "Passwort eingeben"}
                value={form.password ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Absender-Name</Label>
            <Input
              placeholder="Mustermann Hausverwaltung"
              value={form.fromName}
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label>Absender-E-Mail</Label>
            <Input
              type="email"
              placeholder="noreply@example.com"
              value={form.fromAddress}
              onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saveSmtp.isPending}>
              {saveSmtp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
            {smtp && (
              <Button variant="outline" onClick={handleTest} disabled={testSmtp.isPending}>
                {testSmtp.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Test-Mail senden
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Roles Dialog ────────────────────────────────────────────
function RoleDialog({
  role,
  onClose,
}: {
  role: CustomRoleWithCount | null; // null = new
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createRole = useCreateCustomRole();
  const updateRole = useUpdateCustomRole();

  const [name, setName] = useState(role?.name ?? "");
  const [pages, setPages] = useState<string[]>(role?.pages ?? []);

  function togglePage(key: string) {
    setPages((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Name ist erforderlich", variant: "destructive" });
      return;
    }
    try {
      if (role) {
        await updateRole.mutateAsync({ id: role.id, name, pages });
      } else {
        await createRole.mutateAsync({ name, pages });
      }
      toast({ title: role ? "Rolle aktualisiert" : "Rolle erstellt" });
      onClose();
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    }
  }

  const isPending = createRole.isPending || updateRole.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{role ? "Rolle bearbeiten" : "Neue Rolle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Rollenname</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Hausmeister" />
          </div>
          <div className="space-y-2">
            <Label>Zugriff auf folgende Seiten</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {PAGE_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={key}
                    checked={pages.includes(key)}
                    onCheckedChange={() => togglePage(key)}
                  />
                  <label htmlFor={key} className="text-sm cursor-pointer">
                    {PAGE_LABELS[key] ?? key}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mitarbeiter Tab ─────────────────────────────────────────
function MitarbeiterTab() {
  const { toast } = useToast();
  const { data: roles = [] } = useCustomRoles();
  const { data: usersData } = useUsers();
  const deleteRole = useDeleteCustomRole();
  const setUserCustomRole = useSetUserCustomRole();

  const [roleDialog, setRoleDialog] = useState<CustomRoleWithCount | null | "new">(undefined as unknown as null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  const users = usersData?.data ?? [];

  async function handleDeleteRole(role: CustomRoleWithCount) {
    if (role._count.users > 0) {
      toast({ title: "Rolle hat zugewiesene Benutzer", variant: "destructive" });
      return;
    }
    try {
      await deleteRole.mutateAsync(role.id);
      toast({ title: "Rolle gelöscht" });
    } catch {
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-8">
      {/* Roles section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Benutzerdefinierte Rollen</h3>
          <Button size="sm" onClick={() => { setRoleDialog(null); setShowRoleDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Neue Rolle
          </Button>
        </div>
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine benutzerdefinierten Rollen angelegt.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Seiten</TableHead>
                  <TableHead>Benutzer</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {role.pages.length === 0 ? "Kein Zugriff" : `${role.pages.length} von ${PAGE_KEYS.length}`}
                    </TableCell>
                    <TableCell>{role._count.users}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => { setRoleDialog(role); setShowRoleDialog(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleDeleteRole(role)}
                          disabled={role._count.users > 0}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Users section */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Mitarbeiter</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>System-Rolle</TableHead>
                <TableHead>Benutzerdefinierte Rolle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.customRoleId ? String(u.customRoleId) : "none"}
                      onValueChange={(val) =>
                        setUserCustomRole.mutate({
                          userId: u.id,
                          customRoleId: val === "none" ? null : parseInt(val),
                        })
                      }
                    >
                      <SelectTrigger className="w-44 h-8">
                        <SelectValue placeholder="Keine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {showRoleDialog && (
        <RoleDialog
          role={roleDialog as CustomRoleWithCount | null}
          onClose={() => setShowRoleDialog(false)}
        />
      )}
    </div>
  );
}

// ─── Firma Tab ───────────────────────────────────────────────
// Placeholder — company data already exists in Settings page
function FirmaTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Firmendaten</CardTitle>
        <CardDescription>
          Name, Adresse, Steuernummer, Website, Währung, Sprache und Datumsformat
          können unter <strong>Einstellungen → Allgemein</strong> bearbeitet werden.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

// ─── Bank Tab ────────────────────────────────────────────────
function BankTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bankanbindung</CardTitle>
        <CardDescription>
          Die Bankanbindung ist unter <strong>Bankanbindung</strong> in der Sidebar erreichbar.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

// ─── DATEV Tab ───────────────────────────────────────────────
function DatevTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>DATEV-Einstellungen</CardTitle>
        <CardDescription>
          DATEV-Einstellungen (Beraternummer, Mandantennummer, Konten-Mapping) sind unter
          <strong> Finanzen → DATEV</strong> erreichbar.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function Administration() {
  const { user } = useAuth();
  const [tab, setTab] = useState("mitarbeiter");

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Kein Zugriff. Dieser Bereich ist Administratoren vorbehalten.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Administration</h1>
      </header>

      <main className="flex-1 p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="mitarbeiter">
              <Users className="mr-2 h-4 w-4" /> Mitarbeiter
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="mr-2 h-4 w-4" /> E-Mail
            </TabsTrigger>
            <TabsTrigger value="firma">
              <Building2 className="mr-2 h-4 w-4" /> Firma
            </TabsTrigger>
            <TabsTrigger value="bank">
              <Landmark className="mr-2 h-4 w-4" /> Bankanbindung
            </TabsTrigger>
            <TabsTrigger value="datev">
              <BarChart3 className="mr-2 h-4 w-4" /> DATEV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mitarbeiter"><MitarbeiterTab /></TabsContent>
          <TabsContent value="email"><SmtpTab /></TabsContent>
          <TabsContent value="firma"><FirmaTab /></TabsContent>
          <TabsContent value="bank"><BankTab /></TabsContent>
          <TabsContent value="datev"><DatevTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
```

> **Note on `useUsers`:** The existing `useUsers` hook likely returns `{ data: UserItem[] }`. Check if `UserItem` has `customRoleId` — if not, it will be `undefined` and the Select will default to "Keine", which is correct behavior. The `UserItem` type in `useUsers.ts` may need `customRoleId?: number | null` added.

**Step 3: Check useUsers type**

Read `cozy-estate-central/src/hooks/api/useUsers.ts` and check if `UserItem` has `customRoleId`. If not, add:

```typescript
customRoleId?: number | null;
```

**Step 4: Verify build**

```bash
cd cozy-estate-central
npm run build 2>&1 | head -50
```

Fix any type errors before continuing.

**Step 5: Commit**

```bash
git add cozy-estate-central/src/pages/Administration.tsx cozy-estate-central/src/hooks/api/useUsers.ts
git commit -m "feat(frontend): add Administration page with Mitarbeiter + E-Mail tabs"
```

---

## Task 8: Frontend — App.tsx routing + AppSidebar redirect

**Files:**
- Modify: `cozy-estate-central/src/App.tsx`
- Modify: `cozy-estate-central/src/components/AppSidebar.tsx`

**Step 1: Update App.tsx — add Administration route + redirect /users**

In `cozy-estate-central/src/App.tsx`:

1. Add import (near other page imports):
```typescript
import Administration from "./pages/Administration";
```

2. In `AppLayout`, add the route (after `/users` route):
```tsx
<Route path="/administration" element={<Administration />} />
<Route path="/users" element={<Navigate to="/administration" replace />} />
```

Replace the current `/users` route with the Navigate. The final routes for those two should look like:
```tsx
<Route path="/administration" element={<Administration />} />
<Route path="/users" element={<Navigate to="/administration" replace />} />
```

**Step 2: Update AppSidebar — replace "Benutzer" with "Administration"**

In `cozy-estate-central/src/components/AppSidebar.tsx`:

1. Add `Shield` to the lucide-react import:
```typescript
import { ..., Shield } from "lucide-react";
```
(Remove `UserCog` if only used for the Benutzer entry)

2. Replace the existing admin-only "Benutzer" block:
```tsx
{isAdmin && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild tooltip="Benutzer">
      <NavLink
        to="/users"
        ...
      >
        <UserCog className="h-4 w-4" />
        <span>Benutzer</span>
      </NavLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

With:
```tsx
{isAdmin && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild tooltip="Administration">
      <NavLink
        to="/administration"
        className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      >
        <Shield className="h-4 w-4" />
        <span>Administration</span>
      </NavLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

**Step 3: Verify build**

```bash
cd cozy-estate-central
npm run build
```

Expected: Build succeeds.

**Step 4: Manual smoke test**

```bash
cd cozy-estate-central
npm run dev
```

- Login as ADMIN → Sidebar shows "Administration" (not "Benutzer")
- Navigate to `/users` → redirects to `/administration`
- Navigate to `/administration` → 5 tabs visible
- Mitarbeiter tab → user table with Custom Role dropdown
- E-Mail tab → SMTP form

**Step 5: Commit**

```bash
git add cozy-estate-central/src/App.tsx cozy-estate-central/src/components/AppSidebar.tsx
git commit -m "feat(frontend): route /administration + sidebar update + /users redirect"
```

---

## Task 9: Run full test suite + deploy

**Step 1: Backend tests**

```bash
cd backend
npm test
```

Expected: All existing tests pass. (No new backend tests required — the SMTP test endpoint and role guards are integration-level; unit tests would require mocking nodemailer/prisma which is out of scope for this plan.)

**Step 2: Frontend build**

```bash
cd cozy-estate-central
npm run build
```

Expected: No errors.

**Step 3: Full commit check**

```bash
git log --oneline -8
```

Verify all 8 commits from Tasks 1–8 are present.

**Step 4: Deploy**

```bash
# On server:
git stash && git pull origin master && docker compose up -d --build
```

**Step 5: Post-deploy verification**

- Login as ADMIN at https://hasverl.xyz
- Sidebar: "Administration" visible
- `/administration` loads with 5 tabs
- Mitarbeiter tab: user table + empty roles table + "Neue Rolle" button
- E-Mail tab: SMTP form (empty by default)
- Create a Custom Role: name "Hausmeister", check only "dashboard" + "properties"
- Assign to a non-ADMIN user → user sees only Dashboard + Immobilien in sidebar (after next login)
- Enter SMTP settings → click "Test-Mail senden" → success toast

**Step 6: Final commit (if any hotfixes were needed)**

```bash
git add -p
git commit -m "fix(administration): post-deploy corrections"
```

---

## Key Reference: Files Changed Summary

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | + `CustomRole` model, + `CompanySmtpSettings` model, + `User.customRoleId` |
| `backend/prisma/migrations/*/` | New migration |
| `backend/src/controllers/administration.controller.ts` | NEW — SMTP + roles handlers |
| `backend/src/routes/administration.routes.ts` | NEW — ADMIN-only router |
| `backend/src/routes/index.ts` | + `router.use("/administration", ...)` |
| `backend/src/config/email.ts` | + `getCompanyTransporter()`, + `sendMailForCompany()` |
| `backend/src/services/auth.service.ts` | `getProfile()` includes `customRole` |
| `cozy-estate-central/src/lib/permissions.ts` | NEW — `PAGE_KEYS`, `canAccess()` |
| `cozy-estate-central/src/contexts/AuthContext.tsx` | + `customRole` in `User` interface |
| `cozy-estate-central/src/hooks/api/useAdminSmtp.ts` | NEW |
| `cozy-estate-central/src/hooks/api/useCustomRoles.ts` | NEW |
| `cozy-estate-central/src/pages/Administration.tsx` | NEW — 5-tab page |
| `cozy-estate-central/src/App.tsx` | + `/administration` route, `/users` → redirect |
| `cozy-estate-central/src/components/AppSidebar.tsx` | "Benutzer" → "Administration" |
