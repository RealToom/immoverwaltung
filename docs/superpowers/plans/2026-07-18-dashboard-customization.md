# Anpassbares Dashboard (Widget-System) – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das feste Dashboard (`Index.tsx`) wird zu einem pro Nutzer anpassbaren Widget-Dashboard — Widgets an/aus, per Drag & Drop anordnen + Größe ändern, plus neue Kennzahlen-Widgets.

**Architecture:** Ein zentrales Frontend-**Widget-Register** (Map `widgetKey → {Komponente, Meta}`) ist die Quelle der Wahrheit für Rendering und Bibliothek. Das Layout (Array `{key,x,y,w,h}`) wird pro Nutzer als JSON in der neuen Tabelle `DashboardLayout` gespeichert und über `GET/PUT /dashboard/layout` geladen/gesichert. Das Raster nutzt `react-grid-layout`. Neue Widgets nutzen überwiegend bestehende Endpunkte; nur `revenue-series` und `expiring-certificates` kommen neu hinzu.

**Tech Stack:** Backend: Express 5, Prisma 6, PostgreSQL, Zod, Vitest. Frontend: React 18, TypeScript, Vite, Tailwind, Shadcn/UI, React Query, `react-grid-layout` (neu), recharts (vorhanden), Vitest + Testing Library.

## Global Constraints

- **Sprache:** Code/Variablen/Kommentare Englisch; UI-Texte Deutsch. Währung EUR (`formatCurrency`). Datum DD.MM.YYYY.
- **ESM-Imports Backend:** immer `.js`-Extension (z.B. `import { prisma } from "../lib/prisma.js"`).
- **Multi-Tenancy:** Jede Query filtert nach `companyId` aus `req.companyId!`. `userId` aus `req.user`/JWT.
- **API-Format:** Einzelobjekt `{ data: ... }`, Liste `{ data: [...], meta: {...} }`.
- **Prisma-Enums:** SCREAMING_SNAKE_CASE. Kein Prisma 7.
- **RBAC-Ränge (kanonisch, FE+BE identisch):** `READONLY=1 < BUCHHALTER=2 < VERWALTER=3 < ADMIN=4`; unbekannte/Custom-Rollen = 3. `requiredRole: "BUCHHALTER"` bedeutet „mindestens Rang 2".
- **Nach signifikanten Änderungen:** `PROJEKTDOKUMENTATION.md` aktualisieren (eigener Task am Ende).
- **Canonical LayoutItem-Typ (FE+BE identisch):** `{ key: string; x: number; y: number; w: number; h: number }`.
- **Grid-Konfig (kanonisch):** `cols = { lg: 4, md: 2, sm: 1 }`, `breakpoints = { lg: 1024, md: 640, sm: 0 }`, `rowHeight = 120`, `margin = [16, 16]`.

---

## Kanonische Widget-Keys (in allen Tasks referenziert)

```
kpi-properties, kpi-tenants, kpi-revenue, kpi-vacancy, kpi-units,
roi, revenue-chart, overdue,
expiring-contracts, expiring-insurances, maintenance-due,
open-tickets, upcoming-events, energy,
property-table, quick-actions, recent-activity
```

**Min-Rolle `BUCHHALTER` (sonst keine):** `kpi-revenue`, `roi`, `revenue-chart`, `overdue`, `quick-actions`.

**Standard-Layout (lg, 4 Spalten):**
```
kpi-properties  x0 y0 w1 h1
kpi-tenants     x1 y0 w1 h1
kpi-revenue     x2 y0 w1 h1
kpi-vacancy     x3 y0 w1 h1
property-table  x0 y1 w3 h4
quick-actions   x3 y1 w1 h1
recent-activity x3 y2 w1 h3
```

---

## Task 1: Prisma-Modell `DashboardLayout` + Migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (User-Modell + neues Modell)
- Create: `backend/prisma/migrations/<generated>/migration.sql` (via CLI)

**Interfaces:**
- Produces: Prisma-Client-Modell `dashboardLayout` mit Feldern `id, userId (unique), companyId, widgets (Json), updatedAt`.

- [ ] **Step 1: User-Relation ergänzen**

In `backend/prisma/schema.prisma`, im `model User { ... }` in den Relationsblock (nach `notifications Notification[]`) einfügen:

```prisma
  dashboardLayout DashboardLayout?
```

- [ ] **Step 2: Neues Modell anfügen**

Direkt nach dem `model User { ... }`-Block (vor `model RefreshToken`) einfügen:

```prisma
// ─── DashboardLayout ─────────────────────────────────────────
model DashboardLayout {
  id        Int      @id @default(autoincrement())
  userId    Int      @unique @map("user_id")
  companyId Int      @map("company_id")
  widgets   Json     @default("[]")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@map("dashboard_layouts")
}
```

- [ ] **Step 3: Migration erzeugen**

Voraussetzung: `docker-compose up -d` läuft (PostgreSQL). Dann:

Run: `cd backend && npm run db:migrate -- --name add_dashboard_layout`
Expected: Prisma erstellt Migration + `dashboard_layouts`-Tabelle, `✔ Generated Prisma Client`.

- [ ] **Step 4: TypeScript prüfen**

Run: `cd backend && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(dashboard): DashboardLayout Prisma-Modell + Migration"
```

---

## Task 2: Server-Widget-Katalog + Zod-Schema

Definiert die kanonischen Keys, Min-Rollen, das Standard-Layout und die Validierung serverseitig (unabhängig vom Frontend-Register, da der Server keine React-Komponenten kennt).

**Files:**
- Create: `backend/src/lib/dashboardWidgets.ts`
- Create: `backend/src/schemas/dashboard.schema.ts`
- Create: `backend/src/test/dashboardWidgets.test.ts`

**Interfaces:**
- Produces:
  - `WIDGET_KEYS: Set<string>`
  - `WIDGET_MIN_ROLE: Record<string, "BUCHHALTER">` (nur Einträge mit Mindestrolle)
  - `DEFAULT_LAYOUT: LayoutItem[]`
  - `type LayoutItem = { key: string; x: number; y: number; w: number; h: number }`
  - `roleRank(role: string): number`
  - `canSeeWidget(role: string, key: string): boolean`
  - `filterLayoutForRole(items: LayoutItem[], role: string): LayoutItem[]` (entfernt unbekannte Keys + Keys ohne ausreichende Rolle)
  - `dashboardLayoutSchema` (Zod) für den PUT-Body

- [ ] **Step 1: Katalog-Lib schreiben**

Create `backend/src/lib/dashboardWidgets.ts`:

```ts
export type LayoutItem = { key: string; x: number; y: number; w: number; h: number };

export const WIDGET_KEYS = new Set<string>([
  "kpi-properties", "kpi-tenants", "kpi-revenue", "kpi-vacancy", "kpi-units",
  "roi", "revenue-chart", "overdue",
  "expiring-contracts", "expiring-insurances", "maintenance-due",
  "open-tickets", "upcoming-events", "energy",
  "property-table", "quick-actions", "recent-activity",
]);

// Widgets, die eine Mindestrolle erfordern (sonst frei sichtbar)
export const WIDGET_MIN_ROLE: Record<string, "BUCHHALTER"> = {
  "kpi-revenue": "BUCHHALTER",
  "roi": "BUCHHALTER",
  "revenue-chart": "BUCHHALTER",
  "overdue": "BUCHHALTER",
  "quick-actions": "BUCHHALTER",
};

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { key: "kpi-properties",  x: 0, y: 0, w: 1, h: 1 },
  { key: "kpi-tenants",     x: 1, y: 0, w: 1, h: 1 },
  { key: "kpi-revenue",     x: 2, y: 0, w: 1, h: 1 },
  { key: "kpi-vacancy",     x: 3, y: 0, w: 1, h: 1 },
  { key: "property-table",  x: 0, y: 1, w: 3, h: 4 },
  { key: "quick-actions",   x: 3, y: 1, w: 1, h: 1 },
  { key: "recent-activity", x: 3, y: 2, w: 1, h: 3 },
];

const RANKS: Record<string, number> = { READONLY: 1, BUCHHALTER: 2, VERWALTER: 3, ADMIN: 4 };

export function roleRank(role: string): number {
  return RANKS[role] ?? 3; // Custom-Rollen wie VERWALTER behandeln
}

export function canSeeWidget(role: string, key: string): boolean {
  const min = WIDGET_MIN_ROLE[key];
  if (!min) return true;
  return roleRank(role) >= RANKS[min];
}

export function filterLayoutForRole(items: LayoutItem[], role: string): LayoutItem[] {
  return items.filter((it) => WIDGET_KEYS.has(it.key) && canSeeWidget(role, it.key));
}
```

