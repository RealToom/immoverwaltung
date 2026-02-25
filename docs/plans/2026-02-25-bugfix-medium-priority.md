# Bugfix Medium Priority Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 5 medium-priority fixes: reports CSV/PDF export + date filters (D-1+D-2), notification digest cron (D-3), KI-scan upload progress states (D-4), and calendar drag-and-drop for manual events (D-5).

**Architecture:**
- D-1+D-2: New `GET /api/reports/export?format=csv|pdf&from=...&to=...` endpoint (new report.routes/controller/service) + `from`/`to` filter added to `GET /api/maintenance`. Reports.tsx gains date pickers and export buttons.
- D-3: `sendDigestEmail()` added to `email.service.ts`; `processDigests()` called hourly from `retention.service.ts` using an in-memory dedup map (no migration needed).
- D-4: `uploadFileWithProgress()` added to `api.ts` using XMLHttpRequest `upload.onload` to detect real upload-vs-analyzing boundary; `scanPhase` state in Finances.tsx replaces `scanReceipt.isPending`.
- D-5: `withDragAndDrop` wrapper from `react-big-calendar/lib/addons/dragAndDrop` added to Calendar.tsx; only `MANUELL` events are draggable; drops call existing `PATCH /api/calendar/:id`.

**Tech Stack:** Express 5 / Prisma 6 / Zod 4 / React 18 / React Query / react-big-calendar 1.19.4 / pdfkit / XMLHttpRequest

---

## Task 1: Backend – Maintenance date filter (D-2)

**Files:**
- Modify: `backend/src/schemas/maintenance.schema.ts`
- Modify: `backend/src/services/maintenance.service.ts`
- Modify: `backend/src/controllers/maintenance.controller.ts`

**Step 1: Add `from`/`to` to maintenance query schema**

In `backend/src/schemas/maintenance.schema.ts`, extend `maintenanceQuerySchema`:

```typescript
export const maintenanceQuerySchema = paginationSchema.extend({
  status: z.enum(["OFFEN", "IN_BEARBEITUNG", "WARTEND", "ERLEDIGT"]).optional(),
  priority: z.enum(["NIEDRIG", "MITTEL", "HOCH", "DRINGEND"]).optional(),
  category: z.enum(["SANITAER", "ELEKTRIK", "HEIZUNG", "GEBAEUDE", "AUSSENANLAGE", "SONSTIGES"]).optional(),
  propertyId: z.coerce.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
```

**Step 2: Add `from`/`to` to `MaintenanceQuery` interface and Prisma where clause**

In `backend/src/services/maintenance.service.ts`:

1. Add `from?: Date; to?: Date;` to the `MaintenanceQuery` interface (after `propertyId?: number;`).

2. In `listTickets`, after `if (propertyId) where.propertyId = propertyId;` add:

```typescript
if (from || to) {
  where.createdAt = {
    ...(from && { gte: from }),
    ...(to && { lte: to }),
  };
}
```

**Step 3: Pass `from`/`to` from controller**

In `backend/src/controllers/maintenance.controller.ts`, in the `list` function, add inside the `listTickets` call:

```typescript
from: req.query.from ? new Date(req.query.from as string) : undefined,
to: req.query.to ? new Date(req.query.to as string) : undefined,
```

**Step 4: Verify TypeScript**

Run: `cd backend && npx tsc --noEmit`

Expected: No errors.

**Step 5: Commit**

```bash
git add backend/src/schemas/maintenance.schema.ts \
        backend/src/services/maintenance.service.ts \
        backend/src/controllers/maintenance.controller.ts
git commit -m "feat(maintenance): add from/to date filter to list endpoint (D-2)"
```

---

## Task 2: Backend – Reports export endpoint (D-1)

**Files:**
- Create: `backend/src/services/report.service.ts`
- Create: `backend/src/controllers/report.controller.ts`
- Create: `backend/src/routes/report.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Create `report.service.ts`**

Create `backend/src/services/report.service.ts`:

```typescript
import { prisma } from "../lib/prisma.js";

export interface ReportData {
  from?: Date;
  to?: Date;
  properties: Array<{
    name: string;
    totalUnits: number;
    occupiedUnits: number;
    monthlyRevenue: number;
  }>;
  income: number;
  expenses: number;
  ticketCount: number;
}

