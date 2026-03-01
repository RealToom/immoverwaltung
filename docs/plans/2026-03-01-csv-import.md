# CSV-Datenimport Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import-Wizard für Bestandskunden — CSV-Upload für Immobilien+Einheiten, Mieter und Verträge mit Preview-first Validierung.

**Architecture:** Frontend parsed CSV per papaparse → zeigt Vorschau → sendet JSON-Array an 3 neue Backend-Endpunkte (`POST /api/import/*`) → Backend validiert mit Zod → erstellt alles in einer Prisma-Transaktion.

**Tech Stack:** papaparse (CSV-Parsing Frontend), Zod (Validierung Backend), Prisma transactions, React useState Wizard

---

## Task 1: papaparse installieren

**Files:**
- Modify: `cozy-estate-central/package.json`

**Step 1: Abhängigkeit installieren**

```bash
cd cozy-estate-central
npm install papaparse
npm install --save-dev @types/papaparse
```

**Step 2: Prüfen ob Installation erfolgreich**

```bash
cat package.json | grep papaparse
```
Expected: `"papaparse": "^5.x.x"` in dependencies

**Step 3: Commit**

```bash
cd ..
git add cozy-estate-central/package.json cozy-estate-central/package-lock.json
git commit -m "chore: add papaparse for CSV import"
```

---

## Task 2: Backend — import.schema.ts

**Files:**
- Create: `backend/src/schemas/import.schema.ts`

**Step 1: Schema erstellen**

```typescript
// backend/src/schemas/import.schema.ts
import { z } from "zod";

// Helper: DD.MM.YYYY oder YYYY-MM-DD → Date
const deDate = z.string().transform((val, ctx) => {
  let d: Date;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
    const [day, month, year] = val.split(".");
    d = new Date(`${year}-${month}-${day}`);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ungültiges Datum: ${val}` });
    return z.NEVER;
  }
  return d;
});

export const importPropertyRowSchema = z.object({
  Immobilie_Name: z.string().min(1).max(300),
  Strasse: z.string().min(1).max(300),
  PLZ: z.string().min(1).max(10),
  Stadt: z.string().min(1).max(200),
  Einheit_Nummer: z.string().min(1).max(50),
  Einheit_Etage: z.coerce.number().int(),
  Flaeche_m2: z.coerce.number().positive(),
  Kaltmiete_EUR: z.coerce.number().min(0),
  Einheit_Typ: z.enum(["WOHNUNG", "GARAGE", "STELLPLATZ"]).default("WOHNUNG"),
});

export const importPropertyRowsSchema = z.array(importPropertyRowSchema).min(1);

export const importTenantRowSchema = z.object({
  Name: z.string().min(1).max(200),
  Email: z.string().email().max(320),
  Telefon: z.string().max(50).default(""),
  Einzugsdatum: deDate,
});

export const importTenantRowsSchema = z.array(importTenantRowSchema).min(1);

export const importContractRowSchema = z.object({
  Mieter_Name: z.string().min(1),
  Immobilie_Name: z.string().min(1),
  Einheit_Nummer: z.string().min(1),
  Typ: z.enum(["WOHNRAUM", "GEWERBE", "STAFFEL", "INDEX"]),
  Mietbeginn: deDate,
  Mietende: z.string().transform((val, ctx) => {
    if (!val || val.trim() === "") return null;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
      const [day, month, year] = val.split(".");
      const d = new Date(`${year}-${month}-${day}`);
      if (isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ungültiges Datum: ${val}` });
        return z.NEVER;
      }
      return d;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ungültiges Datum: ${val}` });
      return z.NEVER;
    }
    return d;
  }).nullable(),
  Kaltmiete_EUR: z.coerce.number().positive(),
  Kaution_EUR: z.coerce.number().min(0).default(0),
  Status: z.enum(["AKTIV", "ENTWURF", "GEKUENDIGT"]).default("AKTIV"),
});

export const importContractRowsSchema = z.array(importContractRowSchema).min(1);
```

**Step 2: TypeScript prüfen**

```bash
cd backend
npx tsc --noEmit
```
Expected: Keine Fehler

**Step 3: Commit**

```bash
git add backend/src/schemas/import.schema.ts
git commit -m "feat(import): add Zod schemas for CSV import rows"
```

---

## Task 3: Backend — import.service.ts

**Files:**
- Create: `backend/src/services/import.service.ts`

**Step 1: Service erstellen**

```typescript
// backend/src/services/import.service.ts
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import type { z } from "zod";
import type {
  importPropertyRowsSchema,
  importTenantRowsSchema,
  importContractRowsSchema,
} from "../schemas/import.schema.js";

