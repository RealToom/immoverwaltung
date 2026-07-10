# Nebenkostenabrechnung — Rechtssicherer PDF-Abschluss — Design-Spec

**Datum:** 2026-07-10
**Status:** Vom User freigegeben (PDF pro Mieter, Bereitstellung im Mieter-Portal, Widerspruchshinweis mit Frist, Re-Generierung ersetzt statt dupliziert)

## Ausgangslage

Die im vorherigen Pass (Tasks 1-13, siehe `docs/superpowers/plans/2026-07-09-nebenkosten-advanced-api-wiring.md`) gebaute Nebenkostenabrechnung berechnet CO2-Stufenmodell, Leerstands-Routing, KI-Instandhaltungsfilter und Widerspruchs-Management korrekt — verifiziert durch manuellen Test mit echten Testdaten auf dem Produktionsserver (CO2-Split, Leerstandsberechnung und Pro-Vertrag-Zuteilung stimmen exakt mit Handrechnung überein).

**Die Lücke:** Schritt 3 „Generierung" im Admin-Wizard ist eine Sackgasse. Der Admin sieht nur „6 Verträge, 5 Buchungen berücksichtigt", aber nirgendwo die tatsächlichen Pro-Mieter-Beträge, und es gibt keinen Weg, eine finale, zustellbare Abrechnung zu erzeugen. Der bestehende PDF-Export (`GET /finance/utility-statement/pdf`) ist ein einzelnes Gesamt-Dokument mit der alten, einfachen Flächen-Berechnung (kein CO2, kein Leerstand, keine Vorauszahlungs-Verrechnung) und bleibt unverändert — er deckt einen anderen, einfacheren Use-Case ab.

Zusätzlich entdeckt: Das Mieter-Portal listet Dokumente, hat aber **keinen funktionierenden Download** — weder Backend-Route noch Frontend-Button. Ohne diesen Fix wären neue Nebenkosten-PDFs zwar im Portal sichtbar, aber nicht abrufbar.

**Nicht im Scope (bewusst):** automatischer E-Mail-Versand der PDFs, Änderungen am bestehenden `finance.controller.ts`-Export, Unterschriftspflicht für diese Dokumente (`requiresSignature: false`), automatische Aufbewahrungsfrist-Berechnung (`retentionUntil: null`, konsistent mit anderen manuell erstellten Dokumenten).

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| PDF-Struktur | Ein eigenständiges PDF pro Mieter/Vertrag, nicht ein Gesamt-Dokument |
| Zustellung | Ablage im Mieter-Portal (Dokumente-Bereich), kein automatischer E-Mail-Versand |
| Widerspruchshinweis | Ja — 12-Monats-Frist gem. § 556 Abs. 3 BGB + Verweis auf „Abrechnung prüfen" im Portal |
| Re-Generierung | Vorhandene PDFs/Eigentümer-Buchung werden ersetzt, nicht dupliziert (idempotent über Property+Jahr) |
| Download-Lücke im Mieter-Portal | Wird als Teil dieser Arbeit mitbehoben |

## 1. Backend — `UtilityBillingService` Erweiterung

### `generateStatement()` — kleine Ergänzung

Jedes Element in `items[]` bekommt zusätzlich `tenantId: number` (aus `contract.tenantId`), damit ein Item eindeutig einem Mieter-Datensatz zugeordnet werden kann, ohne über den Namen zu matchen. Keine Breaking Changes für bestehende Aufrufer (Task 6/7 lesen nur die Felder, die sie kennen).

### Neue Methode: `finalizeStatement(propertyId, year)`

Nutzt intern dieselbe Berechnungspipeline wie `generateStatement()` (CO2-Split, Kontrakt-Gewichtung, Balance), mit einem entscheidenden Unterschied: statt der reinen Vorschau-Funktion `calculateVacancyDeduction()` wird die bereits existierende, bisher unbenutzte **persistierende** `generateOwnerVacancyInvoice()` aufgerufen. Das ist exakt die Funktion, die beim Bugfix im finalen Review als „reserviert für eine zukünftige Abschluss-Aktion, aktuell von nichts aufgerufen" dokumentiert wurde — `finalizeStatement()` ist diese Aktion.

