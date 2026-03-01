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