- [ ] **Step 2: Zod-Schema schreiben**

Create `backend/src/schemas/dashboard.schema.ts`:

```ts
import { z } from "zod";
import { WIDGET_KEYS } from "../lib/dashboardWidgets.js";

const layoutItemSchema = z.object({
  key: z.string().refine((k) => WIDGET_KEYS.has(k), { message: "Unbekannter Widget-Key" }),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(999),
  w: z.number().int().min(1).max(4),
  h: z.number().int().min(1).max(12),
});

export const dashboardLayoutSchema = z.object({
  widgets: z.array(layoutItemSchema).max(40),
});
```

- [ ] **Step 3: Test schreiben**

Create `backend/src/test/dashboardWidgets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canSeeWidget, filterLayoutForRole, DEFAULT_LAYOUT } from "../lib/dashboardWidgets.js";

describe("dashboardWidgets role filtering", () => {
  it("hides BUCHHALTER-only widgets from READONLY", () => {
    expect(canSeeWidget("READONLY", "roi")).toBe(false);
    expect(canSeeWidget("READONLY", "kpi-properties")).toBe(true);
    expect(canSeeWidget("BUCHHALTER", "roi")).toBe(true);
    expect(canSeeWidget("ADMIN", "quick-actions")).toBe(true);
  });

  it("filterLayoutForRole drops unknown keys and forbidden widgets", () => {
    const input = [
      { key: "kpi-properties", x: 0, y: 0, w: 1, h: 1 },
      { key: "roi", x: 1, y: 0, w: 1, h: 1 },
      { key: "does-not-exist", x: 2, y: 0, w: 1, h: 1 },
    ];
    const out = filterLayoutForRole(input, "READONLY");
    expect(out.map((i) => i.key)).toEqual(["kpi-properties"]);
  });

  it("default layout contains only known keys", () => {
    const out = filterLayoutForRole(DEFAULT_LAYOUT, "ADMIN");
    expect(out).toHaveLength(DEFAULT_LAYOUT.length);
  });
});
```

- [ ] **Step 4: Test ausführen**

Run: `cd backend && npx vitest run src/test/dashboardWidgets.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/dashboardWidgets.ts backend/src/schemas/dashboard.schema.ts backend/src/test/dashboardWidgets.test.ts
git commit -m "feat(dashboard): Server-Widget-Katalog + Layout-Zod-Schema"
```

---

## Task 3: Layout-Service (laden/speichern) + Tests

**Files:**
- Modify: `backend/src/services/dashboard.service.ts` (Funktionen anhängen)
- Create: `backend/src/test/dashboard-layout.service.test.ts`

**Interfaces:**
- Consumes: `filterLayoutForRole`, `DEFAULT_LAYOUT`, `LayoutItem` aus `../lib/dashboardWidgets.js`.
- Produces:
  - `getDashboardLayout(companyId: number, userId: number, role: string): Promise<LayoutItem[]>`
  - `saveDashboardLayout(companyId: number, userId: number, widgets: LayoutItem[]): Promise<LayoutItem[]>`

- [ ] **Step 1: Service-Funktionen schreiben**

Am Ende von `backend/src/services/dashboard.service.ts` anfügen:

```ts
import {
  DEFAULT_LAYOUT,
  filterLayoutForRole,
  type LayoutItem,
} from "../lib/dashboardWidgets.js";

export async function getDashboardLayout(
  companyId: number,
  userId: number,
  role: string,
): Promise<LayoutItem[]> {
  const row = await prisma.dashboardLayout.findUnique({ where: { userId } });
  const stored = (row?.widgets as LayoutItem[] | undefined) ?? [];
  const base = stored.length > 0 ? stored : DEFAULT_LAYOUT;
  return filterLayoutForRole(base, role);
}

export async function saveDashboardLayout(
  companyId: number,
  userId: number,
  widgets: LayoutItem[],
): Promise<LayoutItem[]> {
  const row = await prisma.dashboardLayout.upsert({
    where: { userId },
    create: { userId, companyId, widgets },
    update: { widgets },
  });
  return row.widgets as LayoutItem[];
}
```

(Der `import` gehört an den Dateikopf zu den übrigen Imports; der Einfachheit halber kann er auch direkt oberhalb der Funktionen stehen — ESM erlaubt Top-Level-Imports nur am Dateianfang, also **verschiebe** die `import`-Zeile zu den anderen Imports oben in der Datei.)

- [ ] **Step 2: Test schreiben**

Create `backend/src/test/dashboard-layout.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { dashboardLayout: { findUnique: mockFindUnique, upsert: mockUpsert } },
}));

import { getDashboardLayout, saveDashboardLayout } from "../services/dashboard.service.js";
import { DEFAULT_LAYOUT } from "../lib/dashboardWidgets.js";

describe("dashboard layout service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns role-filtered default layout when no row exists", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const out = await getDashboardLayout(1, 7, "READONLY");
    expect(out.some((i) => i.key === "kpi-revenue")).toBe(false); // BUCHHALTER-only
    expect(out.some((i) => i.key === "kpi-properties")).toBe(true);
  });

  it("returns stored layout filtered by role", async () => {
    mockFindUnique.mockResolvedValueOnce({
      widgets: [{ key: "roi", x: 0, y: 0, w: 1, h: 1 }, { key: "kpi-tenants", x: 1, y: 0, w: 1, h: 1 }],
    });
    const out = await getDashboardLayout(1, 7, "READONLY");
    expect(out.map((i) => i.key)).toEqual(["kpi-tenants"]);
  });

  it("upserts on save and returns stored widgets", async () => {
    const widgets = [{ key: "kpi-units", x: 0, y: 0, w: 1, h: 1 }];
    mockUpsert.mockResolvedValueOnce({ widgets });
    const out = await saveDashboardLayout(1, 7, widgets);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 7 },
      create: { userId: 7, companyId: 1, widgets },
      update: { widgets },
    });
    expect(out).toEqual(widgets);
  });
});
```

- [ ] **Step 3: Test ausführen**

Run: `cd backend && npx vitest run src/test/dashboard-layout.service.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 4: TypeScript prüfen**

Run: `cd backend && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/dashboard.service.ts backend/src/test/dashboard-layout.service.test.ts
git commit -m "feat(dashboard): Layout laden/speichern Service + Tests"
```

---

## Task 4: Aggregat-Services `revenue-series` + `expiring-certificates` + Tests

**Files:**
- Modify: `backend/src/services/dashboard.service.ts`
- Create: `backend/src/test/dashboard-aggregates.service.test.ts`

**Interfaces:**
- Produces:
  - `getRevenueSeries(companyId: number): Promise<{ month: string; label: string; total: number }[]>` (12 Monate, ältester→neuester)
  - `getExpiringCertificates(companyId: number): Promise<{ id: number; propertyName: string; energyClass: string; validUntil: string }[]>`

- [ ] **Step 1: `getRevenueSeries` schreiben**

An `backend/src/services/dashboard.service.ts` anfügen:

```ts
export async function getRevenueSeries(
  companyId: number,
): Promise<{ month: string; label: string; total: number }[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const txns = await prisma.transaction.findMany({
    where: { companyId, type: "EINNAHME", date: { gte: start } },
    select: { date: true, amount: true },
  });

  const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const buckets: { month: string; label: string; total: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ month: key, label: MONTHS[d.getMonth()], total: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.month, i]));
  for (const tx of txns) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const i = index.get(key);
    if (i !== undefined) buckets[i].total += tx.amount;
  }
  return buckets;
}
```

- [ ] **Step 2: `getExpiringCertificates` schreiben**

An dieselbe Datei anfügen. (Feldnamen aus `EnergyPassport`: `validUntil`, `energyClass`, `propertyId`; das Modell heißt in Prisma `energyPassport` — falls abweichend, per `grep "model EnergyPassport" backend/prisma/schema.prisma` prüfen und Modellnamen anpassen.)

```ts
export async function getExpiringCertificates(
  companyId: number,
): Promise<{ id: number; propertyName: string; energyClass: string; validUntil: string }[]> {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 365); // ablaufend innerhalb 12 Monaten

  const rows = await prisma.energyPassport.findMany({
    where: { property: { companyId }, validUntil: { lte: horizon } },
    orderBy: { validUntil: "asc" },
    take: 10,
    include: { property: { select: { name: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    propertyName: r.property.name,
    energyClass: r.energyClass,
    validUntil: r.validUntil.toISOString(),
  }));
}
```

- [ ] **Step 3: Test schreiben**

Create `backend/src/test/dashboard-aggregates.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTxFindMany } = vi.hoisted(() => ({ mockTxFindMany: vi.fn() }));

