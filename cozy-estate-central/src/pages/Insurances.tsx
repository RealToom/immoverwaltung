import { useState, useRef } from "react";
import { ShieldCheck, Plus, Pencil, Trash2, AlertCircle, Upload, Download, CheckCircle2, XCircle } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useInsurancePolicies, useCreateInsurancePolicy, useUpdateInsurancePolicy,
  useDeleteInsurancePolicy, type InsurancePolicy,
} from "@/hooks/api/useInsurance";
import { useProperties } from "@/hooks/api/useProperties";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatCurrency } from "@/lib/mappings";

const TYPE_LABELS: Record<string, string> = {
  GEBAEUDE: "Gebäude", HAFTPFLICHT: "Haftpflicht", ELEMENTAR: "Elementar",
  RECHTSSCHUTZ: "Rechtsschutz", SONSTIGES: "Sonstiges",
};

const STATUS_LABELS: Record<string, string> = {
  AKTIV: "Aktiv", ABGELAUFEN: "Abgelaufen", GEKUENDIGT: "Gekündigt",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  AKTIV: "default", ABGELAUFEN: "secondary", GEKUENDIGT: "destructive",
};

const EMPTY_FORM = {
  name: "", insurer: "", policyNumber: "", type: "GEBAEUDE", status: "AKTIV",
  premium: "", startDate: "", endDate: "", notes: "", propertyId: "",
};

const CSV_HEADERS = ["name", "insurer", "policyNumber", "type", "status", "premium", "startDate", "endDate", "notes"];
const VALID_TYPES = ["GEBAEUDE", "HAFTPFLICHT", "ELEMENTAR", "RECHTSSCHUTZ", "SONSTIGES"];
const VALID_STATUSES = ["AKTIV", "ABGELAUFEN", "GEKUENDIGT"];

interface CsvRow {
  name: string;
  insurer: string;
  policyNumber: string;
  type: string;
  status: string;
  premium: string;
  startDate: string;
  endDate: string;
  notes: string;
  errors: string[];
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [name = "", insurer = "", policyNumber = "", type = "", status = "", premium = "", startDate = "", endDate = "", notes = ""] = cols;
    const errors: string[] = [];
    if (!name) errors.push("Name fehlt");
    if (!insurer) errors.push("Versicherer fehlt");
    if (!VALID_TYPES.includes(type)) errors.push(`Typ ungültig (${VALID_TYPES.join("|")})`);
    if (!premium || isNaN(Number(premium))) errors.push("Prämie muss eine Zahl sein");
    if (!startDate || isNaN(Date.parse(startDate))) errors.push("Beginn muss JJJJ-MM-TT sein");
    if (endDate && isNaN(Date.parse(endDate))) errors.push("Ablauf muss JJJJ-MM-TT sein");
    if (status && !VALID_STATUSES.includes(status)) errors.push(`Status ungültig (${VALID_STATUSES.join("|")})`);
    rows.push({ name, insurer, policyNumber, type, status: status || "AKTIV", premium, startDate, endDate, notes, errors });
  }
  return rows;
}

