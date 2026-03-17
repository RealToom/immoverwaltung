# Template Render Dropdowns Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual text inputs for `tenantName`, `propertyName`, `unitNumber`, and `landlord` in the Template render dialog with data-driven dropdowns and auto-fill.

**Architecture:** Single file change in `Templates.tsx`. Add `useTenants` and `useCompanySettings` hooks inside the render dialog section. On tenant selection, auto-fill dependent fields. Show a unit dropdown only when a tenant has multiple units.

**Tech Stack:** React 18, TypeScript, Shadcn/UI (`Select`), React Query (`useTenants`, `useCompanySettings`)

---

## Chunk 1: Render-Dialog überarbeiten

### Task 1: Imports und State erweitern

**Files:**
- Modify: `cozy-estate-central/src/pages/Templates.tsx:1-30` (imports)
- Modify: `cozy-estate-central/src/pages/Templates.tsx:58-63` (state)

- [ ] **Schritt 1: Imports hinzufügen**

In `Templates.tsx` die bestehenden Imports erweitern. Nach Zeile 29 (nach dem `useDocumentTemplates`-Import-Block) einfügen:

```typescript
import { useTenants } from "@/hooks/api/useTenants";
import { useCompanySettings } from "@/hooks/api/useSettings";
```

- [ ] **Schritt 2: State für Mieter- und Unit-Auswahl hinzufügen**

Nach dem bestehenden `renderTarget`/`variables`-State-Block (nach Zeile 63) einfügen:

```typescript
const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
```

- [ ] **Schritt 3: Hooks für den Render-Dialog hinzufügen**

Direkt nach den beiden neuen State-Zeilen einfügen. Die Hooks werden auf Component-Top-Level deklariert (React Rules of Hooks). React Query cached die Mieterdaten automatisch, wenn sie bereits auf anderen Seiten geladen wurden:

```typescript
const tenantsQuery = useTenants();
const tenants = tenantsQuery.data?.data ?? [];
const companyQuery = useCompanySettings();
```

**Hinweis:** `useTenants()` hat intern `limit: 100`. Bei mehr als 100 Mietern wäre das Dropdown unvollständig — für die meisten Hausverwaltungen ist das kein Problem.

### Task 2: `openRenderDialog` anpassen

**Files:**
- Modify: `cozy-estate-central/src/pages/Templates.tsx` (Funktion `openRenderDialog` — nach Einfügung aus Task 1 hat sich die Zeilennummer verschoben; nach Funktionsname suchen)

- [ ] **Schritt 4: Funktion aktualisieren**

Die bestehende `openRenderDialog`-Funktion (erkennbar an `setRenderTarget(template)`) vollständig ersetzen durch:

```typescript
const openRenderDialog = (template: DocumentTemplate) => {
  setRenderTarget(template);
  setSelectedTenantId(null);
  setSelectedUnitId(null);
  setVariables({
    tenantName: "",
    propertyName: "",
    unitNumber: "",
    date: new Date().toLocaleDateString("de-DE"),
    amount: "",
    landlord: companyQuery.data?.data.name ?? "",
  });
  setRenderOpen(true);
};
```

**Warum:** `landlord` wird beim Öffnen sofort aus `useCompanySettings()` befüllt. Tenant-Auswahl und Unit-Auswahl werden zurückgesetzt.

### Task 3: Mieter-Auswahl-Handler hinzufügen

**Files:**
- Modify: `cozy-estate-central/src/pages/Templates.tsx` — nach `openRenderDialog`

- [ ] **Schritt 5: Handler für Mieter-Auswahl einfügen**

Nach der `openRenderDialog`-Funktion einfügen:

```typescript
const handleTenantSelect = (tenantIdStr: string) => {
  const tenantId = Number(tenantIdStr);
  const tenant = tenants.find((t) => t.id === tenantId) ?? null;
  setSelectedTenantId(tenantId);
  setSelectedUnitId(null);

  if (!tenant) return;

  const unit = tenant.units.length === 1 ? tenant.units[0] : null;
  setVariables((v) => ({
    ...v,
    tenantName: tenant.name,
    propertyName: unit ? unit.property.name : "",
    unitNumber: unit ? unit.number : "",
  }));
};

const handleUnitSelect = (unitIdStr: string) => {
  const unitId = Number(unitIdStr);
  const tenant = tenants.find((t) => t.id === selectedTenantId) ?? null;
  const unit = tenant?.units.find((u) => u.id === unitId) ?? null;
  setSelectedUnitId(unitId);
  if (unit) {
    setVariables((v) => ({
      ...v,
      unitNumber: unit.number,
      propertyName: unit.property.name,
    }));
  }
};
```