type PropertyRows = z.infer<typeof importPropertyRowsSchema>;
type TenantRows = z.infer<typeof importTenantRowsSchema>;
type ContractRows = z.infer<typeof importContractRowsSchema>;

export async function importProperties(companyId: number, rows: PropertyRows) {
  // Gruppiere Zeilen nach Immobilien-Name
  const propertyMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const existing = propertyMap.get(row.Immobilie_Name) ?? [];
    existing.push(row);
    propertyMap.set(row.Immobilie_Name, existing);
  }

  let propertiesCreated = 0;
  let unitsCreated = 0;

  await prisma.$transaction(async (tx) => {
    for (const [name, unitRows] of propertyMap) {
      const first = unitRows[0];
      const property = await tx.property.create({
        data: {
          name,
          street: first.Strasse,
          zip: first.PLZ,
          city: first.Stadt,
          status: "AKTIV",
          companyId,
        },
      });
      propertiesCreated++;

      for (const row of unitRows) {
        await tx.unit.create({
          data: {
            number: row.Einheit_Nummer,
            floor: row.Einheit_Etage,
            area: row.Flaeche_m2,
            rent: row.Kaltmiete_EUR,
            type: row.Einheit_Typ,
            status: "FREI",
            propertyId: property.id,
          },
        });
        unitsCreated++;
      }
    }
  });

  return { properties: propertiesCreated, units: unitsCreated };
}

export async function importTenants(companyId: number, rows: TenantRows) {
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.tenant.create({
        data: {
          name: row.Name,
          email: row.Email,
          phone: row.Telefon,
          moveIn: row.Einzugsdatum,
          companyId,
        },
      });
    }
  });

  return { tenants: rows.length };
}

export async function importContracts(companyId: number, rows: ContractRows) {
  // Referenzen vorab auflösen (alle Properties + Units + Tenants der Company laden)
  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({
      where: { companyId },
      include: { units: { select: { id: true, number: true } } },
    }),
    prisma.tenant.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);

  const propertyByName = new Map(properties.map((p) => [p.name.toLowerCase(), p]));
  const tenantByName = new Map(tenants.map((t) => [t.name.toLowerCase(), t]));

  // Validiere Referenzen vor der Transaktion
  const refErrors: { row: number; message: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const property = propertyByName.get(row.Immobilie_Name.toLowerCase());
    if (!property) {
      refErrors.push({ row: i + 1, message: `Immobilie nicht gefunden: "${row.Immobilie_Name}"` });
      continue;
    }
    const unit = property.units.find(
      (u) => u.number.toLowerCase() === row.Einheit_Nummer.toLowerCase()
    );
    if (!unit) {
      refErrors.push({
        row: i + 1,
        message: `Einheit "${row.Einheit_Nummer}" nicht gefunden in "${row.Immobilie_Name}"`,
      });
    }
    const tenant = tenantByName.get(row.Mieter_Name.toLowerCase());
    if (!tenant) {
      refErrors.push({ row: i + 1, message: `Mieter nicht gefunden: "${row.Mieter_Name}"` });
    }
  }

  if (refErrors.length > 0) {
    throw new AppError(400, "Referenzfehler beim Import", { errors: refErrors });
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const property = propertyByName.get(row.Immobilie_Name.toLowerCase())!;
      const unit = property.units.find(
        (u) => u.number.toLowerCase() === row.Einheit_Nummer.toLowerCase()
      )!;
      const tenant = tenantByName.get(row.Mieter_Name.toLowerCase())!;

      await tx.contract.create({
        data: {
          type: row.Typ,
          startDate: row.Mietbeginn,
          endDate: row.Mietende,
          noticePeriod: 3,
          monthlyRent: row.Kaltmiete_EUR,
          deposit: row.Kaution_EUR,
          status: row.Status as "AKTIV" | "ENTWURF" | "GEKUENDIGT",
          tenantId: tenant.id,
          propertyId: property.id,
          unitId: unit.id,
          companyId,
        },
      });
    }
  });

  return { contracts: rows.length };
}
```

**Step 2: TypeScript prüfen**

```bash
cd backend
npx tsc --noEmit
```
Expected: Keine Fehler

**Step 3: Commit**

```bash
git add backend/src/services/import.service.ts
git commit -m "feat(import): add import service with property/tenant/contract bulk create"
```

---

## Task 4: Backend — Controller, Routes, Registrierung

**Files:**
- Create: `backend/src/controllers/import.controller.ts`
- Create: `backend/src/routes/import.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Controller erstellen**

