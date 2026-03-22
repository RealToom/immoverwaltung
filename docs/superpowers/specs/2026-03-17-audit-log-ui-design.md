# Design: Audit-Log UI

**Datum:** 2026-03-17
**Status:** Approved

## Zusammenfassung

Die bestehende `AuditLog`-Tabelle in der DB bekommt ein vollständiges Frontend: Backend-Endpoint, React Query Hook, eigene Seite mit gefilterter Tabelle und Pagination, Sidebar-Eintrag. Nur für ADMIN sichtbar.

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `backend/src/controllers/auditlog.controller.ts` | Neu — GET-Handler |
| `backend/src/routes/auditlog.routes.ts` | Neu — Router mit requireRole |
| `backend/src/routes/index.ts` | Modify — neuen Router registrieren |
| `cozy-estate-central/src/hooks/api/useAuditLogs.ts` | Neu — React Query Hook |
| `cozy-estate-central/src/pages/AuditLog.tsx` | Neu — Seite |
| `cozy-estate-central/src/App.tsx` | Modify — Route hinzufügen |
| `cozy-estate-central/src/components/AppSidebar.tsx` | Modify — Sidebar-Eintrag |

## Backend

### Endpoint

```
GET /api/audit-logs
```

**Zugriffsschutz:** `requireAuth`, `tenantGuard`, `requireRole("ADMIN")`

**Query-Parameter:**

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `page` | number | 1 | Seite |
| `limit` | number | 50 | Einträge pro Seite (max 100) |
| `action` | string | — | Filter auf Aktionstyp (exakt) |
| `from` | ISO-Datum | — | Einträge ab diesem Datum |
| `to` | ISO-Datum | — | Einträge bis zu diesem Datum |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "action": "DOCUMENT_UPLOAD",
      "userId": 3,
      "ip": "192.168.1.1",
      "details": { "documentId": 42, "name": "Vertrag.pdf" },
      "createdAt": "2026-03-17T10:00:00.000Z"
    }
  ],
  "meta": { "total": 123, "page": 1, "limit": 50, "totalPages": 3 }
}
```

**Prisma-Query:**
```typescript
const where = {
  companyId: req.companyId,
  ...(action ? { action } : {}),
  ...(from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  } : {}),
};
const [logs, total] = await Promise.all([
  prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
  prisma.auditLog.count({ where }),
]);
```

### Controller-Datei

`backend/src/controllers/auditlog.controller.ts` — folgt dem bestehenden Muster:
- ESM-Imports mit `.js` Extension
- `import { prisma } from "../lib/prisma.js"`
- Zod-Validierung der Query-Parameter via `validate()` Middleware
- Fehler via `AppError`

### Route-Datei

`backend/src/routes/auditlog.routes.ts`:
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

Registrierung in `index.ts` (konsistent mit allen anderen Routen — named export):
```typescript
import { auditLogRouter } from "./auditlog.routes.js";
// ...
router.use("/audit-logs", requireAuth, tenantGuard, auditLogRouter);
```

## Frontend

### React Query Hook (`useAuditLogs.ts`)

```typescript
export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  from?: string;
  to?: string;
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["auditLogs", filters],
    queryFn: () => api<PaginatedResponse<AuditLogItem>>("/audit-logs", { params: filters }),
  });
}
```

### Seite `AuditLog.tsx`

**Layout:** Gleiche Struktur wie andere Seiten (Header + `<main>`).

**Filter-Bar** (oben):
- Dropdown: Aktionstyp (alle bekannten Actions + "Alle")
- Datums-Inputs: von / bis (type="date")
- Reset-Button

**Tabelle:**

| Spalte | Inhalt |
|--------|--------|
| Zeitpunkt | `formatDate(createdAt)` + Uhrzeit |
| Aktion | Badge mit Aktionsname |
| Benutzer | userId (falls vorhanden) — kein Name, da AuditLog bewusst keine FK-Relation zu User hat |
| IP | ip-Adresse |
| Details | JSON kompakt, max. 80 Zeichen, Tooltip mit vollständigem JSON |

**Pagination:** Konsistent mit anderen Seiten (Zurück/Weiter-Buttons + "Seite X von Y").

**Bekannte Aktionstypen** (für das Dropdown):
`DOCUMENT_UPLOAD`, `DOCUMENT_DOWNLOAD`, `DOCUMENT_PREVIEW`, `DOCUMENT_DELETE`, `PASSWORD_CHANGE`

### Sidebar (`AppSidebar.tsx`)

Neuer Eintrag direkt nach dem bestehenden `{isAdmin && <Administration />}`-Block:
```tsx
{isAdmin && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild tooltip="Audit-Log">
      <NavLink
        to="/audit-logs"
        className="text-sidebar-foreground/80"
        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      >
        <ClipboardList className="h-4 w-4" />
        <span>Audit-Log</span>
      </NavLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

Konsistent mit dem bestehenden Administration-Eintrag (gleiche `className`/`activeClassName`-Props).

### Route (`App.tsx`)

```tsx
<Route path="/audit-logs" element={<AuditLog />} />
```

Die Route liegt innerhalb des bestehenden `<ProtectedRoute>`-Wrappers (Auth-Check). ADMIN-Enforcement erfolgt durch: (a) Sidebar zeigt den Link nur wenn `isAdmin`, (b) Backend-Endpoint gibt 403 für Nicht-Admins. Kein Frontend-Redirect nötig — konsistent mit `/administration`.

## Validierung (Zod-Schema)

`backend/src/schemas/auditlog.schema.ts`:
```typescript
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  // date-only strings (YYYY-MM-DD) von <input type="date"> — kein .datetime()
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```

`new Date("2026-03-17")` parst ISO-Datumstrings korrekt in der Prisma-Query.

## Was sich NICHT ändert

- AuditLog-Modell und audit.service.ts: unverändert
- Bestehende Audit-Logging-Integrationen: unverändert
- Retention (90 Tage): unverändert
- Alle anderen Seiten und Routen: unverändert
