import { useState } from "react";
import { FileText, Plus, Pencil, Trash2, Download, Loader2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/mappings";
import {
  useDocumentTemplates,
  useCreateDocumentTemplate,
  useUpdateDocumentTemplate,
  useDeleteDocumentTemplate,
  useRenderDocumentTemplate,
  type DocumentTemplate,
} from "@/hooks/api/useDocumentTemplates";

const TEMPLATE_CATEGORIES = [
  "Mietvertrag", "Abmahnung", "Nebenkostenabrechnung", "Kündigung",
  "Übergabeprotokoll", "Mahnung", "Sonstiges",
];

const TEMPLATE_HINTS = `Verfügbare Variablen (Handlebars-Syntax):
{{tenantName}}  — Name des Mieters
{{propertyName}} — Name der Immobilie
{{unitNumber}}  — Einheitsnummer
{{date}}        — Aktuelles Datum
{{amount}}      — Betrag
{{landlord}}    — Vermieter`;

const Templates = () => {
  const { toast } = useToast();
  const { data: templatesRes, isLoading } = useDocumentTemplates();
  const templates = templatesRes ?? [];
  const createTemplate = useCreateDocumentTemplate();
  const deleteTemplate = useDeleteDocumentTemplate();
  const renderTemplate = useRenderDocumentTemplate();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const EMPTY_FORM = { name: "", category: "Sonstiges", content: "" };
  const [form, setForm] = useState(EMPTY_FORM);

  // Render dialog state
  const [renderOpen, setRenderOpen] = useState(false);
  const [renderTarget, setRenderTarget] = useState<DocumentTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({
    tenantName: "", propertyName: "", unitNumber: "",
    date: new Date().toLocaleDateString("de-DE"), amount: "", landlord: "",
  });

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // View dialog state
  const [viewTemplate, setViewTemplate] = useState<DocumentTemplate | null>(null);

  // Edit dialog state
  const [editTemplate, setEditTemplate] = useState<DocumentTemplate | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const updateTemplate = useUpdateDocumentTemplate();

  const handleCreate = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast({ title: "Fehler", description: "Name und Inhalt sind Pflichtfelder.", variant: "destructive" });
      return;
    }
    try {
      await createTemplate.mutateAsync({ name: form.name.trim(), category: form.category, content: form.content });
      toast({ title: "Gespeichert", description: "Vorlage wurde erstellt." });
      setForm(EMPTY_FORM);
      setCreateOpen(false);
    } catch (err) {
      toast({ title: "Fehler", description: err instanceof Error ? err.message : "Vorlage konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const handleRender = async () => {
    if (!renderTarget) return;
    try {
      const blob = await renderTemplate.mutateAsync({ id: renderTarget.id, variables });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${renderTarget.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setRenderOpen(false);
    } catch {
      toast({ title: "Fehler", description: "PDF konnte nicht erzeugt werden.", variant: "destructive" });
    }
  };

  const openRenderDialog = (template: DocumentTemplate) => {
    setRenderTarget(template);
    setVariables({
      tenantName: "", propertyName: "", unitNumber: "",
      date: new Date().toLocaleDateString("de-DE"), amount: "", landlord: "",
    });
    setRenderOpen(true);
  };

  const openEditDialog = (t: DocumentTemplate) => {
    setEditTemplate(t);
    setEditForm({ name: t.name, category: t.category, content: t.content });
  };

  const handleUpdate = async () => {
    if (!editTemplate || !editForm.name.trim() || !editForm.content.trim()) {
      toast({ title: "Fehler", description: "Name und Inhalt sind Pflichtfelder.", variant: "destructive" });
      return;
    }
    try {
      await updateTemplate.mutateAsync({
        id: editTemplate.id,
        name: editForm.name.trim(),
        category: editForm.category,
        content: editForm.content,
      });
      toast({ title: "Gespeichert", description: "Vorlage wurde aktualisiert." });
      setEditTemplate(null);
    } catch (err) {
      toast({ title: "Fehler", description: err instanceof Error ? err.message : "Vorlage konnte nicht gespeichert werden.", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Dokumenten-Vorlagen</h1>
          <p className="text-xs text-muted-foreground">Handlebars-Vorlagen erstellen und als PDF exportieren</p>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Neue Vorlage
        </Button>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Vorlagen ({templates.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Zuletzt geändert</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Noch keine Vorlagen vorhanden. Erstellen Sie Ihre erste Vorlage.
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((t) => (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setViewTemplate(t)}
                      >
                        <TableCell>
                          <div className="font-medium text-sm">{t.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {t.content.slice(0, 80)}{t.content.length > 80 ? "…" : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          {t.category && <Badge variant="outline" className="text-xs">{t.category}</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(t.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5"
                              onClick={(e) => { e.stopPropagation(); openRenderDialog(t); }}>
                              <Download className="h-4 w-4" />
                              PDF
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                              onClick={(e) => { e.stopPropagation(); openEditDialog(t); }}
                              title="Bearbeiten">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteId(t.id); }}
                              title="Löschen">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neue Vorlage erstellen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="z.B. Mietvertrag Standard"
                />
              </div>
              <div className="grid gap-2">
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Inhalt (Handlebars-Template) *</Label>
              <Textarea
                rows={10}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder={`Sehr geehrte/r {{tenantName}},\n\nhiermit bestätigen wir...\n\nDatum: {{date}}`}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground whitespace-pre">{TEMPLATE_HINTS}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createTemplate.isPending} className="gap-1.5">
              {createTemplate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Render/Fill Dialog */}
      <Dialog open={renderOpen} onOpenChange={setRenderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vorlage ausfüllen &amp; als PDF exportieren</DialogTitle>
          </DialogHeader>
          {renderTarget && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground font-medium">{renderTarget.name}</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(variables).map(([key, val]) => (
                  <div key={key} className="grid gap-1.5">
                    <Label className="text-xs">{`{{${key}}}`}</Label>
                    <Input
                      value={val}
                      onChange={(e) => setVariables((v) => ({ ...v, [key]: e.target.value }))}
                      placeholder={key}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenderOpen(false)}>Abbrechen</Button>
            <Button onClick={handleRender} disabled={renderTemplate.isPending} className="gap-1.5">
              {renderTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF herunterladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vorlage löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Die Vorlage wird unwiderruflich gelöscht.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button variant="destructive" disabled={deleteTemplate.isPending}
              onClick={() => {
                if (deleteId) {
                  deleteTemplate.mutate(deleteId, {
                    onSuccess: () => { toast({ title: "Gelöscht" }); setDeleteId(null); },
                    onError: () => toast({ title: "Fehler", variant: "destructive" }),
                  });
                }
              }}
              className="gap-1.5">
              {deleteTemplate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Template Dialog */}
      <Dialog open={viewTemplate !== null} onOpenChange={(open) => { if (!open) setViewTemplate(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewTemplate?.name}
              {viewTemplate?.category && (
                <Badge variant="outline" className="text-xs font-normal">{viewTemplate.category}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={viewTemplate?.content ?? ""}
              readOnly
              rows={14}
              className="font-mono text-sm resize-none bg-muted/40"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTemplate(null)}>Schließen</Button>
            <Button onClick={() => {
              const t = viewTemplate;
              setViewTemplate(null);
              if (t) openEditDialog(t);
            }} className="gap-1.5">
              <Pencil className="h-4 w-4" />
              Bearbeiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editTemplate !== null} onOpenChange={(open) => { if (!open) setEditTemplate(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vorlage bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="z.B. Mietvertrag Standard"
                />
              </div>
              <div className="grid gap-2">
                <Label>Kategorie</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Inhalt (Handlebars-Template) *</Label>
              <Textarea
                rows={10}
                value={editForm.content}
                onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground whitespace-pre">{TEMPLATE_HINTS}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Abbrechen</Button>
            <Button onClick={handleUpdate} disabled={updateTemplate.isPending} className="gap-1.5">
              {updateTemplate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Templates;