```typescript
// backend/src/controllers/import.controller.ts
import type { Request, Response } from "express";
import * as importService from "../services/import.service.js";
import {
  importPropertyRowsSchema,
  importTenantRowsSchema,
  importContractRowsSchema,
} from "../schemas/import.schema.js";
import { AppError } from "../lib/errors.js";

export async function importProperties(req: Request, res: Response): Promise<void> {
  const parsed = importPropertyRowsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => ({
      row: typeof e.path[0] === "number" ? e.path[0] + 1 : 0,
      field: e.path.slice(1).join("."),
      message: e.message,
    }));
    throw new AppError(400, "Validierungsfehler", { errors });
  }
  const result = await importService.importProperties(req.companyId!, parsed.data);
  res.status(201).json({ data: result });
}

export async function importTenants(req: Request, res: Response): Promise<void> {
  const parsed = importTenantRowsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => ({
      row: typeof e.path[0] === "number" ? e.path[0] + 1 : 0,
      field: e.path.slice(1).join("."),
      message: e.message,
    }));
    throw new AppError(400, "Validierungsfehler", { errors });
  }
  const result = await importService.importTenants(req.companyId!, parsed.data);
  res.status(201).json({ data: result });
}

export async function importContracts(req: Request, res: Response): Promise<void> {
  const parsed = importContractRowsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => ({
      row: typeof e.path[0] === "number" ? e.path[0] + 1 : 0,
      field: e.path.slice(1).join("."),
      message: e.message,
    }));
    throw new AppError(400, "Validierungsfehler", { errors });
  }
  const result = await importService.importContracts(req.companyId!, parsed.data);
  res.status(201).json({ data: result });
}
```

**Step 2: Routes erstellen**

```typescript
// backend/src/routes/import.routes.ts
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import * as ctrl from "../controllers/import.controller.js";

const router = Router();

router.post("/properties", requireRole("ADMIN", "VERWALTER"), ctrl.importProperties);
router.post("/tenants", requireRole("ADMIN", "VERWALTER"), ctrl.importTenants);
router.post("/contracts", requireRole("ADMIN", "VERWALTER"), ctrl.importContracts);

export { router as importRouter };
```

**Step 3: In index.ts registrieren**

In `backend/src/routes/index.ts` hinzufügen:

Nach den anderen imports:
```typescript
import { importRouter } from "./import.routes.js";
```

Nach den anderen router.use() Zeilen (vor dem banking callback):
```typescript
router.use("/import", requireAuth, tenantGuard, importRouter);
```

**Step 4: TypeScript prüfen**

```bash
cd backend
npx tsc --noEmit
```
Expected: Keine Fehler

**Step 5: Backend manuell testen**

```bash
cd backend
npm run dev
```

In einem zweiten Terminal (Token aus localStorage nach Login holen):
```bash
curl -X POST http://localhost:3001/api/import/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '[{"Immobilie_Name":"Test","Strasse":"Musterstr. 1","PLZ":"10115","Stadt":"Berlin","Einheit_Nummer":"W1","Einheit_Etage":1,"Flaeche_m2":65,"Kaltmiete_EUR":800,"Einheit_Typ":"WOHNUNG"}]'
```
Expected: `{"data":{"properties":1,"units":1}}`

**Step 6: Commit**

```bash
git add backend/src/controllers/import.controller.ts backend/src/routes/import.routes.ts backend/src/routes/index.ts
git commit -m "feat(import): add import routes and controller for properties/tenants/contracts"
```

---

## Task 5: Frontend — useImport.ts Hook

**Files:**
- Create: `cozy-estate-central/src/hooks/api/useImport.ts`

**Step 1: Hook erstellen**

