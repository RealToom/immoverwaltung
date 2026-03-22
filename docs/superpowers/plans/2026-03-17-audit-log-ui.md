# Audit-Log UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing `audit_logs` DB table via a backend endpoint and a new ADMIN-only frontend page with filtering and pagination.

**Architecture:** Backend: Zod schema → route → controller → Prisma query, registered in `routes/index.ts`. Frontend: React Query hook → new page `AuditLog.tsx` → sidebar entry + App.tsx route. No new DB migrations needed.

**Tech Stack:** Express 5, Prisma 6, Zod, React 18, React Query, Shadcn/UI, TypeScript

---

## Chunk 1: Backend

### Task 1: Zod-Schema

**Files:**
- Create: `backend/src/schemas/auditlog.schema.ts`

- [ ] **Schritt 1: Schema erstellen**

```typescript
import { z } from "zod";

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  // date-only strings (YYYY-MM-DD) von <input type="date">
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 3: Committen**

```bash
git add backend/src/schemas/auditlog.schema.ts
git commit -m "feat(audit-log): Zod-Validierungsschema"
```

---

### Task 2: Controller

**Files:**
- Create: `backend/src/controllers/auditlog.controller.ts`

- [ ] **Schritt 4: Controller erstellen**

```typescript
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { auditLogQuerySchema } from "../schemas/auditlog.schema.js";

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  // Zod-Schema parsed und liefert Defaults (page=1, limit=50)
  const { page, limit, action, from, to } = auditLogQuerySchema.parse(req.query);
  const skip = (page - 1) * limit;

  const where = {
    companyId: req.companyId!,
    ...(action ? { action } : {}),
    ...((from || to) ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        // Kein "Z"-Suffix → lokale Zeit; gesamter letzter Tag inklusive
        ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
      },
    } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: { id: true, action: true, userId: true, ip: true, details: true, createdAt: true },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    data: logs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

- [ ] **Schritt 5: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 6: Committen**

```bash
git add backend/src/controllers/auditlog.controller.ts
git commit -m "feat(audit-log): Controller mit Prisma-Query"
```

---

### Task 3: Route und Registrierung

**Files:**
- Create: `backend/src/routes/auditlog.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Schritt 7: Route-Datei erstellen**

```typescript
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { getAuditLogs } from "../controllers/auditlog.controller.js";
import { auditLogQuerySchema } from "../schemas/auditlog.schema.js";

const router = Router();

router.get("/", requireRole("ADMIN"), validate({ query: auditLogQuerySchema }), getAuditLogs);

export { router as auditLogRouter };
```

- [ ] **Schritt 8: In `index.ts` registrieren**

In `backend/src/routes/index.ts` nach dem letzten Import-Block (nach `budgetRouter`) einfügen:

```typescript
import { auditLogRouter } from "./auditlog.routes.js";
```

Und nach der letzten `router.use`-Zeile (nach `maintenance-budgets`) einfügen:

```typescript
router.use("/audit-logs", requireAuth, tenantGuard, auditLogRouter);
```

- [ ] **Schritt 9: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 10: Backend starten und Endpoint testen**

```bash
cd backend && npm run dev
```

In einem zweiten Terminal (mit gültigem JWT eines ADMIN-Nutzers):

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3001/api/audit-logs
```

Erwartetes Ergebnis:
```json
{ "data": [...], "meta": { "total": N, "page": 1, "limit": 50, "totalPages": N } }
```

- [ ] **Schritt 11: Committen**

```bash
git add backend/src/routes/auditlog.routes.ts backend/src/routes/index.ts
git commit -m "feat(audit-log): Backend-Endpoint GET /api/audit-logs"
```

---

## Chunk 2: Frontend

### Task 4: React Query Hook

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useAuditLogs.ts`

- [ ] **Schritt 12: Hook erstellen**

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AuditLogItem {
  id: number;
  action: string;
  userId: number | null;
  ip: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  from?: string;
  to?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["auditLogs", filters],
    queryFn: () =>
      api<PaginatedResponse<AuditLogItem>>("/audit-logs", { params: filters }),
  });
}
```

- [ ] **Schritt 13: Committen**

```bash
git add cozy-estate-central/src/hooks/api/useAuditLogs.ts
git commit -m "feat(audit-log): React Query Hook useAuditLogs"
```

---

### Task 5: AuditLog-Seite

**Files:**
- Create: `cozy-estate-central/src/pages/AuditLog.tsx`

- [ ] **Schritt 14: Seite erstellen**

