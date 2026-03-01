# Design: CSV-Datenimport für Bestandskunden

**Datum:** 2026-03-01
**Status:** Genehmigt

## Ziel

Bestandskunden sollen ihre vorhandenen Daten (Immobilien, Einheiten, Mieter, Verträge) per CSV-Templates in das System importieren können. Finanzdaten kommen separat über die Bankanbindung. Dokumente über den bestehenden Datei-Upload.

## Architektur & Datenfluss

3 CSV-Templates (zum Download im Wizard):

1. `vorlage_immobilien.csv` — eine Zeile pro Einheit, Property-Felder wiederholen sich
2. `vorlage_mieter.csv` — eine Zeile pro Mieter
3. `vorlage_vertraege.csv` — referenziert per Name (Immobilie + Einheit-Nummer + Mieter-Name)

**Importreihenfolge** (abhängig von Fremdschlüsseln):
Immobilien → Einheiten → Mieter → Verträge

**Fehlerbehandlung:** Preview-first. Frontend parsed CSV per papaparse, zeigt Vorschau-Tabelle (grün/rot). Backend validiert alle Zeilen mit Zod, sammelt alle Fehler. Bei Fehlern → 400 + Fehlerliste. Bei Erfolg → Prisma-Transaktion (Alles-oder-nichts).

## CSV-Template Formate

### vorlage_immobilien.csv
```
Immobilie_Name,Strasse,PLZ,Stadt,Einheit_Nummer,Einheit_Etage,Flaeche_m2,Kaltmiete_EUR,Einheit_Typ
Musterhaus,Musterstr. 1,10115,Berlin,W1,1,65.5,800,WOHNUNG
Musterhaus,Musterstr. 1,10115,Berlin,W2,2,70.0,850,WOHNUNG
Musterhaus,Musterstr. 1,10115,Berlin,G1,0,15,80,GARAGE
```
Backend gruppiert Zeilen nach `Immobilie_Name` → erstellt Properties + Units.

Einheit_Typ: `WOHNUNG` | `GARAGE` | `STELLPLATZ`

### vorlage_mieter.csv
```
Name,Email,Telefon,Einzugsdatum
Max Mustermann,max@example.com,0151-1234567,01.01.2024
```

### vorlage_vertraege.csv
```
Mieter_Name,Immobilie_Name,Einheit_Nummer,Typ,Mietbeginn,Mietende,Kaltmiete_EUR,Kaution_EUR,Status
Max Mustermann,Musterhaus,W1,WOHNRAUM,01.01.2024,,800,2400,AKTIV
```
Referenzen per Name → Backend löst IDs auf, Fehler wenn nicht gefunden.

Vertrags-Typ: `WOHNRAUM` | `GEWERBE` | `STAFFEL` | `INDEX`
Status: `AKTIV` | `ENTWURF` | `GEKUENDIGT`

## Frontend

**Neue Seite `/import`** — Sidebar unter "Verwaltung" (zwischen Vorlagen und Berichte).

**Wizard mit 3 Schritten + Fortschrittsanzeige:**
```
[1. Immobilien] → [2. Mieter] → [3. Verträge] → [✓ Fertig]
```

**Jeder Schritt:**
1. Erklärungstext + "Vorlage herunterladen" Button
2. Drag-&-Drop Upload-Zone (CSV)
3. Vorschau-Tabelle (grün = ok, rot = Fehler mit Hinweis)
4. "Importieren" Button (nur aktiv wenn keine Fehler) + "Überspringen" (Schritt 3 optional)

**Abschluss-Screen:**
- Zusammenfassung: X Immobilien · Y Einheiten · Z Mieter · N Verträge importiert
- Button "Zu den Immobilien"

## Backend

**3 neue Endpunkte** (POST, authentifiziert, Rolle: VERWALTER+):

| Endpunkt | Body | Rückgabe |
|---|---|---|
| `POST /api/import/properties` | `ImportPropertyRow[]` | `{ created: { properties, units } }` |
| `POST /api/import/tenants` | `ImportTenantRow[]` | `{ created: { tenants } }` |
| `POST /api/import/contracts` | `ImportContractRow[]` | `{ created: { contracts } }` |

**Fehlerformat:** `{ errors: [{ row: 3, field: "Email", message: "Ungültige E-Mail" }] }`

**Neue Backend-Dateien:**
- `src/routes/import.routes.ts`
- `src/controllers/import.controller.ts`
- `src/services/import.service.ts`
- `src/schemas/import.schema.ts`

**Neue Frontend-Dateien:**
- `src/pages/Import.tsx`
- `src/hooks/api/useImport.ts`