vi.mock("../lib/prisma.js", () => ({
  prisma: { transaction: { findMany: mockTxFindMany } },
}));

import { getRevenueSeries } from "../services/dashboard.service.js";

describe("getRevenueSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 12 buckets and sums income into the current month", async () => {
    const now = new Date();
    mockTxFindMany.mockResolvedValueOnce([
      { date: new Date(now.getFullYear(), now.getMonth(), 5), amount: 1000 },
      { date: new Date(now.getFullYear(), now.getMonth(), 20), amount: 500 },
    ]);
    const out = await getRevenueSeries(1);
    expect(out).toHaveLength(12);
    expect(out[11].total).toBe(1500); // aktueller Monat = letzter Bucket
    expect(out[0].total).toBe(0);
  });
});
```

- [ ] **Step 4: Test ausführen**

Run: `cd backend && npx vitest run src/test/dashboard-aggregates.service.test.ts`
Expected: PASS (1 Test).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/dashboard.service.ts backend/src/test/dashboard-aggregates.service.test.ts
git commit -m "feat(dashboard): revenue-series + expiring-certificates Aggregate + Test"
```

---

## Task 5: Controller + Routen (mit Validierung + RBAC)

**Files:**
- Modify: `backend/src/controllers/dashboard.controller.ts`
- Modify: `backend/src/routes/dashboard.routes.ts`

**Interfaces:**
- Consumes: Services aus Task 3+4; `dashboardLayoutSchema` aus `../schemas/dashboard.schema.js`; `validate` aus `../middleware/validate.js`.
- Produces: `GET /dashboard/layout`, `PUT /dashboard/layout`, `GET /dashboard/revenue-series`, `GET /dashboard/expiring-certificates`.

**Hinweis Rolle/User:** `req.user` enthält den JWT-Payload `{ userId, companyId, role }` (siehe `requireAuth`). Falls die Property anders heißt, per `grep "req.user" backend/src` verifizieren.

- [ ] **Step 1: Controller erweitern**

`backend/src/controllers/dashboard.controller.ts` ersetzen durch:

```ts
import type { Request, Response } from "express";
import {
  getDashboardStats,
  getRecentActivity,
  getDashboardLayout,
  saveDashboardLayout,
  getRevenueSeries,
  getExpiringCertificates,
} from "../services/dashboard.service.js";

export async function getStats(req: Request, res: Response): Promise<void> {
  const stats = await getDashboardStats(req.companyId!);
  res.json({ data: stats });
}

export async function getActivity(req: Request, res: Response): Promise<void> {
  const data = await getRecentActivity(req.companyId!);
  res.json({ data });
}

export async function getLayout(req: Request, res: Response): Promise<void> {
  const { userId, role } = req.user!;
  const data = await getDashboardLayout(req.companyId!, userId, role);
  res.json({ data });
}

export async function putLayout(req: Request, res: Response): Promise<void> {
  const { userId } = req.user!;
  const data = await saveDashboardLayout(req.companyId!, userId, req.body.widgets);
  res.json({ data });
}

export async function getRevenue(req: Request, res: Response): Promise<void> {
  const data = await getRevenueSeries(req.companyId!);
  res.json({ data });
}

export async function getCertificates(req: Request, res: Response): Promise<void> {
  const data = await getExpiringCertificates(req.companyId!);
  res.json({ data });
}
```

- [ ] **Step 2: Routen erweitern**

`backend/src/routes/dashboard.routes.ts` ersetzen durch:

```ts
import { Router } from "express";
import * as ctrl from "../controllers/dashboard.controller.js";
import { validate } from "../middleware/validate.js";
import { dashboardLayoutSchema } from "../schemas/dashboard.schema.js";

const router = Router();

router.get("/stats", ctrl.getStats);
router.get("/recent-activity", ctrl.getActivity);
router.get("/layout", ctrl.getLayout);
router.put("/layout", validate({ body: dashboardLayoutSchema }), ctrl.putLayout);
router.get("/revenue-series", ctrl.getRevenue);
router.get("/expiring-certificates", ctrl.getCertificates);

export { router as dashboardRouter };
```

- [ ] **Step 3: TypeScript prüfen**

Run: `cd backend && npx tsc --noEmit`
Expected: Keine Fehler. (Falls `req.user` typseitig unbekannt: `grep -r "declare global" backend/src/types` prüfen; die vorhandene Express-Request-Erweiterung nutzen — nicht neu deklarieren.)

- [ ] **Step 4: Smoke-Test manuell**

Run: `cd backend && npm run dev` (in separatem Terminal), dann mit gültigem Token:
`curl -H "Authorization: Bearer <token>" http://localhost:3001/api/dashboard/layout`
Expected: `{ "data": [ { "key": "kpi-properties", ... }, ... ] }` (Standard-Layout).

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/dashboard.controller.ts backend/src/routes/dashboard.routes.ts
git commit -m "feat(dashboard): Layout- + Aggregat-Routen mit Validierung"
```

---

## Task 6: Frontend-Setup — `react-grid-layout`, CSS, geteilte Typen

**Files:**
- Modify: `cozy-estate-central/package.json` (Dependency)
- Create: `cozy-estate-central/src/components/dashboard/gridStyles.css`
- Create: `cozy-estate-central/src/components/dashboard/types.ts`

**Interfaces:**
- Produces:
  - `type LayoutItem = { key: string; x: number; y: number; w: number; h: number }`
  - `interface WidgetProps { widgetKey: string }`
  - `type WidgetCategory = "basis" | "finanzen" | "vertraege" | "aufgaben" | "energie"`
  - `interface WidgetDefinition { key; title; description; category; icon; component; defaultSize; minSize; maxSize?; requiredRole? }`
  - `GRID_COLS`, `GRID_BREAKPOINTS`, `GRID_ROW_HEIGHT`, `GRID_MARGIN`
  - `canSeeWidget(role: string, def: WidgetDefinition): boolean`

- [ ] **Step 1: Dependency installieren**

Run: `cd cozy-estate-central && npm install react-grid-layout@^1.5.0 && npm install -D @types/react-grid-layout`
Expected: Pakete in `package.json` unter dependencies/devDependencies.

- [ ] **Step 2: Grid-CSS schreiben (Shadcn/Dark-Mode-tauglich)**

Create `cozy-estate-central/src/components/dashboard/gridStyles.css`:

```css
/* react-grid-layout Basis (statt CDN-Import selbst inline, damit CSP passt) */
.react-grid-layout { position: relative; transition: height 200ms ease; }
.react-grid-item { transition: all 200ms ease; transition-property: left, top, width, height; }
.react-grid-item.cssTransforms { transition-property: transform, width, height; }
.react-grid-item.resizing { z-index: 1; will-change: width, height; }
.react-grid-item.react-draggable-dragging { transition: none; z-index: 3; will-change: transform; }
.react-grid-item.react-grid-placeholder {
  background: hsl(var(--primary) / 0.15);
  border: 1px dashed hsl(var(--primary) / 0.5);
  border-radius: 0.75rem;
  transition-duration: 100ms;
  z-index: 2;
}
.react-grid-item > .react-resizable-handle {
  position: absolute; width: 20px; height: 20px; bottom: 0; right: 0; cursor: se-resize;
}
.react-grid-item > .react-resizable-handle::after {
  content: ""; position: absolute; right: 5px; bottom: 5px;
  width: 7px; height: 7px;
  border-right: 2px solid hsl(var(--muted-foreground) / 0.5);
  border-bottom: 2px solid hsl(var(--muted-foreground) / 0.5);
}
/* Resize-Handles nur im Edit-Modus sichtbar */
.dashboard-view .react-resizable-handle { display: none; }
```

- [ ] **Step 3: Geteilte Typen + Konstanten schreiben**

Create `cozy-estate-central/src/components/dashboard/types.ts`:

```ts
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type LayoutItem = { key: string; x: number; y: number; w: number; h: number };

export interface WidgetProps {
  widgetKey: string;
}

export type WidgetCategory = "basis" | "finanzen" | "vertraege" | "aufgaben" | "energie";

export interface WidgetDefinition {
  key: string;
  title: string;
  description: string;
  category: WidgetCategory;
  icon: LucideIcon;
  component: ComponentType<WidgetProps>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  requiredRole?: "BUCHHALTER";
}

export const GRID_COLS = { lg: 4, md: 2, sm: 1 };
export const GRID_BREAKPOINTS = { lg: 1024, md: 640, sm: 0 };
export const GRID_ROW_HEIGHT = 120;
export const GRID_MARGIN: [number, number] = [16, 16];

const RANKS: Record<string, number> = { READONLY: 1, BUCHHALTER: 2, VERWALTER: 3, ADMIN: 4 };

