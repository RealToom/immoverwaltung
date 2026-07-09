# Advanced Nebenkosten-USPs — API-Anbindung — Design-Spec

**Datum:** 2026-07-09
**Status:** Vom User freigegeben (separates `/utility-billing`-Modul, Foto+KI-OCR für Zählerstände, Widerspruch als reines Ticket, `Contract.utilityPrepayment` wird ergänzt)

## Ausgangslage

Ein Großteil der Backend-Logik für vier Premium-Features (CO2-Kostenaufteilungsgesetz, Leerstands-Routing, KI-Instandhaltungsfilter, Widerspruchs-Management) existiert bereits uncommittet im Working Tree:

- `backend/prisma/schema.prisma`: `EnergyPassport.co2Emissions`, `Transaction.co2TaxAmount`/`betrkvCategory`/`maintenanceWarning`, `Unit.sqm`/`coownershipShare`/`currentInhabitants`, `Meter`-Interface-Felder, neues Modell `BillingDispute`.
- `backend/src/services/utility-billing.service.ts`: `calculateProRataFixedCosts`, `calculateHeatingBaseCostPercentage` (VDI 2067), `applyCO2Stufenmodell` (10-Stufen-Modell, 0–95% Vermieteranteil), `generateOwnerVacancyInvoice`, `calculateBalance`.
- `backend/src/services/receipt.service.ts`: KI-Prompt liefert bereits `betrkvCategory`/`maintenanceWarning`.
- `backend/src/services/matching.service.ts`: `matchUtilityTransactions` ordnet Versorger-Buchungen automatisch `BetrkvCategory` zu.
- Vier neue Frontend-Seiten (`UtilityBillingWizard.tsx`, `UtilityTransparency.tsx`, `MeterReadingSelfService.tsx`, `BillingDisputeForm.tsx`) sind geroutet, rendern aber nur Mock-Daten bzw. haben keine Submit-Logik.

**Lücke, die dieser Plan schließt:** keine Migration, keine API-Schicht (`UtilityBillingService` wird nirgends importiert, `BillingDispute` hat keine Route), Frontends ohne echte Daten, `calculateBalance` nutzt ein nicht existierendes Feld (`Contract.utilityPrepayment`).

**Nicht im Scope (bewusst):** Kopplung von Widersprüchen an die Abrechnungs-Berechnung (Widerspruch bleibt reines Tracking-Ticket), Änderungen am bestehenden `GET /finance/utility-statement` (bleibt unverändert, neue Logik lebt in eigenem Modul), neue Admin-Navigation für Widersprüche (Anzeige erfolgt innerhalb der bestehenden Nebenkosten-Seite), MQTT/Modbus/KNX-Zähler-Anbindung (Felder existieren im Schema, Live-Anbindung ist nicht Teil dieses Passes).

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| API-Struktur | Neues, eigenständiges Modul `/api/utility-billing` (Routes/Controller/Schema), nicht in `finance.routes.ts` integriert |
| Zählerstand-Selbsterfassung | Foto-Upload mit KI-OCR (Wiederverwendung von `scanMeterReading` aus `receipt.service.ts`, wie beim Admin-Zähler-Scan) zusätzlich zu manueller Eingabe |
| Widerspruchs-Scope | Reines Tracking-Ticket, keine Kopplung an die Abrechnungs-Anzeige |
| Vorauszahlungs-Bilanz | `Contract.utilityPrepayment` wird ergänzt, `calculateBalance` damit lauffähig gemacht |

## 1. Datenmodell (Prisma-Migration)

Eine einzige Migration deckt die bereits im Schema vorhandenen (aber noch nicht migrierten) Änderungen plus die neue Ergänzung ab:

```prisma
// Contract — neues Feld
model Contract {
  // ...bestehende Felder...
  utilityPrepayment Float @default(0) @map("utility_prepayment") // monatlicher Nebenkosten-Abschlag
}
```

Alle übrigen Modell-Änderungen (`BillingDispute`, `EnergyPassport.co2Emissions`, `Transaction`-Felder, `Unit`-Felder, `Meter`-Interface-Felder) sind bereits im Schema vorhanden und werden mit derselben Migration ausgerollt.

## 2. Backend — neues Admin-Modul `/api/utility-billing`

Schichten wie gewohnt: `routes/utility-billing.routes.ts` → `controllers/utility-billing.controller.ts` → `services/utility-billing.service.ts` (bereits vorhanden, wird um die unten beschriebenen Aggregations-Funktionen ergänzt) → Prisma. Mount unter `requireRole("ADMIN", "VERWALTER", "BUCHHALTER")`, `apiLimiter` auf schreibenden Endpunkten (Konvention aus `finance.routes.ts`).

