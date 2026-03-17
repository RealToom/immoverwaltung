# Design: Dropdown-Auswahl im Vorlagen-Render-Dialog

**Datum:** 2026-03-17
**Status:** Approved

## Zusammenfassung

Der Render-Dialog in `Templates.tsx` soll für die Variablen `tenantName`, `propertyName`, `unitNumber` und `landlord` keine manuellen Text-Inputs mehr anbieten, sondern echte Daten aus der API ziehen. Der Nutzer wählt einen Mieter aus einem Dropdown, woraufhin Immobilie, Einheitsnummer und Vermieter automatisch befüllt werden.

## Betroffene Datei

- `cozy-estate-central/src/pages/Templates.tsx` — nur der Render-Dialog-Abschnitt

## Feldverhalten nach Änderung

| Variable | Eingabe | Quelle |
|----------|---------|--------|
| `{{tenantName}}` | Dropdown | `useTenants()` — alle Mieter der Firma |
| `{{propertyName}}` | Auto-befüllt, editierbar | `tenant.units[0].property.name` |
| `{{unitNumber}}` | Auto-befüllt oder 2. Dropdown | `tenant.units[0].number` (mehrere → Dropdown) |
| `{{date}}` | Text-Input | heute (unverändert) |
| `{{amount}}` | Text-Input | manuell (unverändert) |
| `{{landlord}}` | Text-Input, vorausgefüllt | `useCompanySettings()` → `result.data?.data.name` |

## Ablauf

1. Render-Dialog öffnet:
   - `landlord` wird sofort mit dem Firmennamen aus `useCompanySettings()` vorausgefüllt
   - `tenantName`, `propertyName`, `unitNumber` sind leer

2. Nutzer wählt Mieter aus Dropdown (`useTenants()`, Suche optional):
   - `tenantName` = `tenant.name`
   - Hat der Mieter **keine Units**: `propertyName` und `unitNumber` bleiben leer, beide als editierbare Text-Inputs
   - Hat der Mieter **genau eine Unit**: `propertyName` (Text-Input) und `unitNumber` (Text-Input) werden automatisch gesetzt
   - Hat der Mieter **mehrere Units**: Ein zweites Dropdown erscheint zur Unit-Auswahl; nach Wahl werden `propertyName` (Text-Input) und `unitNumber` (Text-Input) gesetzt

3. `propertyName` ist immer ein vorausgefülltes `<Input>` (nie ein Dropdown). Alle auto-befüllten Felder bleiben jederzeit editierbar.

4. `date` und `amount` bleiben unveränderte Text-Inputs

## Implementierungsdetails

- `useTenants()` ist vorhanden in `src/hooks/api/useTenants.ts`. Gibt React Query-Result zurück; die Mieterliste liegt unter `result.data?.data ?? []` (paginierter Wrapper `PaginatedResponse<TenantListItem>`). Jedes Item: `{ id, name, units: [{ id, number, property: { id, name } }] }`
- `useCompanySettings()` ist vorhanden in `src/hooks/api/useSettings.ts`. Firmenname liegt unter `result.data?.data.name`
- Beide Hooks werden nur im Render-Dialog geladen (kein Overhead auf der Hauptseite)
- Kein neues File, keine neue Abstraktion — alles inline in `Templates.tsx`
- Ladezustand der Hooks: Dropdown deaktiviert + Loader-Icon während `isLoading`

## Was sich NICHT ändert

- Vorlagen erstellen/bearbeiten/löschen: unverändert
- Alle anderen Export-Stellen (DATEV, Übergabeprotokoll, Nebenkostenabrechnung): bereits datenbasiert, kein Handlungsbedarf
- Das Render-Ergebnis (PDF via `renderTemplate.mutateAsync`): unverändert