export function roleRank(role: string): number {
  return RANKS[role] ?? 3;
}

export function canSeeWidget(role: string, def: WidgetDefinition): boolean {
  if (!def.requiredRole) return true;
  return roleRank(role) >= RANKS[def.requiredRole];
}
```

- [ ] **Step 4: TypeScript prüfen**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add cozy-estate-central/package.json cozy-estate-central/package-lock.json cozy-estate-central/src/components/dashboard/
git commit -m "feat(dashboard): react-grid-layout Setup + geteilte Widget-Typen"
```

---

## Task 7: Frontend-Datenhooks

**Files:**
- Modify: `cozy-estate-central/src/hooks/api/useDashboard.ts`

**Interfaces:**
- Consumes: `LayoutItem` aus `@/components/dashboard/types`.
- Produces:
  - `useDashboardLayout()` → `{ data?: { data: LayoutItem[] }, isLoading }`
  - `useSaveDashboardLayout()` → Mutation `(widgets: LayoutItem[]) => Promise`
  - `useRevenueSeries()` → `{ data?: { data: RevenuePoint[] } }`, `interface RevenuePoint { month: string; label: string; total: number }`
  - `useExpiringCertificates()` → `{ data?: { data: ExpiringCertificate[] } }`, `interface ExpiringCertificate { id: number; propertyName: string; energyClass: string; validUntil: string }`

- [ ] **Step 1: Hooks anfügen**

Am Ende von `cozy-estate-central/src/hooks/api/useDashboard.ts` anfügen:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LayoutItem } from "@/components/dashboard/types";

// ─── Dashboard Layout ───────────────────────────────────────
export function useDashboardLayout() {
  return useQuery({
    queryKey: ["dashboard", "layout"],
    queryFn: () => api<{ data: LayoutItem[] }>("/dashboard/layout"),
  });
}

export function useSaveDashboardLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgets: LayoutItem[]) =>
      api<{ data: LayoutItem[] }>("/dashboard/layout", { method: "PUT", body: { widgets } }),
    onSuccess: (res) => {
      qc.setQueryData(["dashboard", "layout"], res);
    },
  });
}

// ─── Revenue Series ─────────────────────────────────────────
export interface RevenuePoint {
  month: string;
  label: string;
  total: number;
}

export function useRevenueSeries() {
  return useQuery({
    queryKey: ["dashboard", "revenue-series"],
    queryFn: () => api<{ data: RevenuePoint[] }>("/dashboard/revenue-series"),
  });
}

// ─── Expiring Energy Certificates ───────────────────────────
export interface ExpiringCertificate {
  id: number;
  propertyName: string;
  energyClass: string;
  validUntil: string;
}

export function useExpiringCertificates() {
  return useQuery({
    queryKey: ["dashboard", "expiring-certificates"],
    queryFn: () => api<{ data: ExpiringCertificate[] }>("/dashboard/expiring-certificates"),
  });
}
```

(Die `import { useQuery }`-Zeile existiert bereits oben; die neuen Imports `useMutation, useQueryClient` und der `LayoutItem`-Import gehören an den Dateikopf zu den bestehenden Imports.)

- [ ] **Step 2: TypeScript prüfen**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useDashboard.ts
git commit -m "feat(dashboard): Frontend-Hooks für Layout + Aggregate"
```

---

## Task 8: KPI-Widget + Wrapper für bestehende Komponenten

**Files:**
- Create: `cozy-estate-central/src/components/dashboard/widgets/KpiWidget.tsx`
- Create: `cozy-estate-central/src/components/dashboard/widgets/ExistingWidgets.tsx`

**Interfaces:**
- Consumes: `WidgetProps`; `useDashboardStats`; bestehende `KpiCard`, `PropertyTable`, `QuickActions`, `RecentActivity`.
- Produces: `KpiWidget`, `PropertyTableWidget`, `QuickActionsWidget`, `RecentActivityWidget` (alle `ComponentType<WidgetProps>`).

- [ ] **Step 1: KpiWidget schreiben**

Create `cozy-estate-central/src/components/dashboard/widgets/KpiWidget.tsx`:

```tsx
import { Building2, Users, CreditCard, AlertTriangle, LayoutGrid, Loader2, type LucideIcon } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/api/useDashboard";
import { formatCurrency } from "@/lib/mappings";
import type { WidgetProps } from "../types";

interface Stats {
  properties: number; totalUnits: number; occupiedUnits: number; vacantUnits: number;
  tenants: number; monthlyRevenue: number; openTickets: number;
}

interface KpiConfig {
  title: string;
  icon: LucideIcon;
  value: (s: Stats) => string;
  change: (s: Stats) => string;
  changeType: "positive" | "negative" | "neutral";
  iconBg?: string;
  iconColor?: string;
}

const vacancyRate = (s: Stats) =>
  s.totalUnits > 0 ? Math.round((s.vacantUnits / s.totalUnits) * 1000) / 10 : 0;

const KPI: Record<string, KpiConfig> = {
  "kpi-properties": {
    title: "Immobilien", icon: Building2, changeType: "positive",
    value: (s) => String(s.properties), change: (s) => `${s.totalUnits} Einheiten gesamt`,
  },
  "kpi-tenants": {
    title: "Mieter", icon: Users, changeType: "positive",
    iconBg: "bg-accent/15", iconColor: "text-accent-foreground",
    value: (s) => String(s.tenants), change: (s) => `${s.occupiedUnits} belegte Einheiten`,
  },
  "kpi-revenue": {
    title: "Monatl. Einnahmen", icon: CreditCard, changeType: "positive",
    iconBg: "bg-success/15", iconColor: "text-success",
    value: (s) => formatCurrency(s.monthlyRevenue), change: (s) => `${s.openTickets} offene Tickets`,
  },
  "kpi-vacancy": {
    title: "Leerstand", icon: AlertTriangle, changeType: "negative",
    iconBg: "bg-destructive/10", iconColor: "text-destructive",
    value: (s) => String(s.vacantUnits), change: (s) => `${vacancyRate(s)}% Leerstandsquote`,
  },
  "kpi-units": {
    title: "Einheiten gesamt", icon: LayoutGrid, changeType: "neutral",
    value: (s) => String(s.totalUnits), change: (s) => `${s.occupiedUnits} belegt`,
  },
};

export function KpiWidget({ widgetKey }: WidgetProps) {
  const { data, isLoading } = useDashboardStats();
  const cfg = KPI[widgetKey] ?? KPI["kpi-properties"];
  const stats = data?.data;

  if (isLoading || !stats) {
    return (
      <Card className="h-full border border-border/60 shadow-sm">
        <CardContent className="flex h-full items-center justify-center p-5">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <KpiCard
      title={cfg.title}
      value={cfg.value(stats)}
      change={cfg.change(stats)}
      changeType={cfg.changeType}
      icon={cfg.icon}
      iconBg={cfg.iconBg}
      iconColor={cfg.iconColor}
    />
  );
}
```

- [ ] **Step 2: Wrapper für bestehende Komponenten schreiben**

Create `cozy-estate-central/src/components/dashboard/widgets/ExistingWidgets.tsx`:

```tsx
import { PropertyTable } from "@/components/PropertyTable";
import { QuickActions } from "@/components/QuickActions";
import { RecentActivity } from "@/components/RecentActivity";
import type { WidgetProps } from "../types";

export function PropertyTableWidget(_: WidgetProps) {
  return <PropertyTable />;
}

export function QuickActionsWidget(_: WidgetProps) {
  return <QuickActions />;
}

export function RecentActivityWidget(_: WidgetProps) {
  return <RecentActivity />;
}
```