```tsx
import { useState } from "react";
import { ClipboardList, Loader2, RotateCcw } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuditLogs, type AuditLogFilters } from "@/hooks/api/useAuditLogs";

const KNOWN_ACTIONS = [
  "DOCUMENT_UPLOAD",
  "DOCUMENT_DOWNLOAD",
  "DOCUMENT_PREVIEW",
  "DOCUMENT_DELETE",
  "PASSWORD_CHANGE",
];

const EMPTY_FILTERS: AuditLogFilters = { page: 1, limit: 50 };

export default function AuditLog() {
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_FILTERS);
  const { data, isLoading } = useAuditLogs(filters);

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const setPage = (page: number) => setFilters((f) => ({ ...f, page }));

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  };

  const formatDetails = (details: Record<string, unknown>) => {
    const str = JSON.stringify(details);
    return str.length > 80 ? str.slice(0, 77) + "…" : str;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Audit-Log</h1>
          <p className="text-xs text-muted-foreground">Sicherheitsrelevante Aktionen der letzten 90 Tage</p>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-4 overflow-auto">
        {/* Filter-Bar */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="grid gap-1.5">
            <Label className="text-xs">Aktion</Label>
            <Select
              value={filters.action ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, page: 1, action: v === "all" ? undefined : v }))
              }
            >
              <SelectTrigger className="w-48"><SelectValue placeholder="Alle Aktionen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                {KNOWN_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Von</Label>
            <Input
              type="date"
              className="w-36"
              value={filters.from ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, page: 1, from: e.target.value || undefined }))}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Bis</Label>
            <Input
              type="date"
              className="w-36"
              value={filters.to ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, page: 1, to: e.target.value || undefined }))}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zurücksetzen
          </Button>
        </div>

        {/* Tabelle */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {meta ? `${meta.total} Einträge` : "Einträge"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead>Benutzer-ID</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Keine Einträge gefunden.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.userId ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {log.ip ?? "—"}
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground font-mono max-w-xs truncate"
                          title={JSON.stringify(log.details)}
                        >
                          {formatDetails(log.details)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Seite {meta.page} von {meta.totalPages}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage(meta.page - 1)}
              >
                Zurück
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage(meta.page + 1)}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Schritt 15: TypeScript prüfen**

```bash
cd cozy-estate-central && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 16: Committen**

```bash
git add cozy-estate-central/src/pages/AuditLog.tsx
git commit -m "feat(audit-log): AuditLog-Seite mit Filter und Pagination"
```

---

### Task 6: Route und Sidebar

**Files:**
- Modify: `cozy-estate-central/src/App.tsx`
- Modify: `cozy-estate-central/src/components/AppSidebar.tsx`

- [ ] **Schritt 17: Import in App.tsx hinzufügen**

In `App.tsx` nach dem letzten Seiten-Import (suche nach `import Insurances from "./pages/Insurances"`) einfügen:

```typescript
import AuditLog from "./pages/AuditLog";
```

Relative Pfade (`./pages/...`) — konsistent mit allen anderen Importen in `App.tsx`.

- [ ] **Schritt 18: Route in App.tsx hinzufügen**

Nach der Zeile `<Route path="/insurance" element={<Insurances />} />` einfügen:

```tsx
<Route path="/audit-logs" element={<AuditLog />} />
```

- [ ] **Schritt 19: Sidebar-Eintrag hinzufügen**

In `AppSidebar.tsx` den `ClipboardList`-Icon zum bestehenden lucide-react-Import hinzufügen. Die aktuelle Import-Zeile sieht so aus:

```typescript
import { Building2, Users, FileText, Wrench, BarChart3, Settings, LayoutDashboard,
  CreditCard, Bell, LogOut, Shield, CalendarDays, Mail, Inbox, LayoutTemplate,
  Scale, ShieldCheck } from "lucide-react";
```

`ClipboardList` am Ende einfügen:

```typescript
import { Building2, Users, FileText, Wrench, BarChart3, Settings, LayoutDashboard,
  CreditCard, Bell, LogOut, Shield, CalendarDays, Mail, Inbox, LayoutTemplate,
  Scale, ShieldCheck, ClipboardList } from "lucide-react";
```

Dann nach dem bestehenden `{isAdmin && <Administration ...>}`-Block einfügen:

```tsx
{isAdmin && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild tooltip="Audit-Log">
      <NavLink
        to="/audit-logs"
        className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      >
        <ClipboardList className="h-4 w-4" />
        <span>Audit-Log</span>
      </NavLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

- [ ] **Schritt 20: TypeScript prüfen**

```bash
cd cozy-estate-central && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 21: Manuell testen**

```bash
cd cozy-estate-central && npm run dev
```

Als ADMIN einloggen (admin@immoverwalt.de / Admin123!):
- Sidebar zeigt "Audit-Log" unter Verwaltung ✓
- Seite `/audit-logs` lädt und zeigt Tabelle ✓
- Filter nach Aktion funktioniert ✓
- Datumsfilter von/bis funktioniert ✓
- Reset-Button setzt Filter zurück ✓
- Als VERWALTER einloggen: Sidebar-Eintrag nicht sichtbar, `/audit-logs` direkt aufgerufen → API gibt 403 ✓

- [ ] **Schritt 22: Committen**

```bash
git add cozy-estate-central/src/App.tsx cozy-estate-central/src/components/AppSidebar.tsx
git commit -m "feat(audit-log): Route und Sidebar-Eintrag (ADMIN only)"
```
