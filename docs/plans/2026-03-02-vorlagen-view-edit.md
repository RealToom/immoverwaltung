# Vorlagen View & Edit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** View-Dialog (read-only) und Edit-Dialog für bestehende Dokumentvorlagen in `Templates.tsx` ergänzen.

**Architecture:** Rein frontend-seitig. Backend (`PATCH /api/document-templates/:id`) und Hook (`useUpdateDocumentTemplate`) sind fertig. Zwei neue Dialoge in `Templates.tsx`: View-Dialog mit Bearbeiten-Button, Edit-Dialog identisch zum Create-Dialog aber vorausgefüllt.

**Tech Stack:** React, TypeScript, Shadcn/UI (Dialog, Textarea, Input, Select, Button, Badge)

---

### Task 1: State + Handler in Templates.tsx ergänzen

**Files:**
- Modify: `cozy-estate-central/src/pages/Templates.tsx`

**Step 1: `useUpdateDocumentTemplate` importieren**

In Zeile 23-28, den Import erweitern:

```typescript
import {
  useDocumentTemplates,
  useCreateDocumentTemplate,
  useUpdateDocumentTemplate,
  useDeleteDocumentTemplate,
  useRenderDocumentTemplate,
  type DocumentTemplate,
} from "@/hooks/api/useDocumentTemplates";
```

**Step 2: State für View- und Edit-Dialog hinzufügen**

Nach dem bestehenden `const [deleteId, setDeleteId] = useState<number | null>(null);` (Zeile 65) einfügen:

```typescript
// View dialog state
const [viewTemplate, setViewTemplate] = useState<DocumentTemplate | null>(null);

// Edit dialog state
const [editTemplate, setEditTemplate] = useState<DocumentTemplate | null>(null);
const EMPTY_EDIT_FORM = { name: "", category: "Sonstiges", content: "" };
const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

const updateTemplate = useUpdateDocumentTemplate();
```

**Step 3: Handler `openEditDialog` und `handleUpdate` hinzufügen**

Nach `handleRender` (nach Zeile 96) einfügen:

```typescript
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
```

**Step 4: Überprüfen ob TypeScript-Fehler vorhanden**

```bash
cd cozy-estate-central && npx tsc --noEmit 2>&1 | head -30
```

Erwartet: keine Fehler

---

### Task 2: Tabelle anpassen

**Files:**
- Modify: `cozy-estate-central/src/pages/Templates.tsx`

**Step 1: Tabellenzeile klickbar machen**

Die `<TableRow key={t.id}>` (Zeile 154) ändern zu:

```tsx
<TableRow
  key={t.id}
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => setViewTemplate(t)}
>
```

**Step 2: Pencil-Button in Aktionsspalte einfügen**

In der Aktionsspalte (div mit flex gap-1, Zeile 168-177) den Pencil-Button **vor** dem Löschen-Button einfügen:

```tsx
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
```

Wichtig: `e.stopPropagation()` bei allen Buttons damit der Row-Click (View) nicht ausgelöst wird.

---

### Task 3: View-Dialog hinzufügen

**Files:**
- Modify: `cozy-estate-central/src/pages/Templates.tsx`

**Step 1: View-Dialog nach dem Delete-Dialog einfügen** (nach `</Dialog>` des Delete-Dialogs, Zeile 294):

```tsx
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
```

**Step 2: TypeScript prüfen**

```bash
cd cozy-estate-central && npx tsc --noEmit 2>&1 | head -30
```

Erwartet: keine Fehler

---

### Task 4: Edit-Dialog hinzufügen

**Files:**
- Modify: `cozy-estate-central/src/pages/Templates.tsx`

**Step 1: Edit-Dialog nach dem View-Dialog einfügen:**

```tsx
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
```

**Step 2: Finaler TypeScript-Check**

```bash
cd cozy-estate-central && npx tsc --noEmit 2>&1
```

Erwartet: keine Fehler

**Step 3: Commit**

```bash
git add cozy-estate-central/src/pages/Templates.tsx docs/plans/2026-03-02-vorlagen-view-edit-design.md docs/plans/2026-03-02-vorlagen-view-edit.md
git commit -m "feat(templates): add view and edit dialogs for document templates"
```
