import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Search, Plus, Users, Mail, Phone, Building2, Loader2,
  FileText, Upload, Download, Eye, Trash2, ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenants, useCreateTenant } from "@/hooks/api/useTenants";
import { useProperties } from "@/hooks/api/useProperties";
import {
  useTenantDocuments, useUploadTenantDocument,
  useDeleteDocument, useDownloadDocument, usePreviewDocument,
} from "@/hooks/api/useDocuments";
import { formatDate } from "@/lib/mappings";

const PREVIEWABLE_TYPES = new Set(["PDF", "JPG", "JPEG", "PNG"]);

export default function Tenants() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Selected tenant for detail view
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  // Document state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ id: number; name: string; fileType: string } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [retentionMonths, setRetentionMonths] = useState<string>("0");

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", unitId: "", rent: "", propertyId: "",
  });

  const propertyIdFilter = propertyFilter !== "all" ? Number(propertyFilter) : undefined;
  const { data: tenantsResponse, isLoading } = useTenants(search || undefined, propertyIdFilter);
  const { data: propertiesResponse } = useProperties();
  const createTenant = useCreateTenant();

  const tenants = tenantsResponse?.data ?? [];
  const properties = propertiesResponse?.data ?? [];
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

  // Document hooks for selected tenant
  const { data: docsResponse } = useTenantDocuments(selectedTenantId ?? undefined);
  const tenantDocs = docsResponse?.data ?? [];
  const uploadMutation = useUploadTenantDocument(selectedTenantId ?? 0);
  const deleteMutation = useDeleteDocument(undefined, selectedTenantId ?? undefined);
  const downloadMutation = useDownloadDocument();
  const previewMutation = usePreviewDocument();

  const handleAdd = async () => {
    if (!form.name || !form.email) {
      toast({ title: "Fehler", description: "Bitte fülle alle Pflichtfelder aus.", variant: "destructive" });
      return;
    }
    try {
      await createTenant.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        moveIn: new Date().toISOString(),
        unitId: form.unitId ? Number(form.unitId) : undefined,
      });
      setForm({ name: "", email: "", phone: "", unitId: "", rent: "", propertyId: "" });
      setDialogOpen(false);
      toast({ title: "Mieter hinzugefügt", description: `${form.name} wurde erfolgreich angelegt.` });
    } catch {
      toast({ title: "Fehler", description: "Mieter konnte nicht angelegt werden.", variant: "destructive" });
    }
  };

  // Document handlers
  const handleUpload = () => {
    if (!uploadFile || !selectedTenantId) return;
    const formData = new FormData();
    formData.append("file", uploadFile);
    if (uploadName.trim()) formData.append("name", uploadName.trim());
    if (retentionMonths !== "0") formData.append("retentionMonths", retentionMonths);

    uploadMutation.mutate(formData, {
      onSuccess: () => {
        toast({ title: "Hochgeladen", description: "Dokument wurde erfolgreich hochgeladen." });
        setUploadOpen(false);
        setUploadName("");
        setUploadFile(null);
        setGdprConsent(false);
        setRetentionMonths("0");
      },
      onError: (err) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
    });
  };

  const handleDownload = (docId: number, docName: string) => {
    downloadMutation.mutate({ docId, docName }, {
      onError: () => toast({ title: "Fehler", description: "Download fehlgeschlagen.", variant: "destructive" }),
    });
  };

  const handleDelete = (docId: number) => {
    deleteMutation.mutate(docId, {
      onSuccess: () => { toast({ title: "Gelöscht", description: "Dokument wurde entfernt." }); setDeleteConfirmId(null); },
      onError: (err) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
    });
  };

  const handlePreview = (doc: { id: number; name: string; fileType: string }) => {
    if (PREVIEWABLE_TYPES.has(doc.fileType.toUpperCase())) {
      setPreviewDoc(doc);
      setPreviewBlobUrl(null);
      setPreviewOpen(true);
      previewMutation.mutate(doc.id, {
        onSuccess: ({ url }) => setPreviewBlobUrl(url),
        onError: () => toast({ title: "Fehler", description: "Vorschau konnte nicht geladen werden.", variant: "destructive" }),
      });
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
    setPreviewDoc(null);
  };

  // ─── Tenant Detail View ─────────────────────────────────────
  if (selectedTenant) {
    return (
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border/40 bg-background/80 px-6 backdrop-blur-md">
          <SidebarTrigger />
          <Button variant="ghost" size="sm" onClick={() => setSelectedTenantId(null)} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <div>
            <h1 className="font-heading text-lg font-bold text-foreground">{selectedTenant.name}</h1>
            <p className="text-xs text-muted-foreground">
              {selectedTenant.units[0]?.property?.name ?? "Keine Immobilie"} · {selectedTenant.units.map((u) => u.number).join(", ") || "Keine Einheit"}
            </p>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Tenant Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">E-Mail</p>
                  <p className="font-medium">{selectedTenant.email}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                  <Phone className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefon</p>
                  <p className="font-medium">{selectedTenant.phone || "–"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Building2 className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Einzug</p>
                  <p className="font-medium">{formatDate(selectedTenant.moveIn)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Documents Section */}
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <h3 className="text-sm font-semibold text-foreground">
                  <FileText className="inline h-4 w-4 mr-1.5 text-muted-foreground" />
                  Dokumente ({tenantDocs.length})
                </h3>
                <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
                  <Upload className="h-4 w-4" />
                  Hochladen
                </Button>
              </div>
              {tenantDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">Noch keine Dokumente vorhanden.</p>
                  <p className="text-xs mt-1">Laden Sie Schufa-Auskunft, Mietvertrag oder andere Dateien hoch.</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-4 w-4" />
                    Erstes Dokument hochladen
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/60">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dokument</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typ</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datum</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Größe</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantDocs.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-muted/50 border-border/40">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{doc.name}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{doc.fileType}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                        <TableCell className="text-muted-foreground">{doc.fileSize}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {PREVIEWABLE_TYPES.has(doc.fileType.toUpperCase()) && (
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePreview(doc)} title="Vorschau">
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownload(doc.id, doc.name)} disabled={downloadMutation.isPending} title="Herunterladen">
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => setDeleteConfirmId(doc.id)} title="Löschen">
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dokument hochladen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="doc-file">Datei</Label>
                <Input id="doc-file" type="file" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0] ?? null; setUploadFile(file); if (file && !uploadName) setUploadName(file.name); }} />
                <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPG, PNG (max. 10 MB)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-name">Dokumentname</Label>
                <Input id="doc-name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="z.B. Schufa-Auskunft, Mietvertrag" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention">Aufbewahrungsfrist (DSGVO Art. 17)</Label>
                <Select value={retentionMonths} onValueChange={setRetentionMonths}>
                  <SelectTrigger id="retention">
                    <SelectValue placeholder="Frist wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Unbegrenzt</SelectItem>
                    <SelectItem value="6">6 Monate</SelectItem>
                    <SelectItem value="12">1 Jahr</SelectItem>
                    <SelectItem value="24">2 Jahre</SelectItem>
                    <SelectItem value="36">3 Jahre</SelectItem>
                    <SelectItem value="60">5 Jahre</SelectItem>
                    <SelectItem value="120">10 Jahre (Steuerrelevant)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Nach Ablauf wird das Dokument automatisch gelöscht.</p>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
                <Checkbox id="gdpr-consent" checked={gdprConsent} onCheckedChange={(v) => setGdprConsent(v === true)} className="mt-0.5" />
                <label htmlFor="gdpr-consent" className="text-xs text-amber-800 dark:text-amber-200 leading-snug cursor-pointer">
                  Ich bestätige, dass eine Rechtsgrundlage (Art. 6 DSGVO) für die Speicherung dieses Dokuments vorliegt und der Mieter über die Verarbeitung informiert wurde.
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Abbrechen</Button>
              <Button onClick={handleUpload} disabled={!uploadFile || !gdprConsent || uploadMutation.isPending} className="gap-1.5">
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Hochladen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{previewDoc?.name}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-[60vh]">
              {!previewBlobUrl ? (
                <div className="flex items-center justify-center h-[60vh]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : previewDoc?.fileType.toUpperCase() === "PDF" ? (
                <iframe src={previewBlobUrl} className="w-full h-[60vh] border rounded" title={previewDoc.name} />
              ) : (
                <div className="flex items-center justify-center h-[60vh]">
                  <img src={previewBlobUrl} alt={previewDoc?.name} className="max-w-full max-h-full object-contain rounded" />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dokument löschen?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Das Dokument wird unwiderruflich gelöscht.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Abbrechen</Button>
              <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} disabled={deleteMutation.isPending} className="gap-1.5">
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    );
  }

  // ─── Tenant List View ───────────────────────────────────────
  return (
    <main className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border/40 bg-background/80 px-6 backdrop-blur-md">
        <SidebarTrigger />
        <div>
          <h1 className="font-heading text-lg font-bold text-foreground">Mieter</h1>
          <p className="text-xs text-muted-foreground">Alle Mieter verwalten</p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Neuer Mieter
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gesamt Mieter</p>
                <p className="text-2xl font-bold font-heading">{tenants.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                <Building2 className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Immobilien</p>
                <p className="text-2xl font-bold font-heading">{properties.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <span className="text-lg font-bold text-secondary-foreground">€</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mieter mit Einheit</p>
                <p className="text-2xl font-bold font-heading">
                  {tenants.filter((t) => t.units.length > 0).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Name oder E-Mail suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Alle Immobilien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Immobilien</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Immobilie</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead>Einzug</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Keine Mieter gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTenantId(t.id)}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {t.units[0]?.property?.name ?? "Keine Zuordnung"}
                        </Badge>
                      </TableCell>
                      <TableCell>{t.units.map((u) => u.number).join(", ") || "–"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(t.moveIn)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <a href={`mailto:${t.email}`} className="text-muted-foreground hover:text-foreground">
                            <Mail className="h-4 w-4" />
                          </a>
                          {t.phone && (
                            <a href={`tel:${t.phone}`} className="text-muted-foreground hover:text-foreground">
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setSelectedTenantId(t.id)}>
                          <FileText className="h-3.5 w-3.5" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Add Tenant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Mieter anlegen</DialogTitle>
            <DialogDescription>Fülle die Felder aus um einen neuen Mieter hinzuzufügen.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Vor- und Nachname" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">E-Mail *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@beispiel.de" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+49 170 ..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAdd} disabled={createTenant.isPending}>
              {createTenant.isPending ? "Anlegen..." : "Mieter anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