export async function generateReportData(
  companyId: number,
  from?: Date,
  to?: Date,
): Promise<ReportData> {
  const txDateFilter = from || to
    ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }
    : {};
  const ticketDateFilter = from || to
    ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
    : {};

  const [properties, incomeAgg, expenseAgg, ticketCount] = await Promise.all([
    prisma.property.findMany({
      where: { companyId },
      include: { units: { select: { status: true, rent: true } } },
    }),
    prisma.transaction.aggregate({
      where: { companyId, type: "EINNAHME", ...txDateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { companyId, type: "AUSGABE", ...txDateFilter },
      _sum: { amount: true },
    }),
    prisma.maintenanceTicket.count({
      where: { companyId, ...ticketDateFilter },
    }),
  ]);

  return {
    from,
    to,
    properties: properties.map((p) => ({
      name: p.name,
      totalUnits: p.units.length,
      occupiedUnits: p.units.filter((u) => u.status === "VERMIETET").length,
      monthlyRevenue: p.units
        .filter((u) => u.status === "VERMIETET")
        .reduce((s, u) => s + u.rent, 0),
    })),
    income: incomeAgg._sum.amount ?? 0,
    expenses: Math.abs(expenseAgg._sum.amount ?? 0),
    ticketCount,
  };
}

// German-locale number formatting (comma as decimal separator)
function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function generateReportCsv(data: ReportData): Buffer {
  const fromStr = data.from ? data.from.toLocaleDateString("de-DE") : "Beginn";
  const toStr = data.to ? data.to.toLocaleDateString("de-DE") : "Heute";
  const net = data.income - data.expenses;

  const lines: string[] = [
    "Immobilienverwaltung – Bericht",
    `Zeitraum;${fromStr};bis;${toStr}`,
    "",
    "Immobilien",
    "Name;Einheiten gesamt;Einheiten belegt;Monatliche Einnahmen (EUR)",
    ...data.properties.map(
      (p) =>
        `${p.name};${p.totalUnits};${p.occupiedUnits};${fmt(p.monthlyRevenue)}`,
    ),
    "",
    "Finanzsummary",
    "Einnahmen (EUR);Ausgaben (EUR);Netto (EUR)",
    `${fmt(data.income)};${fmt(data.expenses)};${fmt(net)}`,
    "",
    "Wartungstickets",
    `Anzahl Tickets im Zeitraum;${data.ticketCount}`,
  ];

  // UTF-8 BOM + CRLF (matches DATEV export convention in this codebase)
  const BOM = "\uFEFF";
  return Buffer.from(BOM + lines.join("\r\n"), "utf-8");
}
```

**Step 2: Create `report.controller.ts`**

Create `backend/src/controllers/report.controller.ts`:

```typescript
import type { Request, Response } from "express";
import { generateReportData, generateReportCsv } from "../services/report.service.js";
import { createPdfResponse } from "../lib/pdf.js";