**Idempotenz der Eigentümer-Buchung:** Vor dem Aufruf von `generateOwnerVacancyInvoice()` wird geprüft, ob für `propertyId` + `category: "Leerstands-Ausgleich"` + `date` im Zieljahr bereits eine `Transaction` existiert. Falls ja, wird diese vor der Neuberechnung gelöscht (nicht dupliziert). Implementierung: `prisma.transaction.deleteMany({ where: { propertyId, companyId, category: "Leerstands-Ausgleich", date: { gte: startOfYear, lt: endOfYear } } })` vor dem `generateOwnerVacancyInvoice()`-Aufruf.

**PDF-Erzeugung pro Mieter:** Für jedes Item aus der Berechnung wird `generateTenantStatementPdf(item, statement, property, contract)` aufgerufen (neue Datei `backend/src/services/utility-statement-pdf.service.ts`, nutzt `pdfkit` wie `backend/src/lib/pdf.ts`, schreibt aber in eine temporäre Datei statt in eine HTTP-Response — siehe PDF-Inhalt unten).

**Idempotenz der Dokumente:** Vor dem Erzeugen wird geprüft, ob für `tenantId` + `companyId` + `name` (Namenskonvention `Nebenkostenabrechnung_{year}_{propertyId}.pdf`) bereits ein `Document` existiert. Falls ja, wird die alte Datei gelöscht (`fs.unlinkSync`) und der DB-Eintrag entfernt, bevor der neue erstellt wird — via die bestehende `deleteDocument`-Logik aus `document.service.ts` (Wiederverwendung, keine Neuimplementierung).

**Speicherung:** Über die bestehende `createDocument(companyId, { name, fileType: "application/pdf", fileSize, filePath, tenantId, propertyId })` aus `document.service.ts` — validiert Eigentümerschaft und verschlüsselt automatisch, falls `isEncryptionEnabled()`. Kein neuer Code für diesen Teil nötig.

**Rückgabewert:** `{ propertyId, year, generatedCount: number, items: [...] }` — Anzahl der erzeugten/aktualisierten Dokumente plus die Statement-Items für die Bestätigungsanzeige im Wizard.

### Neue Route: `POST /api/utility-billing/statements/finalize`

Body `{ propertyId: number, year: number }` (gleiches Schema wie `generateStatementSchema`). Gleiche RBAC wie die bestehende Generieren-Route (`requireRole("ADMIN", "VERWALTER", "BUCHHALTER")`).

## 2. PDF-Inhalt pro Mieter

Ein Dokument pro `item` aus `finalizeStatement()`, erzeugt mit `pdfkit` (Muster: `backend/src/controllers/finance.controller.ts:utilityStatementPdf`):