**Warum:** `handleTenantSelect` deckt alle drei Fälle ab: 0 Units (Felder bleiben leer), 1 Unit (Auto-Fill), mehrere Units (Unit-Dropdown erscheint, Auto-Fill erst nach `handleUnitSelect`).

### Task 4: Render-Dialog UI ersetzen

**Files:**
- Modify: `cozy-estate-central/src/pages/Templates.tsx:284-315` (Render-Dialog)

- [ ] **Schritt 6: Dialog-Inhalt ersetzen**

Den bestehenden `{/* Render/Fill Dialog */}`-Block (erkennbar am Kommentar `{/* Render/Fill Dialog */}` und `<DialogTitle>Vorlage ausfüllen`) vollständig ersetzen durch:

```tsx
{/* Render/Fill Dialog */}
<Dialog open={renderOpen} onOpenChange={setRenderOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Vorlage ausfüllen &amp; als PDF exportieren</DialogTitle>
    </DialogHeader>
    {renderTarget && (
      <div className="space-y-3 py-2">
        <p className="text-sm text-muted-foreground font-medium">{renderTarget.name}</p>

        {/* Mieter-Auswahl */}
        <div className="grid gap-1.5">
          <Label className="text-xs">Mieter auswählen</Label>
          <Select
            value={selectedTenantId?.toString() ?? ""}
            onValueChange={handleTenantSelect}
            disabled={tenantsQuery.isLoading}
          >
            <SelectTrigger>
              {tenantsQuery.isLoading
                ? <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Lade Mieter…</span>
                : <SelectValue placeholder="Mieter wählen…" />}
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Unit-Auswahl (nur bei mehreren Units) */}
        {selectedTenantId !== null &&
          (tenants.find((t) => t.id === selectedTenantId)?.units.length ?? 0) > 1 && (
          <div className="grid gap-1.5">
            <Label className="text-xs">Einheit auswählen</Label>
            <Select
              value={selectedUnitId?.toString() ?? ""}
              onValueChange={handleUnitSelect}
            >
              <SelectTrigger><SelectValue placeholder="Einheit wählen…" /></SelectTrigger>
              <SelectContent>
                {tenants
                  .find((t) => t.id === selectedTenantId)
                  ?.units.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.number} — {u.property.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Restliche Variablen */}
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
```

### Task 5: Manuell testen und committen

- [ ] **Schritt 7: Frontend starten**

```bash
cd cozy-estate-central
npm run dev
```

Öffne http://localhost:8080, melde dich an (admin@immoverwalt.de / Admin123!), navigiere zu **Dokumenten-Vorlagen**.

- [ ] **Schritt 8: Testfälle durchgehen**

Klicke bei einer Vorlage auf **PDF**:

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Dialog öffnet | `{{landlord}}` ist mit Firmenname vorausgefüllt |
| Mieter mit 1 Unit wählen | `{{tenantName}}`, `{{propertyName}}`, `{{unitNumber}}` werden befüllt |
| Mieter mit >1 Units wählen | Zweites Dropdown "Einheit wählen" erscheint; nach Wahl werden die Felder befüllt |
| Mieter ohne Units wählen | `{{tenantName}}` befüllt, die anderen Felder bleiben leer + editierbar |
| Feld nach Auto-Fill manuell ändern | Änderung wird übernommen (Feld bleibt editierbar) |
| PDF herunterladen | PDF wird korrekt erzeugt |

- [ ] **Schritt 9: TypeScript prüfen**

```bash
cd cozy-estate-central
npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 10: Committen**

```bash
git add cozy-estate-central/src/pages/Templates.tsx
git commit -m "feat: dropdown-Auswahl für Mieter/Immobilie im Vorlagen-Render-Dialog"
```