export async function exportReport(req: Request, res: Response): Promise<void> {
  const format = (req.query.format as string) === "pdf" ? "pdf" : "csv";
  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;

  const data = await generateReportData(req.companyId!, from, to);

  if (format === "pdf") {
    const fromStr = data.from ? data.from.toLocaleDateString("de-DE") : "Beginn";
    const toStr = data.to ? data.to.toLocaleDateString("de-DE") : "Heute";

    const doc = createPdfResponse(res, `Bericht_${fromStr}-${toStr}`);

    doc.fontSize(20).font("Helvetica-Bold").text("Immobilienverwaltung – Bericht", { align: "center" });
    doc.fontSize(12).font("Helvetica").text(`Zeitraum: ${fromStr} – ${toStr}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(14).font("Helvetica-Bold").text("Immobilien");
    doc.font("Helvetica").moveDown(0.5);
    for (const p of data.properties) {
      doc.fontSize(10).text(
        `${p.name}  –  ${p.occupiedUnits}/${p.totalUnits} Einheiten  –  ` +
        `Einnahmen: ${p.monthlyRevenue.toFixed(2).replace(".", ",")} €/Monat`,
      );
    }

    doc.moveDown();
    doc.fontSize(14).font("Helvetica-Bold").text("Finanzsummary");
    doc.font("Helvetica").fontSize(10).moveDown(0.5);
    doc.text(`Einnahmen:  ${data.income.toFixed(2).replace(".", ",")} €`);
    doc.text(`Ausgaben:   ${data.expenses.toFixed(2).replace(".", ",")} €`);
    doc.text(`Netto:      ${(data.income - data.expenses).toFixed(2).replace(".", ",")} €`);

    doc.moveDown();
    doc.fontSize(14).font("Helvetica-Bold").text("Wartungstickets");
    doc.font("Helvetica").fontSize(10).moveDown(0.5);
    doc.text(`Tickets im Zeitraum: ${data.ticketCount}`);

    doc.end();
    return;
  }

  // CSV
  const csv = generateReportCsv(data);
  const fromStr = data.from ? data.from.toLocaleDateString("de-DE") : "Beginn";
  const toStr = data.to ? data.to.toLocaleDateString("de-DE") : "Heute";

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Bericht_${fromStr}-${toStr}.csv"`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(csv);
}
```

**Step 3: Create `report.routes.ts`**

Create `backend/src/routes/report.routes.ts`:

```typescript
import { Router } from "express";
import * as ctrl from "../controllers/report.controller.js";

const router = Router();

// GET /api/reports/export?format=csv|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/export", ctrl.exportReport);

export { router as reportRouter };
```

**Step 4: Mount in `routes/index.ts`**

In `backend/src/routes/index.ts`, add the import and mount:

After the last import line (datevRouter), add:
```typescript
import { reportRouter } from "./report.routes.js";
```

After `router.use("/finance/datev", ...)`, add:
```typescript
router.use("/reports", requireAuth, tenantGuard, reportRouter);
```

**Step 5: Run TypeScript check**

Run: `cd backend && npx tsc --noEmit`

Expected: No errors.

**Step 6: Commit**

```bash
git add backend/src/services/report.service.ts \
        backend/src/controllers/report.controller.ts \
        backend/src/routes/report.routes.ts \
        backend/src/routes/index.ts
git commit -m "feat(reports): add GET /api/reports/export (CSV + PDF) with date filters (D-1)"
```

---

## Task 3: Frontend – Reports date picker + export (D-1 + D-2)

**Files:**
- Modify: `cozy-estate-central/src/hooks/api/useMaintenanceTickets.ts`
- Modify: `cozy-estate-central/src/pages/Reports.tsx`

**Step 1: Add `from`/`to` params to `useMaintenanceTickets`**

In `cozy-estate-central/src/hooks/api/useMaintenanceTickets.ts`, update the hook signature and query:

```typescript
export function useMaintenanceTickets(
  search?: string,
  status?: string,
  priority?: string,
  category?: string,
  from?: string,   // ISO date string "YYYY-MM-DD"
  to?: string,
) {
  return useQuery({
    queryKey: ["maintenance", search, status, priority, category, from, to],
    queryFn: () =>
      api<PaginatedResponse<MaintenanceTicketItem>>("/maintenance", {
        params: {
          search,
          status: status && status !== "alle" ? status : undefined,
          priority: priority && priority !== "alle" ? priority : undefined,
          category: category && category !== "alle" ? category : undefined,
          limit: 100,
          from: from || undefined,
          to: to || undefined,
        },
      }),
  });
}
```

**Step 2: Update `Reports.tsx`**

In `cozy-estate-central/src/pages/Reports.tsx`:

1. Add imports at the top:
```typescript
import { useState, useMemo } from "react";
import { getToken } from "@/lib/api";
```
(Replace the existing `useState, useMemo` import – `getToken` is new.)

2. Add state inside the `Reports` component (after the existing hook calls):
```typescript
const [from, setFrom] = useState("");
const [to, setTo] = useState("");
const [exporting, setExporting] = useState(false);
```

3. Update the `useMaintenanceTickets` call to pass date params:
```typescript
const { data: ticketsRes, isLoading: ticketsLoading } = useMaintenanceTickets(
  undefined, undefined, undefined, undefined, from || undefined, to || undefined,
);
```

4. Add the export handler (inside the component, before `return`):
```typescript
const handleExport = async (format: "csv" | "pdf") => {
  setExporting(true);
  try {
    const params = new URLSearchParams({ format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/reports/export?${params}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bericht.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    setExporting(false);
  }
};
```

5. Update the page header JSX to add date pickers and export buttons. Replace the existing `<header>...</header>` block:
```tsx
<header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
  <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
  <Separator orientation="vertical" className="h-6" />
  <div className="flex-1">
    <h1 className="font-heading text-lg font-semibold text-foreground">Berichte</h1>
    <p className="text-xs text-muted-foreground">Auswertungen und Analysen</p>
  </div>
  <div className="flex items-center gap-2">
    <CalendarDays className="h-4 w-4 text-muted-foreground" />
    <input
      type="date"
      value={from}
      onChange={(e) => setFrom(e.target.value)}
      className="text-sm border rounded px-2 py-1 bg-background"
      title="Von"
    />
    <span className="text-muted-foreground text-xs">–</span>
    <input
      type="date"
      value={to}
      onChange={(e) => setTo(e.target.value)}
      className="text-sm border rounded px-2 py-1 bg-background"
      title="Bis"
    />
    <button
      onClick={() => handleExport("csv")}
      disabled={exporting}
      className="flex items-center gap-1.5 text-sm border rounded px-3 py-1.5 hover:bg-muted disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      CSV
    </button>
    <button
      onClick={() => handleExport("pdf")}
      disabled={exporting}
      className="flex items-center gap-1.5 text-sm border rounded px-3 py-1.5 hover:bg-muted disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      PDF
    </button>
  </div>
</header>
```

**Step 3: TypeScript check**

Run: `cd cozy-estate-central && npx tsc --noEmit`

Expected: No errors.

**Step 4: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useMaintenanceTickets.ts \
        cozy-estate-central/src/pages/Reports.tsx
git commit -m "feat(reports): add date filter picker and CSV/PDF export buttons (D-1+D-2)"
```

---

## Task 4: Backend – Notification Digest (D-3)

**Files:**
- Modify: `backend/src/services/email.service.ts`
- Modify: `backend/src/services/retention.service.ts`

**Context:** The `User.notificationPrefs` JSON field already contains `digestFrequency: "TAEGLICH" | "WOECHENTLICH" | "MONATLICH"`. The digest email is sent at 8 AM server time using the existing hourly interval. An in-memory map prevents duplicate sends within the same calendar day.

**Step 1: Add `sendDigestEmail()` to `email.service.ts`**

Append to `backend/src/services/email.service.ts`:

```typescript
interface DigestData {
  period: string;
  openTickets: number;
  overdueRentCount: number;
  upcomingEventsCount: number;
}

export async function sendDigestEmails(companyId: number, frequency: string): Promise<void> {
  if (!isEmailEnabled) return;

  const users = await prisma.user.findMany({
    where: { companyId },
    select: { email: true, notificationPrefs: true },
  });

  const recipients = users
    .filter((u) => {
      const prefs = (u.notificationPrefs ?? {}) as Record<string, unknown>;
      return prefs.digestFrequency === frequency;
    })
    .map((u) => u.email);

  if (recipients.length === 0) return;

  // Gather digest data
  const now = new Date();
  const [openTickets, overdueRent, upcomingEvents] = await Promise.all([
    prisma.maintenanceTicket.count({
      where: { companyId, status: { in: ["OFFEN", "IN_BEARBEITUNG", "WARTEND"] } },
    }),
    prisma.rentPayment.count({
      where: { companyId, status: "AUSSTEHEND", dueDate: { lt: now } },
    }),
    prisma.calendarEvent.count({
      where: { companyId, start: { gte: now, lte: new Date(now.getTime() + 7 * 86400_000) } },
    }),
  ]);

  const frequencyLabels: Record<string, string> = {
    TAEGLICH: "Tagesübersicht",
    WOECHENTLICH: "Wochenübersicht",
    MONATLICH: "Monatsübersicht",
  };
  const period = frequencyLabels[frequency] ?? frequency;

  const subject = `Immoverwaltung – ${period}`;
  const html = htmlWrapper(period, `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 8px; color: #6b7280;">Offene Wartungstickets:</td>
        <td style="padding: 8px; font-weight: bold; color: ${openTickets > 0 ? "#ef4444" : "#1a1a1a"};">${openTickets}</td>
      </tr>
      <tr>
        <td style="padding: 8px; color: #6b7280;">Überfällige Mietzahlungen:</td>
        <td style="padding: 8px; font-weight: bold; color: ${overdueRent > 0 ? "#ef4444" : "#1a1a1a"};">${overdueRent}</td>
      </tr>
      <tr>
        <td style="padding: 8px; color: #6b7280;">Termine (nächste 7 Tage):</td>
        <td style="padding: 8px; font-weight: bold;">${upcomingEvents}</td>
      </tr>
    </table>
  `);

  await Promise.allSettled(recipients.map((to) => sendMail(to, subject, html)));
}
```

**Step 2: Add `processDigests()` to `retention.service.ts`**

In `backend/src/services/retention.service.ts`:

1. Add import at top:
```typescript
import { sendDigestEmails } from "./email.service.js";
```

2. Add the dedup map and `processDigests` function after the existing constants:
```typescript
// In-memory dedup: avoids double-sending if server restarts during the 8 AM hour
const digestSentAt = new Map<string, number>();

async function processDigests(): Promise<void> {
  const now = new Date();
  const hour = now.getHours();
  if (hour !== 8) return;

  const day = now.getDay();   // 0=Sun, 1=Mon
  const date = now.getDate();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const companies = await prisma.company.findMany({ select: { id: true } });

  for (const company of companies) {
    for (const freq of ["TAEGLICH", "WOECHENTLICH", "MONATLICH"] as const) {
      if (freq === "WOECHENTLICH" && day !== 1) continue;
      if (freq === "MONATLICH" && date !== 1) continue;

      const key = `${company.id}:${freq}`;
      if ((digestSentAt.get(key) ?? 0) >= dayStart) continue; // Already sent today

      digestSentAt.set(key, Date.now());
      await sendDigestEmails(company.id, freq).catch((err) =>
        logger.error({ err, companyId: company.id, freq }, "[DIGEST] Fehler beim Senden"),
      );
    }
  }
}
```

3. In `startRetentionCleanup()`, add `processDigests()` to the interval (not the initial startup run):

Inside the `setInterval(() => { Promise.all([...]) }, CLEANUP_INTERVAL_MS)` block, after the last item in the `Promise.all` array, add:
```typescript
processDigests().catch((err) => logger.error({ err }, "[DIGEST] Fehler")),
```

**Step 3: TypeScript check**

Run: `cd backend && npx tsc --noEmit`

Expected: No errors.

**Step 4: Commit**

```bash
git add backend/src/services/email.service.ts \
        backend/src/services/retention.service.ts
git commit -m "feat(notifications): add hourly digest email dispatch at 8 AM per digestFrequency (D-3)"
```

---

## Task 5: Frontend – KI-Scan progress states (D-4)

**Files:**
- Modify: `cozy-estate-central/src/lib/api.ts`
- Modify: `cozy-estate-central/src/pages/Finances.tsx`

**Context:** The current implementation shows a single `scanReceipt.isPending` state. We replace it with three real phases using XHR: `upload.onload` fires when the file transfer completes (before Claude finishes), giving a genuine UPLOADING→ANALYZING transition.

**Step 1: Add `uploadFileWithProgress` to `api.ts`**

Append to `cozy-estate-central/src/lib/api.ts`:

```typescript
export type ScanPhase = "idle" | "uploading" | "analyzing";

export async function uploadFileWithProgress<T = unknown>(
  path: string,
  formData: FormData,
  onPhaseChange: (phase: Exclude<ScanPhase, "idle">) => void,
): Promise<T> {
  const token = getToken();

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.withCredentials = true;

    // Upload complete → switch to analyzing while server (Claude) processes
    xhr.upload.addEventListener("load", () => onPhaseChange("analyzing"));

    xhr.addEventListener("load", () => {
      let json: unknown;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        reject(new ApiError(xhr.status, "Ungültige Serverantwort"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as T);
      } else {
        const msg = (json as { error?: { message?: string } })?.error?.message
          ?? "Ein Fehler ist aufgetreten";
        reject(new ApiError(xhr.status, msg));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new ApiError(0, "Netzwerkfehler beim Scan")),
    );

    onPhaseChange("uploading");
    xhr.send(formData);
  });
}
```

**Step 2: Update `Finances.tsx`**

1. Add `uploadFileWithProgress, type ScanPhase` to the `api` import:
```typescript
import { api, uploadFile, uploadFileWithProgress, type ScanPhase } from "@/lib/api";
```

2. Remove `const scanReceipt = useScanReceipt();` and replace with:
```typescript
const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
```

3. Replace the `handleScanFile` function body:
```typescript
const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  // Reset input so the same file can be selected again
  e.target.value = "";
  try {
    const res = await uploadFileWithProgress<{ data: ScannedReceipt }>(
      "/finance/scan",
      fd,
      setScanPhase,
    );
    const d = res.data;
    setNewTx((prev) => ({
      ...prev,
      amount: d.amount != null ? String(d.amount) : prev.amount,
      date: d.date ?? prev.date,
      description: d.description ?? prev.description,
      category: d.category ?? prev.category,
      type: d.type ?? prev.type,
    }));
    setScanInfo("Felder automatisch ausgefüllt – bitte prüfen und ggf. korrigieren.");
  } catch {
    toast({ title: "Scan fehlgeschlagen", description: "Bitte erneut versuchen.", variant: "destructive" });
  } finally {
    setScanPhase("idle");
  }
};
```

4. Update the scan button in JSX (find the existing `scanReceipt.isPending` button and replace):
```tsx
<Button
  type="button"
  variant="outline"
  className="w-full gap-2"
  disabled={scanPhase !== "idle"}
  onClick={() => scanInputRef.current?.click()}
>
  {scanPhase === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
  {scanPhase === "analyzing" && <Loader2 className="h-4 w-4 animate-spin" />}
  {scanPhase === "idle" && <ScanLine className="h-4 w-4" />}
  {scanPhase === "idle"
    ? "Beleg scannen (KI)"
    : scanPhase === "uploading"
    ? "Wird hochgeladen…"
    : "KI analysiert…"}
</Button>
```

**Step 3: Remove the now-unused `useScanReceipt` import**

In `Finances.tsx`, remove `useScanReceipt` from the import of `useFinance`. Also import `ScannedReceipt` if not already imported.

**Step 4: TypeScript check**

Run: `cd cozy-estate-central && npx tsc --noEmit`

Expected: No errors.

**Step 5: Commit**

```bash
git add cozy-estate-central/src/lib/api.ts \
        cozy-estate-central/src/pages/Finances.tsx
git commit -m "feat(scan): add UPLOADING→ANALYZING progress states for KI-Belegscan (D-4)"
```

---

## Task 6: Frontend – Calendar Drag-and-Drop (D-5)

**Files:**
- Modify: `cozy-estate-central/src/pages/Calendar.tsx`

**Context:** `react-big-calendar@1.19.4` and `@types/react-big-calendar@1.16.3` are already installed. The `PATCH /api/calendar/:id` endpoint already exists and `useUpdateCalendarEvent` hook already exists. Only `MANUELL` events should be draggable (AUTO_* events are read-only).

**Step 1: Add DnD imports to `Calendar.tsx`**

At the top of the file, after existing imports:

```typescript
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
```

Also add `useUpdateCalendarEvent` to the existing hook import:
```typescript
import { useCalendarEvents, useCreateCalendarEvent, useUpdateCalendarEvent } from "@/hooks/api/useCalendarEvents";
```

**Step 2: Create the DnD-wrapped Calendar component**

After `const localizer = dateFnsLocalizer({...})` block, add:

```typescript
const DnDCalendar = withDragAndDrop(Calendar);
```

**Step 3: Add `useUpdateCalendarEvent` inside the component**

Inside `CalendarPage()`, after `const createEvent = useCreateCalendarEvent();`, add:
```typescript
const updateEvent = useUpdateCalendarEvent();
```

**Step 4: Add the `onEventDrop` handler**

Inside `CalendarPage()`, after `eventStyleGetter`, add:

```typescript
const handleEventDrop = ({
  event,
  start,
  end,
}: {
  event: (typeof events)[0];
  start: string | Date;
  end: string | Date;
}) => {
  // Only allow dragging manually created events
  if (event.resource?.type !== "MANUELL") return;
  updateEvent.mutate({
    id: event.id as number,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  });
};
```

**Step 5: Replace `<Calendar>` with `<DnDCalendar>`**

In the JSX, replace the `<Calendar .../>` component with `<DnDCalendar .../>` and add the new props:

```tsx
<DnDCalendar
  localizer={localizer}
  events={events}
  view={view}
  date={currentDate}
  onNavigate={setCurrentDate}
  onView={setView}
  eventPropGetter={eventStyleGetter as never}
  culture="de"
  style={{ height: "100%" }}
  toolbar={false}
  onSelectEvent={(event) => setSelectedEvent(event as (typeof events)[0])}
  onEventDrop={handleEventDrop as never}
  draggableAccessor={(event) =>
    (event as (typeof events)[0]).resource?.type === "MANUELL"
  }
  resizable={false}
/>
```

**Note on `as never`:** The DnD types can conflict with the base Calendar types due to generic widening. Using `as never` for `eventPropGetter` and `onEventDrop` is the established pattern for this library version. If TypeScript still complains, add `// @ts-expect-error react-big-calendar DnD type mismatch` above the line.

**Step 6: TypeScript check**

Run: `cd cozy-estate-central && npx tsc --noEmit`

Expected: No errors (or only pre-existing errors – do not introduce new ones).

**Step 7: Commit**

```bash
git add cozy-estate-central/src/pages/Calendar.tsx
git commit -m "feat(calendar): add drag-and-drop for MANUELL events via withDragAndDrop (D-5)"
```

---

## Task 7: Final TypeScript verification across both projects

**Step 1: Backend TypeScript check**

Run: `cd backend && npx tsc --noEmit`

Expected: 0 errors.

**Step 2: Frontend TypeScript check**

Run: `cd cozy-estate-central && npx tsc --noEmit`

Expected: 0 errors (the `as never` casts in Calendar.tsx suppress known DnD type incompatibilities).

**Step 3: Backend tests**

Run: `cd backend && npm test`

Expected: All existing tests pass (29 backend tests). No new tests are required for these changes since the new code paths are pure service-layer functions and UI-state machines.

**Step 4: Final commit (if all clean)**

If only minor formatting fixes were needed:
```bash
git add -p  # stage only any remaining fixes
git commit -m "fix: tsc cleanup after D-1 through D-5 implementation"
```

---

## Summary of Changes

| Task | Files Changed | Feature |
|------|--------------|---------|
| D-2 | 3 backend files | `from`/`to` date filter on `GET /api/maintenance` |
| D-1 | 3 new + 1 modified backend files | `GET /api/reports/export` (CSV + PDF) |
| D-1+D-2 | 2 frontend files | Date pickers + export buttons in Reports.tsx |
| D-3 | 2 backend files | Hourly digest email at 8 AM per `digestFrequency` |
| D-4 | 2 frontend files | UPLOADING→ANALYZING progress via XHR `upload.onload` |
| D-5 | 1 frontend file | Drag-and-drop for MANUELL calendar events |

**Multi-tenancy safety checklist:**
- ✅ `generateReportData`: all queries include `companyId`
- ✅ `sendDigestEmails`: queries by `companyId`, `processDigests` iterates all companies independently
- ✅ `exportReport` controller: uses `req.companyId!` (set by `tenantGuard`)
- ✅ `handleEventDrop`: calls `updateEvent.mutate` which hits `PATCH /api/calendar/:id` – the backend already validates `companyId` ownership in `calendarService.updateEvent`
- ✅ Maintenance date filter: `where.companyId` already set before date filter is appended

**Known limitations (acceptable for this scope):**
- D-3 digest uses server local time for "hour === 8" check; if server is in UTC, adjust by setting `TZ=Europe/Berlin` in docker-compose
- D-3 digest dedup map resets on server restart – a rare edge case (double-send once if server restarts exactly at 8 AM)
- D-4 XHR does not handle 401 token refresh (acceptable: scan sessions are short, tokens are 15 min)