1. **Kopf:** Firmenname (Vermieter), Mieter-Name, Einheit (Nummer), Abrechnungszeitraum (Jahr).
2. **Kostenaufstellung:** Tabelle der `statement.transactions`, gefiltert auf `betrkvCategory != null`, mit dem anteiligen Betrag des Mieters — skaliert mit demselben `shareRatio = item.amount / statement.totalCosts` wie in `getUtilitySummary()` (Wiederverwendung derselben, bereits im finalen Review korrigierten Logik — keine zweite Implementierung der Pro-Rata-Kategorie-Skalierung).
3. **CO2-Hinweis** (nur falls `statement.co2.landlordShare > 0`): „CO₂-Kostenaufteilung gem. CO2KostAufG: Energieklasse {X}, Vermieter-Anteil {Y}% bereits abgezogen."
4. **Vorauszahlungen & Saldo:** `item.balance` mit Bezeichnung „Nachzahlung" (rot, falls `!isRefund`) oder „Guthaben" (grün, falls `isRefund`).
5. **Rechtlicher Hinweis (Fußzeile):** „Gemäß § 556 Abs. 3 BGB können Einwendungen gegen diese Abrechnung innerhalb von 12 Monaten nach Zugang erhoben werden. Ein Widerspruch kann bequem über das Mieter-Portal (Menüpunkt „Abrechnung prüfen") eingereicht werden."

## 3. Mieter-Portal — Dokumenten-Download (Lückenschluss)

**Neue Route:** `GET /api/tenant/:slug/documents/:id/download`, spiegelt die bestehende Admin-Route (`document.controller.ts:download`) exakt, inklusive der Entschlüsselungs-Verzweigung für `isEncrypted`-Dokumente (`decryptFile`, gleiche MIME-Zuordnung, gleiche `Content-Disposition`-Handhabung). Neue Service-Funktion `downloadDocument(tenantUser, documentId)` in `tenantPortal.service.ts`: prüft `tenantId === tenantUser.tenantId && companyId === tenantUser.companyId` (sonst `NotFoundError`), gibt das validierte `Document`-Objekt zurück; der Controller übernimmt die Entschlüsselungs-/Streaming-Logik analog zu `document.controller.ts:download`.

**Frontend (`tenant-portal/src/pages/Documents.tsx`):** Download-Button pro Dokument-Zeile. Da `tenantApi` aktuell nur JSON-Responses erwartet, wird der Download direkt per `fetch()` mit `Authorization`-Header gegen die neue Route ausgeführt, die Antwort als `Blob` gelesen, per `URL.createObjectURL(blob)` in einen unsichtbaren `<a download>` verpackt und programmatisch geklickt (Standard-Pattern für authentifizierte Downloads ohne Cookie-basierte Session). Kein neuer Helper in `lib/api.ts` nötig — die Logik lebt direkt in der Klick-Handler-Funktion der Seite, da sie nirgendwo sonst gebraucht wird.

## 4. Admin-Wizard, Schritt 3 (Ersatz für die Sackgasse)

`UtilityBillingWizard.tsx`s dritter Tab wird ersetzt:

- **Tabelle** mit einer Zeile pro `statement.items[]`-Eintrag (aus Schritt 1 bereits im React-Query-Cache vorhanden, keine neue Anfrage nötig): Mieter, Einheit, Betrag, Saldo (farbcodiert wie in Schritt 1 die CO2-Karte).
- **Button** „Abrechnungen erstellen & im Mieter-Portal bereitstellen" → ruft `POST /utility-billing/statements/finalize` auf (neuer Hook `useFinalizeStatement` in `useUtilityBilling.ts`).
- **Nach Erfolg:** Bestätigungstext „{N} Abrechnungen erstellt und im Mieter-Portal hinterlegt", Tabelle bleibt sichtbar.
- Der bisherige Platzhaltertext („Export ... ist noch nicht Teil dieses Assistenten") entfällt.

## Verification Plan

### Automatisierte Tests
- `finalizeStatement()`: Unit-Test für Idempotenz (zweiter Aufruf ersetzt statt dupliziert — sowohl Transaction als auch Document), Test für PDF-Erzeugung (Datei existiert, Document-Row korrekt verknüpft).
- `downloadDocument()`: Tenant-Isolation-Test (Tenant A darf kein Dokument von Tenant B herunterladen — 404).
- Bestehende Test-Suite (aktuell 198 Tests) muss weiterhin grün bleiben.

### Manuelle Verifikation
- Admin generiert Abrechnungen für eine Test-Immobilie mit echten Testdaten (wie im vorherigen manuellen Test), prüft PDF-Inhalt auf Korrektheit (Beträge stimmen mit der bereits verifizierten Berechnung überein).
- Mieter loggt sich ein, lädt sein PDF im Portal herunter, prüft Inhalt.
- Admin generiert ein zweites Mal für dieselbe Immobilie/Jahr — prüft, dass genau ein Dokument pro Mieter existiert (nicht zwei) und die Eigentümer-Buchung nicht dupliziert wurde.