- [ ] **Step 3: TypeScript prüfen**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add cozy-estate-central/src/components/dashboard/widgets/
git commit -m "feat(dashboard): KPI-Widget + Wrapper für bestehende Komponenten"
```

---

## Task 9: Listen-Primitive + Listen-Adapter-Widgets

Ein generisches `WidgetListPrimitive` (Karte mit Titel, Top-5-Liste, „Alle anzeigen"-Link, Lade-/Leer-Zustand) plus dünne Adapter, die bestehende Hooks anzapfen.

**Files:**
- Create: `cozy-estate-central/src/components/dashboard/widgets/WidgetListPrimitive.tsx`
- Create: `cozy-estate-central/src/components/dashboard/widgets/ListWidgets.tsx`

**Interfaces:**
- Consumes: `useDunning`, `useContracts`, `useInsurancePolicies`, `useMaintenanceSchedules`, `useMaintenanceTickets`, `useCalendarEvents`, `useExpiringCertificates`, `formatCurrency`.
- Produces: `WidgetListPrimitive`; und Adapter `OverdueWidget`, `ExpiringContractsWidget`, `ExpiringInsurancesWidget`, `MaintenanceDueWidget`, `OpenTicketsWidget`, `UpcomingEventsWidget`, `EnergyWidget`.

- [ ] **Step 1: Primitive schreiben**

Create `cozy-estate-central/src/components/dashboard/widgets/WidgetListPrimitive.tsx`:

```tsx
import { Link } from "react-router-dom";
import { Loader2, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ListRow {
  id: string | number;
  primary: string;
  secondary?: string;
  badge?: string;
}

interface Props {
  title: string;
  icon: LucideIcon;
  rows: ListRow[];
  isLoading: boolean;
  linkTo: string;
  emptyText: string;
}

export function WidgetListPrimitive({ title, icon: Icon, rows, isLoading, linkTo, emptyText }: Props) {
  return (
    <Card className="h-full flex flex-col border border-border/60 shadow-sm">
      <CardHeader className="pb-3 flex-row items-center gap-2 space-y-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="font-heading text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyText}</p>
        ) : (
          <>
            {rows.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.primary}</p>
                  {r.secondary && (
                    <p className="text-xs text-muted-foreground truncate">{r.secondary}</p>
                  )}
                </div>
                {r.badge && (
                  <span className="text-xs font-medium text-muted-foreground shrink-0">{r.badge}</span>
                )}
              </div>
            ))}
            <Link to={linkTo} className="block text-xs font-medium text-primary hover:underline pt-1">
              Alle anzeigen →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Adapter-Widgets schreiben**

Create `cozy-estate-central/src/components/dashboard/widgets/ListWidgets.tsx`:

```tsx
import { AlertCircle, FileClock, ShieldAlert, Wrench, Ticket, CalendarClock, Leaf } from "lucide-react";
import { WidgetListPrimitive, type ListRow } from "./WidgetListPrimitive";
import { formatCurrency } from "@/lib/mappings";
import { useDunning } from "@/hooks/api/useDunning";
import { useContracts } from "@/hooks/api/useContracts";
import { useInsurancePolicies } from "@/hooks/api/useInsurance";
import { useMaintenanceSchedules } from "@/hooks/api/useMaintenanceSchedules";
import { useMaintenanceTickets } from "@/hooks/api/useMaintenanceTickets";
import { useCalendarEvents } from "@/hooks/api/useCalendarEvents";
import { useExpiringCertificates } from "@/hooks/api/useDashboard";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("de-DE") : "—";

const daysUntil = (iso?: string | null) =>
  iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : Infinity;

export function OverdueWidget() {
  const { data, isLoading } = useDunning();
  const rows: ListRow[] = (data ?? [])
    .filter((d) => d.status === "OFFEN")
    .map((d) => ({
      id: d.id,
      primary: d.contract?.tenant.name ?? `Vertrag #${d.contractId}`,
      secondary: `${d.contract?.property.name ?? ""} · Mahnstufe ${d.level}`,
      badge: formatCurrency(d.totalAmount),
    }));
  return (
    <WidgetListPrimitive title="Offene Forderungen" icon={AlertCircle} rows={rows}
      isLoading={isLoading} linkTo="/finances" emptyText="Keine offenen Mahnungen." />
  );
}

export function ExpiringContractsWidget() {
  const { data, isLoading } = useContracts();
  const rows: ListRow[] = (data?.data ?? [])
    .filter((c) => c.endDate && daysUntil(c.endDate) <= 90 && daysUntil(c.endDate) >= 0)
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
    .map((c) => ({
      id: c.id,
      primary: c.tenant.name,
      secondary: `${c.property.name} · ${c.unit.number}`,
      badge: fmtDate(c.endDate),
    }));
  return (
    <WidgetListPrimitive title="Auslaufende Verträge" icon={FileClock} rows={rows}
      isLoading={isLoading} linkTo="/contracts" emptyText="Keine Verträge laufen bald aus." />
  );
}

export function ExpiringInsurancesWidget() {
  const { data, isLoading } = useInsurancePolicies();
  const rows: ListRow[] = (data?.data ?? [])
    .filter((p) => p.endDate && daysUntil(p.endDate) <= 90 && daysUntil(p.endDate) >= 0)
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
    .map((p) => ({
      id: p.id,
      primary: p.name,
      secondary: `${p.insurer}${p.property ? ` · ${p.property.name}` : ""}`,
      badge: fmtDate(p.endDate),
    }));
  return (
    <WidgetListPrimitive title="Ablaufende Versicherungen" icon={ShieldAlert} rows={rows}
      isLoading={isLoading} linkTo="/insurances" emptyText="Keine Versicherungen laufen bald aus." />
  );
}

export function MaintenanceDueWidget() {
  const { data, isLoading } = useMaintenanceSchedules();
  const rows: ListRow[] = (data ?? [])
    .filter((m) => m.isActive && daysUntil(m.nextDue) <= 60)
    .sort((a, b) => daysUntil(a.nextDue) - daysUntil(b.nextDue))
    .map((m) => ({
      id: m.id,
      primary: m.title,
      secondary: m.property.name,
      badge: fmtDate(m.nextDue),
    }));
  return (
    <WidgetListPrimitive title="Anstehende Wartung" icon={Wrench} rows={rows}
      isLoading={isLoading} linkTo="/maintenance" emptyText="Keine anstehende Wartung." />
  );
}

export function OpenTicketsWidget() {
  const { data, isLoading } = useMaintenanceTickets();
  const rows: ListRow[] = (data?.data ?? [])
    .filter((t) => t.status !== "ERLEDIGT")
    .sort((a, b) => (a.priority === "DRINGEND" || a.priority === "HOCH" ? -1 : 1))
    .map((t) => ({
      id: t.id,
      primary: t.title,
      secondary: `${t.property.name}${t.unit ? ` · ${t.unit.number}` : ""}`,
      badge: t.priority,
    }));
  return (
    <WidgetListPrimitive title="Offene Tickets" icon={Ticket} rows={rows}
      isLoading={isLoading} linkTo="/maintenance" emptyText="Keine offenen Tickets." />
  );
}

export function UpcomingEventsWidget() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const { data, isLoading } = useCalendarEvents(now, in30);
  const rows: ListRow[] = (data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((e) => ({
      id: e.id,
      primary: e.title,
      secondary: e.description ?? undefined,
      badge: fmtDate(e.start),
    }));
  return (
    <WidgetListPrimitive title="Anstehende Termine" icon={CalendarClock} rows={rows}
      isLoading={isLoading} linkTo="/calendar" emptyText="Keine Termine in den nächsten 30 Tagen." />
  );
}

export function EnergyWidget() {
  const { data, isLoading } = useExpiringCertificates();
  const rows: ListRow[] = (data?.data ?? []).map((c) => ({
    id: c.id,
    primary: c.propertyName,
    secondary: `Energieklasse ${c.energyClass}`,
    badge: fmtDate(c.validUntil),
  }));
  return (
    <WidgetListPrimitive title="Ablaufende Energieausweise" icon={Leaf} rows={rows}
      isLoading={isLoading} linkTo="/energie" emptyText="Keine ablaufenden Energieausweise." />
  );
}
```

**Hinweis Routen-Pfade:** `linkTo`-Ziele (`/finances`, `/contracts`, `/insurances`, `/maintenance`, `/calendar`, `/energie`) gegen `cozy-estate-central/src/App.tsx` prüfen und bei Abweichung anpassen.

- [ ] **Step 3: TypeScript prüfen**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add cozy-estate-central/src/components/dashboard/widgets/
git commit -m "feat(dashboard): Listen-Primitive + 7 Listen-Widgets"
```

---

## Task 10: ROI-Widget + Einnahmen-Chart-Widget

**Files:**
- Create: `cozy-estate-central/src/components/dashboard/widgets/RoiWidget.tsx`
- Create: `cozy-estate-central/src/components/dashboard/widgets/RevenueChartWidget.tsx`

**Interfaces:**
- Consumes: `useRoiData` aus `@/hooks/api/useFinance`; `useRevenueSeries` aus `@/hooks/api/useDashboard`; recharts; `formatCurrency`.
- Produces: `RoiWidget`, `RevenueChartWidget`.

- [ ] **Step 1: ROI-Widget schreiben**

Create `cozy-estate-central/src/components/dashboard/widgets/RoiWidget.tsx`:

```tsx
import { TrendingUp, Loader2 } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { useRoiData } from "@/hooks/api/useFinance";
import { formatCurrency } from "@/lib/mappings";

export function RoiWidget() {
  const year = new Date().getFullYear();
  const { data, isLoading } = useRoiData(year);
  const rows = data?.data ?? [];

  if (isLoading) {
    return (
      <Card className="h-full border border-border/60 shadow-sm">
        <CardContent className="flex h-full items-center justify-center p-5">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const netIncome = rows.reduce((sum, r) => sum + r.netIncome, 0);
  const withYield = rows.filter((r) => r.nettorendite != null);
  const avgYield = withYield.length
    ? withYield.reduce((s, r) => s + (r.nettorendite ?? 0), 0) / withYield.length
    : null;

  return (
    <KpiCard
      title="Rendite (Netto)"
      value={formatCurrency(netIncome)}
      change={avgYield != null ? `⌀ ${avgYield.toFixed(1)}% Nettorendite` : "Kaufpreis/EK erfassen"}
      changeType="positive"
      icon={TrendingUp}
      iconBg="bg-success/15"
      iconColor="text-success"
    />
  );
}
```

- [ ] **Step 2: Chart-Widget schreiben**

Create `cozy-estate-central/src/components/dashboard/widgets/RevenueChartWidget.tsx`:

```tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRevenueSeries } from "@/hooks/api/useDashboard";
import { formatCurrency } from "@/lib/mappings";

export function RevenueChartWidget() {
  const { data, isLoading } = useRevenueSeries();
  const series = data?.data ?? [];

  return (
    <Card className="h-full flex flex-col border border-border/60 shadow-sm">
      <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="font-heading text-base font-semibold">Einnahmen (12 Monate)</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={40}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: TypeScript prüfen**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add cozy-estate-central/src/components/dashboard/widgets/RoiWidget.tsx cozy-estate-central/src/components/dashboard/widgets/RevenueChartWidget.tsx
git commit -m "feat(dashboard): ROI-Kachel + Einnahmen-Chart-Widget"
```

---

## Task 11: Widget-Register + Normalisierung (mit Test)

**Files:**
- Create: `cozy-estate-central/src/components/dashboard/registry.tsx`
- Create: `cozy-estate-central/src/components/dashboard/registry.test.tsx`

**Interfaces:**
- Consumes: alle Widgets aus Tasks 8–10; `WidgetDefinition`, `LayoutItem`, `canSeeWidget` aus `./types`.
- Produces:
  - `WIDGET_REGISTRY: Record<string, WidgetDefinition>`
  - `DEFAULT_LAYOUT: LayoutItem[]` (identisch zum Server-Standard)
  - `getVisibleWidgets(role: string): WidgetDefinition[]`
  - `normalizeLayout(items: LayoutItem[], role: string): LayoutItem[]` (unbekannte/verbotene Keys raus)

- [ ] **Step 1: Register schreiben**

Create `cozy-estate-central/src/components/dashboard/registry.tsx`:

```tsx
import {
  Building2, Users, CreditCard, AlertTriangle, LayoutGrid, TrendingUp, AlertCircle,
  FileClock, ShieldAlert, Wrench, Ticket, CalendarClock, Leaf, Table, Zap, Activity,
} from "lucide-react";
import type { WidgetDefinition, LayoutItem } from "./types";
import { canSeeWidget } from "./types";
import { KpiWidget } from "./widgets/KpiWidget";
import { PropertyTableWidget, QuickActionsWidget, RecentActivityWidget } from "./widgets/ExistingWidgets";
import {
  OverdueWidget, ExpiringContractsWidget, ExpiringInsurancesWidget,
  MaintenanceDueWidget, OpenTicketsWidget, UpcomingEventsWidget, EnergyWidget,
} from "./widgets/ListWidgets";
import { RoiWidget } from "./widgets/RoiWidget";
import { RevenueChartWidget } from "./widgets/RevenueChartWidget";

const KPI = { defaultSize: { w: 1, h: 1 }, minSize: { w: 1, h: 1 }, maxSize: { w: 2, h: 2 } };
const LIST = { defaultSize: { w: 1, h: 2 }, minSize: { w: 1, h: 2 }, maxSize: { w: 2, h: 4 } };

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  "kpi-properties": { key: "kpi-properties", title: "Immobilien", description: "Anzahl Immobilien & Einheiten", category: "basis", icon: Building2, component: KpiWidget, ...KPI },
  "kpi-tenants": { key: "kpi-tenants", title: "Mieter", description: "Anzahl Mieter & belegte Einheiten", category: "basis", icon: Users, component: KpiWidget, ...KPI },
  "kpi-revenue": { key: "kpi-revenue", title: "Monatl. Einnahmen", description: "Summe der monatlichen Mieteinnahmen", category: "finanzen", icon: CreditCard, component: KpiWidget, requiredRole: "BUCHHALTER", ...KPI },
  "kpi-vacancy": { key: "kpi-vacancy", title: "Leerstand", description: "Leerstehende Einheiten & Quote", category: "basis", icon: AlertTriangle, component: KpiWidget, ...KPI },
  "kpi-units": { key: "kpi-units", title: "Einheiten gesamt", description: "Gesamtzahl aller Einheiten", category: "basis", icon: LayoutGrid, component: KpiWidget, ...KPI },
  "roi": { key: "roi", title: "Rendite / ROI", description: "Netto-Ertrag & Nettorendite", category: "finanzen", icon: TrendingUp, component: RoiWidget, requiredRole: "BUCHHALTER", ...KPI },
  "revenue-chart": { key: "revenue-chart", title: "Einnahmen-Verlauf", description: "Einnahmen der letzten 12 Monate", category: "finanzen", icon: Activity, component: RevenueChartWidget, requiredRole: "BUCHHALTER", defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  "overdue": { key: "overdue", title: "Offene Forderungen", description: "Überfällige Mieten / Mahnwesen", category: "finanzen", icon: AlertCircle, component: OverdueWidget, requiredRole: "BUCHHALTER", ...LIST },
  "expiring-contracts": { key: "expiring-contracts", title: "Auslaufende Verträge", description: "Verträge, die < 90 Tage enden", category: "vertraege", icon: FileClock, component: ExpiringContractsWidget, ...LIST },
  "expiring-insurances": { key: "expiring-insurances", title: "Ablaufende Versicherungen", description: "Policen, die bald enden", category: "vertraege", icon: ShieldAlert, component: ExpiringInsurancesWidget, ...LIST },
  "maintenance-due": { key: "maintenance-due", title: "Anstehende Wartung", description: "Fällige Wartungstermine", category: "vertraege", icon: Wrench, component: MaintenanceDueWidget, ...LIST },
  "open-tickets": { key: "open-tickets", title: "Offene Tickets", description: "Offene & dringende Tickets", category: "aufgaben", icon: Ticket, component: OpenTicketsWidget, ...LIST },
  "upcoming-events": { key: "upcoming-events", title: "Anstehende Termine", description: "Termine der nächsten 30 Tage", category: "aufgaben", icon: CalendarClock, component: UpcomingEventsWidget, ...LIST },
  "energy": { key: "energy", title: "Ablaufende Energieausweise", description: "Energieausweise mit naher Frist", category: "energie", icon: Leaf, component: EnergyWidget, ...LIST },
  "property-table": { key: "property-table", title: "Immobilien-Tabelle", description: "Übersicht aller Immobilien", category: "basis", icon: Table, component: PropertyTableWidget, defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 3 }, maxSize: { w: 4, h: 6 } },
  "quick-actions": { key: "quick-actions", title: "Schnellaktionen", description: "Häufige Aktionen", category: "basis", icon: Zap, component: QuickActionsWidget, requiredRole: "BUCHHALTER", ...KPI },
  "recent-activity": { key: "recent-activity", title: "Letzte Aktivität", description: "Neueste Ereignisse", category: "basis", icon: Activity, component: RecentActivityWidget, ...LIST },
};

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { key: "kpi-properties",  x: 0, y: 0, w: 1, h: 1 },
  { key: "kpi-tenants",     x: 1, y: 0, w: 1, h: 1 },
  { key: "kpi-revenue",     x: 2, y: 0, w: 1, h: 1 },
  { key: "kpi-vacancy",     x: 3, y: 0, w: 1, h: 1 },
  { key: "property-table",  x: 0, y: 1, w: 3, h: 4 },
  { key: "quick-actions",   x: 3, y: 1, w: 1, h: 1 },
  { key: "recent-activity", x: 3, y: 2, w: 1, h: 3 },
];

export function getVisibleWidgets(role: string): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter((def) => canSeeWidget(role, def));
}

export function normalizeLayout(items: LayoutItem[], role: string): LayoutItem[] {
  return items.filter((it) => {
    const def = WIDGET_REGISTRY[it.key];
    return def && canSeeWidget(role, def);
  });
}
```

- [ ] **Step 2: Register-Test schreiben**