```typescript
// cozy-estate-central/src/hooks/api/useImport.ts
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  data: Record<string, number>;
}

export function useImportProperties() {
  return useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      api<ImportResult>("/import/properties", { method: "POST", body: rows }),
  });
}

export function useImportTenants() {
  return useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      api<ImportResult>("/import/tenants", { method: "POST", body: rows }),
  });
}

export function useImportContracts() {
  return useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      api<ImportResult>("/import/contracts", { method: "POST", body: rows }),
  });
}
```

**Step 2: TypeScript prüfen**

```bash
cd cozy-estate-central
npx tsc --noEmit
```
Expected: Keine Fehler

**Step 3: Commit**

```bash
git add cozy-estate-central/src/hooks/api/useImport.ts
git commit -m "feat(import): add useImport React Query hooks"
```

---

## Task 6: Frontend — Import.tsx Seite

**Files:**
- Create: `cozy-estate-central/src/pages/Import.tsx`

**Step 1: Import.tsx erstellen**

```tsx
// cozy-estate-central/src/pages/Import.tsx
import { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, Download, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useImportProperties, useImportTenants, useImportContracts } from "@/hooks/api/useImport";
import { ApiError } from "@/lib/api";

// ── CSV Templates ──────────────────────────────────────────────────
const TEMPLATES = {
  properties: {
    filename: "vorlage_immobilien.csv",
    content: `Immobilie_Name,Strasse,PLZ,Stadt,Einheit_Nummer,Einheit_Etage,Flaeche_m2,Kaltmiete_EUR,Einheit_Typ
Musterhaus,Musterstr. 1,10115,Berlin,W1,1,65.5,800,WOHNUNG
Musterhaus,Musterstr. 1,10115,Berlin,W2,2,70.0,850,WOHNUNG
Musterhaus,Musterstr. 1,10115,Berlin,G1,0,15,80,GARAGE`,
  },
  tenants: {
    filename: "vorlage_mieter.csv",
    content: `Name,Email,Telefon,Einzugsdatum
Max Mustermann,max@example.com,0151-1234567,01.01.2024
Anna Schmidt,anna@example.com,0172-9876543,15.03.2023`,
  },
  contracts: {
    filename: "vorlage_vertraege.csv",
    content: `Mieter_Name,Immobilie_Name,Einheit_Nummer,Typ,Mietbeginn,Mietende,Kaltmiete_EUR,Kaution_EUR,Status
