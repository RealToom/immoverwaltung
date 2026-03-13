# Design: Wartungsplan-Einträge bearbeiten

**Datum:** 2026-03-02
**Status:** Genehmigt

## Anforderung

Im Wartungsplan-Tab der Maintenance-Seite sind Einträge derzeit nicht bearbeitbar (nur löschbar). Alle Felder eines Wartungsplan-Eintrags sollen editierbar sein.

## Betroffene Felder

- `title` (Pflicht)
- `description` (optional)
- `category` (Enum: SANITAER, ELEKTRIK, HEIZUNG, GEBAEUDE, AUSSENANLAGE, SONSTIGES)
- `interval` (Enum: MONATLICH, VIERTELJAEHRLICH, HALBJAEHRLICH, JAEHRLICH)
- `nextDue` (Datum)
- `assignedTo` (optional)

## Architektur

### Backend

**Datei:** `backend/src/schemas/maintenance-schedule.schema.ts`

`updateScheduleSchema` um `description`, `category`, `interval` erweitern — alle optional, gleiche Enum-Werte wie `createScheduleSchema`.

### Frontend

**Datei:** `cozy-estate-central/src/pages/Maintenance.tsx`

1. **Tabellenspalte:** Stift-Icon (`Pencil` aus lucide-react) öffnet Edit-Dialog; Löschen-Button bleibt erhalten.
2. **State:** `editSchedule: MaintenanceSchedule | null` + `editScheduleForm` mit den 6 Feldern.
3. **Edit-Dialog:** Analog zum bestehenden Ticket-Detail-Dialog.
   - title → Input
   - description → Input
   - category → Select
   - interval → Select
   - nextDue → Date-Input
   - assignedTo → Input
   - Footer: Abbrechen + Speichern
4. **Handler `handleSaveSchedule`:** Ruft `updateSchedule.mutateAsync({ id, ...form })` auf; Toast bei Erfolg/Fehler.
5. **Hook:** `useUpdateMaintenanceSchedule` ist bereits vorhanden, wird nur in Maintenance.tsx importiert.

## Nicht im Scope

- `propertyId` ist nicht änderbar (Immobilien-Zuordnung bleibt fix nach Erstellung)
- `lastDone` wird nicht manuell gesetzt (wird automatisch bei Ticket-Erledigung gesetzt)
- `isActive` Toggle (separates Feature)