Create `cozy-estate-central/src/components/dashboard/registry.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { WIDGET_REGISTRY, DEFAULT_LAYOUT, normalizeLayout, getVisibleWidgets } from "./registry";

describe("widget registry", () => {
  it("every registry key matches its definition key and has a component", () => {
    for (const [key, def] of Object.entries(WIDGET_REGISTRY)) {
      expect(def.key).toBe(key);
      expect(def.component).toBeTypeOf("function");
    }
  });

  it("default layout keys all exist in the registry", () => {
    for (const item of DEFAULT_LAYOUT) {
      expect(WIDGET_REGISTRY[item.key]).toBeDefined();
    }
  });

  it("normalizeLayout drops unknown and role-forbidden keys", () => {
    const input = [
      { key: "kpi-properties", x: 0, y: 0, w: 1, h: 1 },
      { key: "roi", x: 1, y: 0, w: 1, h: 1 },
      { key: "ghost", x: 2, y: 0, w: 1, h: 1 },
    ];
    expect(normalizeLayout(input, "READONLY").map((i) => i.key)).toEqual(["kpi-properties"]);
    expect(normalizeLayout(input, "ADMIN").map((i) => i.key)).toEqual(["kpi-properties", "roi"]);
  });

  it("READONLY does not see finance widgets in the library", () => {
    const keys = getVisibleWidgets("READONLY").map((d) => d.key);
    expect(keys).not.toContain("roi");
    expect(keys).toContain("expiring-contracts");
  });
});
```

- [ ] **Step 3: Test ausführen**

Run: `cd cozy-estate-central && npx vitest run src/components/dashboard/registry.test.tsx`
Expected: PASS (4 Tests).

- [ ] **Step 4: Commit**

```bash
git add cozy-estate-central/src/components/dashboard/registry.tsx cozy-estate-central/src/components/dashboard/registry.test.tsx
git commit -m "feat(dashboard): Widget-Register + Normalisierung + Tests"
```

---

## Task 12: DashboardGrid + WidgetRenderer

**Files:**
- Create: `cozy-estate-central/src/components/dashboard/WidgetRenderer.tsx`
- Create: `cozy-estate-central/src/components/dashboard/DashboardGrid.tsx`

**Interfaces:**
- Consumes: `WIDGET_REGISTRY`, `LayoutItem`, Grid-Konstanten, `react-grid-layout`.
- Produces:
  - `WidgetRenderer({ widgetKey }: { widgetKey: string })`
  - `DashboardGrid({ items, editMode, onLayoutChange, onRemove })` mit
    `onLayoutChange(items: LayoutItem[]): void`, `onRemove(key: string): void`.

- [ ] **Step 1: WidgetRenderer schreiben**

Create `cozy-estate-central/src/components/dashboard/WidgetRenderer.tsx`:

```tsx
import { WIDGET_REGISTRY } from "./registry";

export function WidgetRenderer({ widgetKey }: { widgetKey: string }) {
  const def = WIDGET_REGISTRY[widgetKey];
  if (!def) return null;
  const Component = def.component;
  return <Component widgetKey={widgetKey} />;
}
```

- [ ] **Step 2: DashboardGrid schreiben**

Create `cozy-estate-central/src/components/dashboard/DashboardGrid.tsx`:

```tsx
import { useState } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import { GripVertical, X } from "lucide-react";
import { WidgetRenderer } from "./WidgetRenderer";
import { WIDGET_REGISTRY } from "./registry";
import {
  GRID_COLS, GRID_BREAKPOINTS, GRID_ROW_HEIGHT, GRID_MARGIN, type LayoutItem,
} from "./types";
import "./gridStyles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Props {
  items: LayoutItem[];
  editMode: boolean;
  onLayoutChange: (items: LayoutItem[]) => void;
  onRemove: (key: string) => void;
}

export function DashboardGrid({ items, editMode, onLayoutChange, onRemove }: Props) {
  const [breakpoint, setBreakpoint] = useState<string>("lg");

  const rglLayout: Layout[] = items.map((it) => {
    const def = WIDGET_REGISTRY[it.key];
    return {
      i: it.key, x: it.x, y: it.y, w: it.w, h: it.h,
      minW: def?.minSize.w, minH: def?.minSize.h,
      maxW: def?.maxSize?.w, maxH: def?.maxSize?.h,
    };
  });

  const canEdit = editMode && breakpoint === "lg";

  return (
    <div className={editMode ? "dashboard-edit" : "dashboard-view"}>
      <ResponsiveGridLayout
        layouts={{ lg: rglLayout }}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        margin={GRID_MARGIN}
        isDraggable={canEdit}
        isResizable={canEdit}
        draggableHandle=".widget-drag-handle"
        onBreakpointChange={setBreakpoint}
        onLayoutChange={(current) => {
          if (!canEdit) return;
          onLayoutChange(current.map((l) => ({ key: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
        }}
      >
        {items.map((it) => (
          <div key={it.key} className="relative">
            {editMode && (
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between rounded-t-xl bg-muted/80 px-2 py-1 backdrop-blur">
                <button
                  type="button"
                  aria-label={`${WIDGET_REGISTRY[it.key]?.title ?? it.key} verschieben`}
                  className="widget-drag-handle cursor-move text-muted-foreground hover:text-foreground"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`${WIDGET_REGISTRY[it.key]?.title ?? it.key} entfernen`}
                  onClick={() => onRemove(it.key)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className={`h-full ${editMode ? "pt-7" : ""}`}>
              <WidgetRenderer widgetKey={it.key} />
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript prüfen**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add cozy-estate-central/src/components/dashboard/WidgetRenderer.tsx cozy-estate-central/src/components/dashboard/DashboardGrid.tsx
git commit -m "feat(dashboard): DashboardGrid (react-grid-layout) + WidgetRenderer"
```

---

## Task 13: Widget-Bibliothek (Sheet zum Hinzufügen)

**Files:**
- Create: `cozy-estate-central/src/components/dashboard/WidgetLibrary.tsx`

**Interfaces:**
- Consumes: `getVisibleWidgets`, `WidgetDefinition`, Shadcn `Sheet`.
- Produces: `WidgetLibrary({ open, onOpenChange, role, activeKeys, onAdd })` mit `onAdd(key: string): void`, `activeKeys: string[]`.

- [ ] **Step 1: Bibliothek schreiben**

Create `cozy-estate-central/src/components/dashboard/WidgetLibrary.tsx`:

```tsx
import { Check, Plus } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { getVisibleWidgets } from "./registry";
import type { WidgetCategory } from "./types";

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  basis: "Basis",
  finanzen: "Finanzen",
  vertraege: "Verträge & Fristen",
  aufgaben: "Aufgaben & Termine",
  energie: "Energie",
};

const ORDER: WidgetCategory[] = ["basis", "finanzen", "vertraege", "aufgaben", "energie"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  activeKeys: string[];
  onAdd: (key: string) => void;
}

export function WidgetLibrary({ open, onOpenChange, role, activeKeys, onAdd }: Props) {
  const widgets = getVisibleWidgets(role);
  const active = new Set(activeKeys);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-auto">
        <SheetHeader>
          <SheetTitle>Widget hinzufügen</SheetTitle>
          <SheetDescription>Wähle Kacheln für dein Dashboard.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {ORDER.map((cat) => {
            const inCat = widgets.filter((w) => w.category === cat);
            if (inCat.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="space-y-2">
                  {inCat.map((w) => {
                    const isActive = active.has(w.key);
                    const Icon = w.icon;
                    return (
                      <button
                        key={w.key}
                        type="button"
                        disabled={isActive}
                        onClick={() => onAdd(w.key)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{w.title}</p>
                          <p className="text-xs text-muted-foreground">{w.description}</p>
                        </div>
                        {isActive ? (
                          <Check className="h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Sheet-Komponente prüfen**

Run: `cd cozy-estate-central && ls src/components/ui/sheet.tsx`
Expected: Datei existiert. (Falls nicht: `npx shadcn@latest add sheet`.)

- [ ] **Step 3: TypeScript prüfen**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add cozy-estate-central/src/components/dashboard/WidgetLibrary.tsx
git commit -m "feat(dashboard): Widget-Bibliothek (Sheet)"
```

---

## Task 14: Dashboard-Integration in `Index.tsx` (Edit-Modus)

**Files:**
- Modify: `cozy-estate-central/src/pages/Index.tsx`

**Interfaces:**
- Consumes: `useDashboardLayout`, `useSaveDashboardLayout` (Task 7); `DashboardGrid`, `WidgetLibrary`, `WIDGET_REGISTRY`, `DEFAULT_LAYOUT`, `normalizeLayout`; Shadcn `Button`.

