# Wartungsplan Edit Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wartungsplan-Einträge sollen vollständig bearbeitbar sein (title, description, category, interval, nextDue, assignedTo) via Edit-Dialog.

**Architecture:** Backend-Schema um fehlende Felder erweitern; Frontend bekommt Edit-Dialog analog zum bestehenden Ticket-Detail-Dialog. Der `useUpdateMaintenanceSchedule`-Hook existiert bereits.

**Tech Stack:** Express + Zod (Backend), React + Shadcn/UI + React Query (Frontend)

---

### Task 1: Backend-Schema erweitern

**Files:**
- Modify: `backend/src/schemas/maintenance-schedule.schema.ts`

**Step 1: Datei lesen und Schema anpassen**

Öffne `backend/src/schemas/maintenance-schedule.schema.ts`. Das `updateScheduleSchema` sieht aktuell so aus:

```ts
export const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  assignedTo: z.string().optional(),
  isActive: z.boolean().optional(),
  lastDone: z.string().datetime().optional(),
  nextDue: z.string().datetime().optional(),
});
```

Ersetze es durch:

```ts
export const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(["SANITAER", "ELEKTRIK", "HEIZUNG", "GEBAEUDE", "AUSSENANLAGE", "SONSTIGES"]).optional(),
  interval: z.enum(["MONATLICH", "VIERTELJAEHRLICH", "HALBJAEHRLICH", "JAEHRLICH"]).optional(),
  assignedTo: z.string().optional(),
  isActive: z.boolean().optional(),
  lastDone: z.string().datetime().optional(),
  nextDue: z.string().datetime().optional(),
});
```

