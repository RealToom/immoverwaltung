# Design: Vorlagen Ansicht & Bearbeiten

**Datum:** 2026-03-02
**Status:** Approved

## Problem

`Templates.tsx` hat keinen View- oder Edit-Dialog für bestehende Vorlagen. Der Pencil-Icon ist importiert aber nicht verbaut. `useUpdateDocumentTemplate` existiert im Hook, wird aber nie verwendet.

## Scope

Nur Frontend — Backend (`PATCH /api/document-templates/:id`) und Hook (`useUpdateDocumentTemplate`) sind vollständig implementiert.

## Design

### Tabelle

- Tabellenzeilen werden klickbar (cursor-pointer) → öffnet View-Dialog
- Aktionsspalte erhält zusätzlichen Pencil-Button (neben PDF + Löschen) → öffnet direkt Edit-Dialog

### View-Dialog (`max-w-2xl`)

- Header: Template-Name + Kategorie-Badge
- Body: Vollständiger Inhalt als read-only `<Textarea>` (font-mono, rows=12, readOnly)
- Footer: "Schließen" + "Bearbeiten"-Button → schließt View-Dialog, öffnet Edit-Dialog

### Edit-Dialog (`max-w-2xl`)

- Identisch zum bestehenden Create-Dialog, vorausgefüllt mit den Werten der gewählten Vorlage
- Speichern → `updateTemplate.mutateAsync({ id, name, category, content })`
- "Abbrechen" schließt den Dialog

### State-Änderungen in `Templates.tsx`

| State | Typ | Zweck |
|-------|-----|-------|
| `viewTemplate` | `DocumentTemplate \| null` | Steuert View-Dialog |
| `editTemplate` | `DocumentTemplate \| null` | Steuert Edit-Dialog |
| `editForm` | `{ name, category, content }` | Vorausgefülltes Formular |

- `useUpdateDocumentTemplate` importieren
- `handleUpdate` async-Funktion analog zu `handleCreate`
- `openEditDialog(t)` — setzt `editTemplate` + `editForm`, öffnet Edit-Dialog
- Beim "Bearbeiten"-Klick im View-Dialog: `setViewTemplate(null); openEditDialog(t)`