- [ ] **Step 1: Index.tsx neu schreiben (Setup-Warnungen bleiben erhalten, KPI/Grid → Widget-System)**

`cozy-estate-central/src/pages/Index.tsx` ersetzen durch:

```tsx
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, RotateCcw, Save, X } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { WidgetLibrary } from "@/components/dashboard/WidgetLibrary";
import { WIDGET_REGISTRY, DEFAULT_LAYOUT, normalizeLayout } from "@/components/dashboard/registry";
import type { LayoutItem } from "@/components/dashboard/types";
import { useDashboardStats, useDashboardLayout, useSaveDashboardLayout } from "@/hooks/api/useDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user } = useAuth();
  const role = user?.role ?? "READONLY";
  const { toast } = useToast();
  const firstName = user?.name?.split(" ")[0] ?? "User";

  const { data: statsRes } = useDashboardStats();
  const stats = statsRes?.data;

  const { data: layoutRes, isLoading } = useDashboardLayout();
  const saveLayout = useSaveDashboardLayout();

  const [editMode, setEditMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [draft, setDraft] = useState<LayoutItem[]>([]);
  const [saved, setSaved] = useState<LayoutItem[]>([]);

  useEffect(() => {
    if (layoutRes?.data) {
      const norm = normalizeLayout(layoutRes.data, role);
      setSaved(norm);
      setDraft(norm);
    }
  }, [layoutRes, role]);

  const items = editMode ? draft : saved;

  const startEdit = () => { setDraft(saved); setEditMode(true); };
  const cancelEdit = () => { setDraft(saved); setEditMode(false); };

  const handleSave = async () => {
    try {
      const res = await saveLayout.mutateAsync(draft);
      const norm = normalizeLayout(res.data, role);
      setSaved(norm);
      setEditMode(false);
      toast({ title: "Dashboard gespeichert" });
    } catch {
      toast({ title: "Speichern fehlgeschlagen", variant: "destructive" });
    }
  };

  const resetDefault = () => setDraft(normalizeLayout(DEFAULT_LAYOUT, role));

  const addWidget = (key: string) => {
    if (draft.some((d) => d.key === key)) return;
    const def = WIDGET_REGISTRY[key];
    setDraft([{ key, x: 0, y: 0, w: def.defaultSize.w, h: def.defaultSize.h }, ...draft]);
    setLibraryOpen(false);
  };

  const removeWidget = (key: string) => setDraft(draft.filter((d) => d.key !== key));

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Willkommen zurück, {firstName}</p>
        </div>
        {editMode ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Widget
            </Button>
            <Button variant="outline" size="sm" onClick={resetDefault}>
              <RotateCcw className="h-4 w-4 mr-1" /> Standard
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4 mr-1" /> Abbrechen
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveLayout.isPending}>
              <Save className="h-4 w-4 mr-1" /> Speichern
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Dashboard anpassen
          </Button>
        )}
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {user?.role === "ADMIN" && stats?.setupStatus &&
          (!stats.setupStatus.smtpSet || !stats.setupStatus.nordigenSet || !stats.setupStatus.anthropicSet) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-sm">Systemkonfiguration unvollständig</h3>
            </div>
            <ul className="text-xs text-amber-700 list-disc list-inside space-y-1">
              {!stats.setupStatus.smtpSet && (
                <li><strong>E-Mail (SMTP):</strong> Passwort-Resets und Benachrichtigungen sind deaktiviert.</li>
              )}
              {!stats.setupStatus.nordigenSet && (
                <li><strong>Bank-Schnittstelle:</strong> Automatische Synchronisierung mit Bankkonten ist nicht möglich.</li>
              )}
              {!stats.setupStatus.anthropicSet && (
                <li><strong>KI-Funktionen:</strong> Beleg-Scan und intelligente E-Mail-Analyse sind deaktiviert.</li>
              )}
            </ul>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Dein Dashboard ist leer.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { if (!editMode) startEdit(); setLibraryOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Widget hinzufügen
              </Button>
              <Button size="sm" variant="outline" onClick={() => { if (!editMode) startEdit(); resetDefault(); }}>
                <RotateCcw className="h-4 w-4 mr-1" /> Standard wiederherstellen
              </Button>
            </div>
          </div>
        ) : (
          <DashboardGrid
            items={items}
            editMode={editMode}
            onLayoutChange={setDraft}
            onRemove={removeWidget}
          />
        )}
      </main>

      <WidgetLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        role={role}
        activeKeys={draft.map((d) => d.key)}
        onAdd={addWidget}
      />
    </div>
  );
};

export default Index;
```

- [ ] **Step 2: TypeScript prüfen**

Run: `cd cozy-estate-central && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 3: Frontend-Tests + Build ausführen**

Run: `cd cozy-estate-central && npm test && npm run build`
Expected: Tests grün, Build erfolgreich.

- [ ] **Step 4: Manuell im Browser prüfen**

Backend (`npm run dev` in `backend/`) + Frontend (`npm run dev` in `cozy-estate-central/`) starten, einloggen (admin@immoverwalt.de / Admin123!). Verifizieren:
1. Dashboard lädt mit Standard-Widgets.
2. „Dashboard anpassen" → Drag-Handles + X erscheinen, Widgets lassen sich verschieben/resizen.
3. „+ Widget" öffnet Bibliothek; ein neues Widget (z.B. „Offene Tickets") hinzufügen.
4. „Speichern" → Toast; Seite neu laden → Layout bleibt erhalten.
5. Alle Widgets entfernen + speichern → Empty-State; „Standard wiederherstellen" funktioniert.

- [ ] **Step 5: Commit**

```bash
git add cozy-estate-central/src/pages/Index.tsx
git commit -m "feat(dashboard): anpassbares Widget-Dashboard mit Edit-Modus"
```

---

## Task 15: Projektdokumentation aktualisieren

**Files:**
- Modify: `PROJEKTDOKUMENTATION.md`
- Modify: `CLAUDE.md` (Status-Zeile)

- [ ] **Step 1: PROJEKTDOKUMENTATION.md ergänzen**

Einen Abschnitt zum anpassbaren Dashboard hinzufügen: neue Tabelle `DashboardLayout` (pro Nutzer, `widgets` JSON), Endpunkte `GET/PUT /dashboard/layout`, `GET /dashboard/revenue-series`, `GET /dashboard/expiring-certificates`, Frontend-Widget-System (`src/components/dashboard/`), Register als Quelle der Wahrheit, react-grid-layout, Rollen-Filterung.

- [ ] **Step 2: CLAUDE.md Status ergänzen**

In „Aktueller Status" eine Zeile anfügen:
`- Anpassbares Dashboard: Abgeschlossen - pro Nutzer konfigurierbares Widget-System (react-grid-layout), GET/PUT /dashboard/layout, neue Widgets (Rendite, Fristen, Aufgaben, Energie)`

- [ ] **Step 3: Commit**

```bash
git add PROJEKTDOKUMENTATION.md CLAUDE.md
git commit -m "docs: anpassbares Dashboard in Projektdoku + CLAUDE.md"
```

---

## Self-Review (vom Autor durchgeführt)

- **Spec-Abdeckung:** Widgets an/aus (Task 13 Bibliothek + Task 14 remove) ✓; Reihenfolge & Größe (Task 12 Grid) ✓; neue Kennzahlen (Tasks 8–10, alle 4 Katalog-Kategorien) ✓; Persistenz pro Nutzer (Tasks 1,3,7) ✓; Rollen-Filter FE+BE (Tasks 2,3,6,11) ✓; Standard-Layout-Fallback (Tasks 2,3,11) ✓; Robustheit gg. unbekannte Keys (`normalizeLayout` / `filterLayoutForRole`) ✓; Empty-State + Reset (Task 14) ✓; responsiv (Task 12 Breakpoints) ✓; Barrierefreiheit Drag-Handle `aria-label` (Task 12) ✓.
- **Energie-Widget:** Spec-Katalog verlangte Energie; da bestehende Hooks property-gebunden sind, neuer Aggregat-Endpunkt `expiring-certificates` (Task 4) — bewusste, dokumentierte Abweichung.
- **Typkonsistenz:** `LayoutItem` FE+BE identisch; `WidgetProps.widgetKey` überall; Register-Keys == kanonische Keyliste (durch Test in Task 11 abgesichert).
- **Offene Verifikationspunkte für den Umsetzer:** `req.user`-Property-Name (Task 5), Prisma-Modellname `energyPassport` (Task 4), Routen-Pfade der `linkTo`-Ziele (Task 9), Existenz `ui/sheet.tsx` (Task 13) — jeweils mit Prüfbefehl im Task vermerkt.