- **`POST /api/utility-billing/statements/generate`** — Body `{ propertyId, year }` (Zod-validiert, `propertyId` muss zur `companyId` gehören). Ablauf:
  1. Allocatable `AUSGABE`-Transaktionen für Property/Jahr laden (wie in `finance.service.getUtilityStatement`).
  2. Für jede Unit/jeden Contract im Jahr: `calculateProRataFixedCosts` für die Fixkosten-Anteile nach Wohntagen.
  3. Für Transaktionen mit `betrkvCategory` bezogen auf Heizung: `calculateHeatingBaseCostPercentage` (VDI 2067) anwenden.
  4. Für Transaktionen mit `co2TaxAmount > 0`: `applyCO2Stufenmodell(propertyId, co2TaxAmount)` aufrufen, Vermieter-/Mieteranteil trennen.
  5. `generateOwnerVacancyInvoice(propertyId, year, totalFixedCosts)` aufrufen, um Leerstandskosten dem Eigentümer statt den Mietern zuzuordnen.
  6. `calculateBalance(contractId, year, totalAllocatedCosts)` pro Contract für Nachzahlung/Guthaben.
  7. Antwort: `{ data: { items: [...pro Vertrag/Einheit], transactions: [...alle Basis-Transaktionen inkl. betrkvCategory/maintenanceWarning] } }` — die Wizard-UI zeigt die Warnbox für Zeilen mit `maintenanceWarning`.
- **`GET /api/utility-billing/disputes`** — Liste aller `BillingDispute` der Firma, optionaler `status`-Query-Filter.
- **`PATCH /api/utility-billing/disputes/:id`** — Body `{ status: "IN_BEARBEITUNG" | "GELOEST" | "ABGELEHNT" }`. 404 falls Dispute nicht zur `companyId` gehört.

## 3. Backend — Tenant-Portal-Erweiterungen (`tenantPortal.routes.ts`)

Alle neuen Routen liegen hinter dem bestehenden `router.use(requireTenantAuth)`. Wiederverwendung bestehender Middleware/Services statt neuer Muster:

- **`GET /utility?year=`** — Ermittelt den aktiven Contract des Tenant-Users, ruft `UtilityBillingService.calculateBalance` sowie die Kostenaufteilung ab. `year` optional, Default = Vorjahr (`aktuelles Jahr - 1`). Es gibt kein persistiertes "Abrechnung final"-Objekt — sowohl dieser Endpunkt als auch `POST /utility-billing/statements/generate` berechnen bei jedem Aufruf live aus den Transaktionsdaten; das ist für diesen Pass bewusst so (keine neue Statement-Tabelle). Antwort: Kategorien-Breakdown + `{ totalPrepaid, totalCosts, balance, isRefund }`.
- **`GET /meters`** — Nur Zähler, die über den aktiven Contract → Unit des Tenant-Users erreichbar sind (kein Zugriff auf andere Units der Property).
- **`POST /meters/:id/readings`** — Body `{ value, readAt, note? }`. Server prüft Zähler-Zugehörigkeit zur eigenen Unit (sonst 403), dann `meter.service.addReading`.
- **`POST /meters/:id/readings/scan`** — `tenantPhotoMiddleware` (bereits für Ticket-Fotos im Einsatz) + `scanMeterReading` aus `receipt.service.ts` (dieselbe Funktion, die der Admin-Scan nutzt). Gibt den erkannten Wert zur Bestätigung zurück; das eigentliche Speichern läuft über denselben Pfad wie die manuelle Route (Tenant bestätigt im UI, dann `POST /meters/:id/readings`).
- **`POST /billing-disputes`** — Body `{ reason, amount? }`, `contractId` wird serverseitig aus dem aktiven Contract des Tenant-Users gesetzt (nicht vom Client übernommen — verhindert Fremd-Zuordnung).
- **`GET /billing-disputes`** — Nur Disputes des eigenen Tenants.

## 4. Frontend

- **`UtilityBillingWizard.tsx`**: `MOCK_TRANSACTIONS` durch React-Query-Hook ersetzen, der `POST /utility-billing/statements/generate` aufruft. Bestehende Warnbox-Darstellung für `maintenanceWarning` bleibt unverändert (Logik ist schon da, nur die Datenquelle ändert sich). Zusätzlicher Abschnitt "Offene Widersprüche" auf derselben Seite (`GET /utility-billing/disputes`, Status-Dropdown → `PATCH`).
- **`UtilityTransparency.tsx`**: Ruft `GET /utility` auf, zeigt Kategorien-Breakdown + Nachzahlung/Guthaben.
- **`MeterReadingSelfService.tsx`**: Zähler-Liste über `GET /meters`; Auswahl zwischen manueller Eingabe und Foto-Aufnahme (Foto → Scan-Endpunkt → Bestätigungsdialog mit erkanntem Wert, editierbar vor dem finalen Speichern).
- **`BillingDisputeForm.tsx`**: Formular sendet an `POST /billing-disputes`.

## 5. Tests

- Vitest-Unit-Tests für `UtilityBillingService`: `calculateProRataFixedCosts` (Zu-/Auszug unterjährig), `calculateHeatingBaseCostPercentage` (Monats-Überlappung), `applyCO2Stufenmodell` (alle 10 Stufen-Grenzwerte), `calculateBalance` (nach Ergänzung von `utilityPrepayment`, inkl. Teilzahlungs-Fall).
- Tenant-Isolation-Tests für die neuen Tenant-Portal-Routen: Tenant A darf keine Zähler/Disputes von Tenant B sehen oder verändern (403/404).
- Admin-RBAC-Test: `READONLY`-Rolle darf `statements/generate` nicht aufrufen.