function downloadCsvTemplate() {
  const header = CSV_HEADERS.join(",");
  const example = [
    "Gebäudeversicherung Hauptstr",
    "Allianz AG",
    "POL-12345",
    "GEBAEUDE",
    "AKTIV",
    "1200",
    "2024-01-01",
    "2025-01-01",
    "Jahrespolice",
  ].join(",");
  const blob = new Blob([header + "\n" + example], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "versicherungen_vorlage.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Insurances() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === "ADMIN" || user?.role === "VERWALTER";

  const { data: result, isLoading } = useInsurancePolicies();
  const policies = result?.data ?? [];

  const { data: propertiesRes } = useProperties();
  const properties = propertiesRes?.data ?? [];

  const createMutation = useCreateInsurancePolicy();
  const updateMutation = useUpdateInsurancePolicy();
  const deleteMutation = useDeleteInsurancePolicy();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<InsurancePolicy | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{ ok: number; fail: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRows(parseCsv(text));
      setImportDone(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    const validRows = csvRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;
    setImporting(true);
    let ok = 0;
    let fail = 0;
    for (const row of validRows) {
      try {
        await createMutation.mutateAsync({
          name: row.name,
          insurer: row.insurer,
          policyNumber: row.policyNumber || null,
          type: row.type,
          status: row.status,
          premium: Number(row.premium),
          startDate: row.startDate,
          endDate: row.endDate || null,
          notes: row.notes || null,
          propertyId: null,
        } as never);
        ok++;
      } catch {
        fail++;
      }
    }
    setImporting(false);
    setImportDone({ ok, fail });
    toast({ title: `Import abgeschlossen`, description: `${ok} importiert, ${fail} fehlgeschlagen.` });
  }

  function closeImport() {
    setImportOpen(false);
    setCsvRows([]);
    setImportDone(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreate() {
    setEditPolicy(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: InsurancePolicy) {
    setEditPolicy(p);
    setForm({
      name: p.name,
      insurer: p.insurer,
      policyNumber: p.policyNumber ?? "",
      type: p.type,
      status: p.status,
      premium: String(p.premium),
      startDate: p.startDate.slice(0, 10),
      endDate: p.endDate ? p.endDate.slice(0, 10) : "",
      notes: p.notes ?? "",
      propertyId: p.propertyId ? String(p.propertyId) : "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name || !form.insurer || !form.type || !form.premium || !form.startDate) {
      toast({ variant: "destructive", title: "Pflichtfelder ausfüllen", description: "Name, Versicherer, Typ, Prämie und Beginn sind erforderlich." });
      return;
    }
    const payload = {
      name: form.name,
      insurer: form.insurer,
      policyNumber: form.policyNumber || null,
      type: form.type,
      status: form.status,
      premium: Number(form.premium),
      startDate: form.startDate,
      endDate: form.endDate || null,
      notes: form.notes || null,
      propertyId: form.propertyId ? Number(form.propertyId) : null,
    };

    if (editPolicy) {
      updateMutation.mutate({ id: editPolicy.id, ...payload }, {
        onSuccess: () => { toast({ title: "Versicherung aktualisiert" }); setDialogOpen(false); },
        onError: () => toast({ variant: "destructive", title: "Fehler beim Speichern" }),
      });
    } else {
      createMutation.mutate(payload as never, {
        onSuccess: () => { toast({ title: "Versicherung angelegt" }); setDialogOpen(false); },
        onError: () => toast({ variant: "destructive", title: "Fehler beim Anlegen" }),
      });
    }
  }

  function handleDelete() {
    if (deleteId === null) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => { toast({ title: "Versicherung gelöscht" }); setDeleteId(null); },
      onError: () => toast({ variant: "destructive", title: "Fehler beim Löschen" }),
    });
  }

  // KPIs
  const aktiv = policies.filter((p) => p.status === "AKTIV");
  const totalPremium = aktiv.reduce((sum, p) => sum + p.premium, 0);
  const expiringSoon = aktiv.filter((p) => {
    if (!p.endDate) return false;
    const days = (new Date(p.endDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 60;
  });

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Versicherungen</h1>
        <div className="ml-auto flex gap-2">
          {canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" /> Importieren
              </Button>
              <Button size="sm" onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" /> Neue Versicherung
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Aktive Policen</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{aktiv.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Jahresprämien gesamt</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalPremium)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Läuft bald ab (60 Tage)</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${expiringSoon.length > 0 ? "text-amber-600" : ""}`}>
              {expiringSoon.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring soon warning */}
      {expiringSoon.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Achtung:</strong> {expiringSoon.map((p) => p.name).join(", ")} läuft in den nächsten 60 Tagen ab.
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Wird geladen…</div>
          ) : policies.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Keine Versicherungen angelegt.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Versicherer</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Immobilie</TableHead>
                  <TableHead className="text-right">Prämie/Jahr</TableHead>
                  <TableHead>Beginn</TableHead>
                  <TableHead>Ablauf</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.insurer}</TableCell>
                    <TableCell>{TYPE_LABELS[p.type] ?? p.type}</TableCell>
                    <TableCell className="text-muted-foreground">{p.property ? `${p.property.name}` : "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.premium)}</TableCell>
                    <TableCell>{formatDate(p.startDate)}</TableCell>
                    <TableCell>{p.endDate ? formatDate(p.endDate) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editPolicy ? "Versicherung bearbeiten" : "Neue Versicherung"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 grid gap-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="z.B. Gebäudeversicherung Hauptstr. 1" />
              </div>
              <div className="grid gap-2">
                <Label>Versicherer *</Label>
                <Input value={form.insurer} onChange={(e) => setForm((f) => ({ ...f, insurer: e.target.value }))} placeholder="z.B. Allianz AG" />
              </div>
              <div className="grid gap-2">
                <Label>Policennummer</Label>
                <Input value={form.policyNumber} onChange={(e) => setForm((f) => ({ ...f, policyNumber: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="grid gap-2">
                <Label>Typ *</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Jahresprämie (€) *</Label>
                <Input type="number" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))} placeholder="z.B. 1200" />
              </div>
              <div className="grid gap-2">
                <Label>Immobilie</Label>
                <Select value={form.propertyId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, propertyId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Alle / keine" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Zuordnung</SelectItem>
                    {properties.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Beginn *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Ablauf</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="col-span-2 grid gap-2">
                <Label>Notizen</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) closeImport(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Versicherungen importieren</DialogTitle>
            <DialogDescription>
              CSV-Datei hochladen. Spalten: name, insurer, policyNumber, type, status, premium, startDate, endDate, notes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2" onClick={downloadCsvTemplate}>
                <Download className="h-4 w-4" /> Vorlage herunterladen
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> CSV auswählen
              </Button>
            </div>

            {csvRows.length > 0 && (
              <div className="rounded-md border overflow-auto max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6" />
                      <TableHead>Name</TableHead>
                      <TableHead>Versicherer</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Prämie</TableHead>
                      <TableHead>Beginn</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.map((row, i) => (
                      <TableRow key={i} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell>
                          {row.errors.length === 0
                            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                            : <XCircle className="h-4 w-4 text-destructive" />}
                        </TableCell>
                        <TableCell className="font-medium">{row.name || "—"}</TableCell>
                        <TableCell>{row.insurer || "—"}</TableCell>
                        <TableCell>{(TYPE_LABELS[row.type] ?? row.type) || "—"}</TableCell>
                        <TableCell>{row.premium ? `€ ${row.premium}` : "—"}</TableCell>
                        <TableCell>{row.startDate || "—"}</TableCell>
                        <TableCell>{(STATUS_LABELS[row.status] ?? row.status) || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {csvRows.some((r) => r.errors.length > 0) && (
              <div className="space-y-1 text-sm text-destructive">
                {csvRows.map((row, i) =>
                  row.errors.length > 0 ? (
                    <p key={i}>Zeile {i + 2}: {row.errors.join(", ")}</p>
                  ) : null
                )}
              </div>
            )}

            {importDone && (
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <CheckCircle2 className="h-4 w-4" />
                {importDone.ok} erfolgreich importiert{importDone.fail > 0 ? `, ${importDone.fail} fehlgeschlagen` : ""}.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImport}>Schließen</Button>
            {csvRows.filter((r) => r.errors.length === 0).length > 0 && !importDone && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Wird importiert…" : `${csvRows.filter((r) => r.errors.length === 0).length} Einträge importieren`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Versicherung löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Diese Aktion kann nicht rückgängig gemacht werden.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