Max Mustermann,Musterhaus,W1,WOHNRAUM,01.01.2024,,800,2400,AKTIV
Anna Schmidt,Musterhaus,W2,WOHNRAUM,15.03.2023,,850,2550,AKTIV`,
  },
};

function downloadTemplate(key: keyof typeof TEMPLATES) {
  const t = TEMPLATES[key];
  const blob = new Blob([t.content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = t.filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Types ──────────────────────────────────────────────────────────
type ImportError = { row: number; field?: string; message: string };

interface StepState {
  rows: Record<string, string>[];
  errors: ImportError[];
  done: boolean;
  created: Record<string, number>;
}

const EMPTY_STEP: StepState = { rows: [], errors: [], done: false, created: {} };

// ── CSV Upload Zone ────────────────────────────────────────────────
function CsvUploadZone({
  requiredColumns,
  onParsed,
}: {
  requiredColumns: string[];
  onParsed: (rows: Record<string, string>[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setParseError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const missing = requiredColumns.filter(
          (col) => !result.meta.fields?.includes(col)
        );
        if (missing.length > 0) {
          setParseError(`Fehlende Spalten: ${missing.join(", ")}`);
          return;
        }
        onParsed(result.data);
      },
      error: (err) => setParseError(err.message),
    });
  };

  return (
    <div
      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">CSV-Datei hier ablegen oder klicken</p>
      {parseError && (
        <p className="mt-2 text-sm text-destructive flex items-center justify-center gap-1">
          <AlertCircle className="h-4 w-4" /> {parseError}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}

// ── Preview Table ──────────────────────────────────────────────────
function PreviewTable({
  rows,
  errors,
}: {
  rows: Record<string, string>[];
  errors: ImportError[];
}) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);
  const errorRows = new Set(errors.map((e) => e.row));

  return (
    <div className="rounded-md border overflow-auto max-h-64">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            {columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const rowErrors = errors.filter((e) => e.row === i + 1);
            return (
              <TableRow key={i} className={rowErrors.length > 0 ? "bg-destructive/10" : ""}>
                <TableCell className="text-xs text-muted-foreground">
                  {rowErrors.length > 0 ? (
                    <span title={rowErrors.map((e) => e.message).join(", ")}>
                      <AlertCircle className="h-4 w-4 text-destructive inline" />
                    </span>
                  ) : i + 1}
                </TableCell>
                {columns.map((c) => (
                  <TableCell key={c} className="text-xs max-w-[140px] truncate">{row[c]}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
const STEPS = [
  { label: "Immobilien", key: "properties" as const },
  { label: "Mieter", key: "tenants" as const },
  { label: "Verträge", key: "contracts" as const },
];

const REQUIRED_COLS = {
  properties: ["Immobilie_Name", "Strasse", "PLZ", "Stadt", "Einheit_Nummer", "Einheit_Etage", "Flaeche_m2", "Kaltmiete_EUR"],
  tenants: ["Name", "Email", "Einzugsdatum"],
  contracts: ["Mieter_Name", "Immobilie_Name", "Einheit_Nummer", "Typ", "Mietbeginn", "Kaltmiete_EUR"],
};

const STEP_DESCRIPTIONS = {
  properties: "Laden Sie Ihre Immobilien und Einheiten hoch. Mehrere Einheiten eines Objekts stehen als separate Zeilen (Immobilien-Felder wiederholen sich).",
  tenants: "Laden Sie Ihre Mieterdaten hoch. Telefon ist optional.",
  contracts: "Laden Sie Ihre Verträge hoch. Mieter- und Immobilienname müssen exakt mit den importierten Daten aus Schritt 1 & 2 übereinstimmen.",
};

export default function Import() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<StepState[]>([EMPTY_STEP, EMPTY_STEP, EMPTY_STEP]);
  const [finished, setFinished] = useState(false);

  const importProperties = useImportProperties();
  const importTenants = useImportTenants();
  const importContracts = useImportContracts();

  const mutations = [importProperties, importTenants, importContracts];

  const updateStep = (idx: number, update: Partial<StepState>) =>
    setSteps((s) => s.map((st, i) => (i === idx ? { ...st, ...update } : st)));

  const handleImport = async () => {
    const step = steps[currentStep];
    if (step.rows.length === 0) return;
    try {
      const result = await mutations[currentStep].mutateAsync(step.rows);
      updateStep(currentStep, { done: true, created: result.data, errors: [] });
      toast({ title: "Importiert", description: `Schritt ${currentStep + 1} erfolgreich abgeschlossen.` });
      if (currentStep === STEPS.length - 1) {
        setFinished(true);
      } else {
        setCurrentStep((s) => s + 1);
      }
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const details = err.details as { errors?: ImportError[] };
        if (details.errors) {
          updateStep(currentStep, { errors: details.errors });
          toast({ title: "Fehler in den Daten", description: "Bitte korrigieren Sie die markierten Zeilen.", variant: "destructive" });
          return;
        }
      }
      toast({ title: "Fehler", description: err instanceof Error ? err.message : "Import fehlgeschlagen.", variant: "destructive" });
    }
  };

  const totalCreated = steps.reduce((acc, s) => ({ ...acc, ...s.created }), {} as Record<string, number>);

  if (finished) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="font-heading text-lg font-semibold">Datenimport</h1>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full text-center border border-border/60 shadow-sm">
            <CardContent className="py-10 space-y-4">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
              <h2 className="font-heading text-xl font-semibold">Import abgeschlossen</h2>
              <div className="text-sm text-muted-foreground space-y-1">
                {totalCreated.properties != null && <p>{totalCreated.properties} Immobilien · {totalCreated.units} Einheiten importiert</p>}
                {totalCreated.tenants != null && <p>{totalCreated.tenants} Mieter importiert</p>}
                {totalCreated.contracts != null && <p>{totalCreated.contracts} Verträge importiert</p>}
              </div>
              <Button onClick={() => window.location.href = "/properties"}>
                Zu den Immobilien
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const step = steps[currentStep];
  const stepKey = STEPS[currentStep].key;
  const isPending = mutations[currentStep].isPending;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Datenimport</h1>
          <p className="text-xs text-muted-foreground">Bestandsdaten aus CSV-Vorlagen importieren</p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium shrink-0 ${
                steps[i].done ? "bg-green-500 text-white" :
                i === currentStep ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {steps[i].done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm ${i === currentStep ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Current Step Card */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Schritt {currentStep + 1}: {STEPS[currentStep].label}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{STEP_DESCRIPTIONS[stepKey]}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(stepKey)} className="gap-1.5">
              <Download className="h-4 w-4" />
              Vorlage herunterladen
            </Button>

            <CsvUploadZone
              requiredColumns={REQUIRED_COLS[stepKey]}
              onParsed={(rows) => updateStep(currentStep, { rows, errors: [] })}
            />

            {step.rows.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">{step.rows.length} Zeilen geladen</p>
                <PreviewTable rows={step.rows} errors={step.errors} />
                {step.errors.length > 0 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive space-y-1">
                    {step.errors.map((e, i) => (
                      <p key={i}>Zeile {e.row}{e.field ? ` (${e.field})` : ""}: {e.message}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          {currentStep < STEPS.length - 1 && (
            <Button variant="ghost" onClick={() => { setCurrentStep((s) => s + 1); }}>
              Überspringen
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={() => setCurrentStep((s) => s - 1)}>
                Zurück
              </Button>
            )}
            <Button
              onClick={handleImport}
              disabled={step.rows.length === 0 || step.errors.length > 0 || isPending}
              className="gap-1.5"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {currentStep === STEPS.length - 1 ? "Importieren & Abschließen" : "Importieren & Weiter"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
```