**Step 2: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
```
Expected: keine Fehler

**Step 3: Commit**

```bash
git add backend/src/schemas/maintenance-schedule.schema.ts
git commit -m "feat(maintenance): extend updateScheduleSchema with description, category, interval"
```

---

### Task 2: Frontend — Imports, State und Handler

**Files:**
- Modify: `cozy-estate-central/src/pages/Maintenance.tsx`

**Step 1: Import `Pencil` Icon hinzufügen**

In der Import-Zeile der lucide-react Icons (Zeile 3-16) `Pencil` hinzufügen:

```ts
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Calendar,
  User,
  MessageSquare,
  Loader2,
  ListChecks,
  Trash2,
  Pencil,
} from "lucide-react";
```

**Step 2: `useUpdateMaintenanceSchedule` importieren**

Zeile 53 anpassen — den bestehenden Import erweitern:

```ts
import { useMaintenanceSchedules, useCreateMaintenanceSchedule, useUpdateMaintenanceSchedule, useDeleteMaintenanceSchedule } from "@/hooks/api/useMaintenanceSchedules";
```

**Step 3: State für Edit-Dialog hinzufügen**

Nach `const [newSchedule, setNewSchedule] = useState(EMPTY_SCHEDULE);` (ca. Zeile 145) folgendes einfügen:

```ts
const updateSchedule = useUpdateMaintenanceSchedule();
const [editSchedule, setEditSchedule] = useState<import("@/hooks/api/useMaintenanceSchedules").MaintenanceSchedule | null>(null);
const [editScheduleForm, setEditScheduleForm] = useState({
  title: "",
  description: "",
  category: "",
  interval: "",
  nextDue: "",
  assignedTo: "",
});
```

**Step 4: `openEditSchedule`-Funktion hinzufügen**

Direkt nach dem neuen State (nach Step 3) einfügen:

```ts
const openEditSchedule = (s: import("@/hooks/api/useMaintenanceSchedules").MaintenanceSchedule) => {
  setEditSchedule(s);
  setEditScheduleForm({
    title: s.title,
    description: s.description ?? "",
    category: s.category,
    interval: s.interval,
    nextDue: s.nextDue ? (() => { const d = new Date(s.nextDue); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })() : "",
    assignedTo: s.assignedTo ?? "",
  });
};
```

**Step 5: `handleSaveSchedule`-Funktion hinzufügen**

Direkt nach `openEditSchedule` einfügen:

```ts
const handleSaveSchedule = async () => {
  if (!editSchedule) return;
  try {
    await updateSchedule.mutateAsync({
      id: editSchedule.id,
      title: editScheduleForm.title,
      description: editScheduleForm.description || undefined,
      category: editScheduleForm.category || undefined,
      interval: editScheduleForm.interval || undefined,
      nextDue: editScheduleForm.nextDue ? new Date(editScheduleForm.nextDue + "T12:00:00Z").toISOString() : undefined,
      assignedTo: editScheduleForm.assignedTo || undefined,
    });
    toast({ title: "Gespeichert", description: "Wartungsplan wurde aktualisiert." });
    setEditSchedule(null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast({ title: "Fehler beim Speichern", description: msg, variant: "destructive" });
  }
};
```

**Step 6: TypeScript prüfen**

```bash
cd cozy-estate-central && npx tsc --noEmit
```
Expected: keine Fehler

---

### Task 3: Frontend — Tabellenspalte mit Edit-Button

**Files:**
- Modify: `cozy-estate-central/src/pages/Maintenance.tsx`

**Step 1: Aktions-Spalte in der Tabelle anpassen**

Im Wartungsplan-Tab, in der `schedules.map(...)` Schleife, die letzte `<TableCell>` (die aktuell nur den Trash-Button enthält, ca. Zeile 614-618) ersetzen durch:

```tsx
<TableCell>
  <div className="flex items-center gap-1">
    {user?.role !== "READONLY" && (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => openEditSchedule(s)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    )}
    {user?.role !== "READONLY" && (
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive h-8 w-8 p-0"
        onClick={() => deleteSchedule.mutate(s.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    )}
  </div>
</TableCell>
```

**Step 2: TypeScript prüfen**

```bash
cd cozy-estate-central && npx tsc --noEmit
```
Expected: keine Fehler

---

### Task 4: Frontend — Edit-Dialog hinzufügen

**Files:**
- Modify: `cozy-estate-central/src/pages/Maintenance.tsx`

**Step 1: Edit-Dialog direkt vor dem schließenden `</div>` (Zeile 833) einfügen**

Direkt nach dem `{/* Wartungsplan erstellen Dialog */}`-Block (nach der schließenden `</Dialog>`-Tag ca. Zeile 832) und vor dem letzten `</div>` folgendes einfügen:

```tsx
{/* Wartungsplan bearbeiten Dialog */}
<Dialog open={!!editSchedule} onOpenChange={(open) => !open && setEditSchedule(null)}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Wartungsplan bearbeiten</DialogTitle>
      <DialogDescription>
        {editSchedule?.property?.name ?? ""}
      </DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>Titel *</Label>
        <Input
          value={editScheduleForm.title}
          onChange={(e) => setEditScheduleForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="z.B. Heizungswartung"
        />
      </div>
      <div className="grid gap-2">
        <Label>Beschreibung</Label>
        <Input
          value={editScheduleForm.description}
          onChange={(e) => setEditScheduleForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Optional"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Kategorie</Label>
          <Select
            value={editScheduleForm.category}
            onValueChange={(v) => setEditScheduleForm((f) => ({ ...f, category: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Intervall</Label>
          <Select
            value={editScheduleForm.interval}
            onValueChange={(v) => setEditScheduleForm((f) => ({ ...f, interval: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(INTERVAL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Nächste Fälligkeit</Label>
          <Input
            type="date"
            value={editScheduleForm.nextDue}
            onChange={(e) => setEditScheduleForm((f) => ({ ...f, nextDue: e.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Zugewiesen an</Label>
          <Input
            value={editScheduleForm.assignedTo}
            onChange={(e) => setEditScheduleForm((f) => ({ ...f, assignedTo: e.target.value }))}
            placeholder="Handwerker / Firma"
          />
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setEditSchedule(null)}>Abbrechen</Button>
      <Button onClick={handleSaveSchedule} disabled={updateSchedule.isPending} className="gap-1.5">
        {updateSchedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Speichern
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 2: TypeScript prüfen**

```bash
cd cozy-estate-central && npx tsc --noEmit
```
Expected: keine Fehler

**Step 3: Commit**

```bash
git add cozy-estate-central/src/pages/Maintenance.tsx
git commit -m "feat(maintenance): add edit dialog for Wartungsplan entries"
```

---

### Task 5: Manueller Test

**Step 1: Backend + Frontend starten**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd cozy-estate-central && npm run dev
```

**Step 2: Testen**
1. Login mit admin@immoverwalt.de / Admin123!
2. Zu Wartung & Tickets navigieren → Tab "Wartungsplan"
3. Bei einem vorhandenen Eintrag: Stift-Icon klicken → Dialog öffnet sich mit vorausgefüllten Werten
4. Titel, Beschreibung, Kategorie, Intervall, Fälligkeit, Zugewiesen ändern → Speichern
5. Tabelle zeigt aktualisierte Werte
6. READONLY-User: Stift- und Löschen-Icons sind nicht sichtbar

**Step 3: Abschluss-Commit (falls noch Änderungen offen)**

```bash
git add -p
git commit -m "fix(maintenance): wartungsplan edit final adjustments"
```