**Step 2: TypeScript prüfen**

```bash
cd cozy-estate-central
npx tsc --noEmit
```
Expected: Keine Fehler

**Step 3: Commit**

```bash
git add cozy-estate-central/src/pages/Import.tsx
git commit -m "feat(import): add Import wizard page with CSV upload and preview"
```

---

## Task 7: Frontend — Route + Sidebar registrieren

**Files:**
- Modify: `cozy-estate-central/src/App.tsx`
- Modify: `cozy-estate-central/src/components/AppSidebar.tsx`

**Step 1: Route in App.tsx hinzufügen**

In `App.tsx` den Import hinzufügen:
```tsx
import ImportPage from "./pages/Import";
```

Und die Route hinzufügen (nach der Templates-Route):
```tsx
<Route path="/import" element={<ImportPage />} />
```

**Step 2: Sidebar-Link in AppSidebar.tsx hinzufügen**

In `AppSidebar.tsx` das `managementItems` Array (das mit Vorlagen und Berichte):
```tsx
import { ..., FileInput } from "lucide-react";
```

Eintrag nach Vorlagen hinzufügen:
```tsx
{ title: "Datenimport", url: "/import", icon: FileInput },
```

**Step 3: Im Browser testen**

```bash
cd cozy-estate-central
npm run dev
```

1. Seite `/import` aufrufen
2. "Vorlage herunterladen" für Immobilien klicken → CSV öffnet sich
3. CSV wieder hochladen → Vorschau erscheint
4. "Importieren & Weiter" klicken → Schritt 2 erscheint
5. Schritt 2+3 überspringen → Abschluss-Screen erscheint

**Step 4: Commit**

```bash
git add cozy-estate-central/src/App.tsx cozy-estate-central/src/components/AppSidebar.tsx
git commit -m "feat(import): register /import route and sidebar link"
```

---

## Task 8: End-to-End-Test + Push

**Step 1: Vollständigen Import testen**

Im Browser mit Login als admin@immoverwalt.de:
1. `/import` aufrufen
2. `vorlage_immobilien.csv` herunterladen, hochladen, importieren → Erfolg
3. `vorlage_mieter.csv` herunterladen, hochladen, importieren → Erfolg
4. `vorlage_vertraege.csv` herunterladen, hochladen, importieren → Erfolg
5. Abschluss-Screen zeigt korrekte Zahlen
6. In `/properties` prüfen: neue Objekte sichtbar
7. In `/tenants` prüfen: neue Mieter sichtbar
8. In `/contracts` prüfen: neue Verträge sichtbar

**Step 2: Fehlerfall testen**

`vorlage_mieter.csv` mit ungültiger E-Mail hochladen → rote Zeile in Vorschau, Fehlermeldung

**Step 3: Push**

```bash
git push
```

**Step 4: Server aktualisieren**

```bash
# Auf dem Server
git pull origin master
docker compose up -d --build
```
