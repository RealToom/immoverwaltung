# Energie-Tracking — Design Spec

## Goal

Hausverwaltungen können pro Immobilie einen **Klimaausweis** hinterlegen und den **Energieverbrauch** (Strom/Gas/Wasser/Wärme) pro Einheit über die Zeit in Charts verfolgen. Die Verbrauchsdaten stammen aus den bereits vorhandenen `Meter`- und `MeterReading`-Modellen — kein neues Zähler-System.

## Vorhandene Basis

Das Projekt hat bereits:
- `Meter`-Modell mit `MeterType` (STROM, WASSER, GAS, WAERME, SONSTIGES), optional mit `unitId`
- `MeterReading`-Modell mit `value`, `readAt`, Verbrauchsberechnung im Backend
- Zähler-Tab auf `PropertyDetail.tsx`
- Nebenkostenabrechnung (area-based allocation)

Dieses Feature baut darauf auf — es erweitert die Datenhaltung um Klimaausweis-Daten und fügt eine neue `/energie`-Seite mit aggregierten Charts hinzu.

## Datenbankmodell

### Neues Modell: `EnergyPassport`

1:1-Relation zu `Property` (upsert-Semantik — maximal ein Ausweis pro Immobilie).

| Feld | Typ | DB-Spalte | Beschreibung |
|------|-----|-----------|--------------|
| `id` | `Int` | `id` | PK, autoincrement |
| `propertyId` | `Int` | `property_id` | FK → Property, unique |
| `companyId` | `Int` | `company_id` | Multi-Tenancy-Guard |
| `certificateType` | `EnergyPassportType` | `certificate_type` | Verbrauchsausweis / Bedarfsausweis |
| `energyClass` | `String` | `energy_class` | `A+`, `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H` |
| `primaryEnergyDemand` | `Float?` | `primary_energy_demand` | Primärenergiebedarf kWh/m²a |
| `finalEnergyDemand` | `Float?` | `final_energy_demand` | Endenergiebedarf kWh/m²a |
| `energyCarrier` | `String?` | `energy_carrier` | z.B. Gas, Heizöl, Fernwärme |
| `issuedAt` | `DateTime` | `issued_at` | Ausstellungsdatum |
| `validUntil` | `DateTime` | `valid_until` | Ablaufdatum (i.d.R. issuedAt + 10 Jahre) |
| `certificateNumber` | `String?` | `certificate_number` | Ausweis-Nummer |
| `createdAt` | `DateTime` | `created_at` | `@default(now())` |
| `updatedAt` | `DateTime` | `updated_at` | `@updatedAt` |

```prisma
enum EnergyPassportType {
  VERBRAUCH
  BEDARF
}

model EnergyPassport {
  id                   Int                @id @default(autoincrement())
  certificateType      EnergyPassportType @map("certificate_type")
  energyClass          String             @map("energy_class")
  primaryEnergyDemand  Float?             @map("primary_energy_demand")
  finalEnergyDemand    Float?             @map("final_energy_demand")
  energyCarrier        String?            @map("energy_carrier")
  issuedAt             DateTime           @map("issued_at")
  validUntil           DateTime           @map("valid_until")
  certificateNumber    String?            @map("certificate_number")
  propertyId           Int                @unique @map("property_id")
  companyId            Int                @map("company_id")
  createdAt            DateTime           @default(now()) @map("created_at")
  updatedAt            DateTime           @updatedAt @map("updated_at")

  property Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  company  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("energy_passports")
}
```

Bestehende Daten: keine Migration nötig (neues optionales Modell, kein Backfill).

## Backend — Neue Dateien

| Datei | Verantwortung |
|-------|---------------|
| `src/schemas/energy.schema.ts` | Zod-Schemas: `energyPassportSchema`, `consumptionQuerySchema`. **Hinweis:** `consumptionQuerySchema` muss `z.coerce.number()` für `propertyId` und `year` verwenden, da Query-Parameter als Strings ankommen. |
| `src/services/energy-passport.service.ts` | `getPassport(companyId, propertyId)`, `upsertPassport(companyId, propertyId, data)` |
| `src/services/energy-consumption.service.ts` | `getConsumption(companyId, propertyId, year)` — aggregiert Verbrauch aus MeterReadings |
| `src/controllers/energy.controller.ts` | Handler für alle 3 Endpunkte |
| `src/routes/energy.routes.ts` | Protected routes (requireAuth + tenantGuard + subscriptionGuard) |
| `src/test/energy-consumption.service.test.ts` | Unit tests für Aggregationslogik |

## Backend — Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `backend/prisma/schema.prisma` | `EnergyPassportType` enum + `EnergyPassport` Modell; `Property` bekommt `energyPassport EnergyPassport?`; `Company` bekommt `energyPassports EnergyPassport[]` |
| `src/routes/index.ts` | `energyRouter` registrieren |

## API Endpoints

| Method | Path | Auth | Beschreibung |
|--------|------|------|--------------|
| `GET` | `/api/energy/consumption` | requireAuth + tenantGuard + subscriptionGuard | Query: `propertyId`, `year` — gibt Monatsverbrauch pro Einheit zurück |
| `GET` | `/api/energy/passport/:propertyId` | requireAuth + tenantGuard + subscriptionGuard | Klimaausweis für Immobilie laden |
| `PUT` | `/api/energy/passport/:propertyId` | requireAuth + tenantGuard + subscriptionGuard + requireRole(ADMIN, VERWALTER) | Klimaausweis anlegen oder aktualisieren (upsert) |

## Consumption Service — Aggregationslogik

`getConsumption(companyId, propertyId, year)`:

1. Alle `Meter` der Immobilie laden, die eine `unitId` haben (property-wide Zähler ohne Unit werden ignoriert)
2. Pro Meter alle `MeterReading` im Zeitraum `[year-01-01, (year+1)-01-01]` laden, plus letztes Reading vor dem Zeitraum (für Januar-Berechnung)
3. Verbrauch pro Monat berechnen: `consumption = newerReading.value - olderReading.value`. Der Verbrauch eines Deltas wird dem **Monat der neueren Ablesung** zugeordnet. Negative Deltas (Zählertausch) werden auf `0` gesetzt.
4. Pro Einheit + Monat + MeterType summieren
5. Rückgabe-Format:

```typescript
{
  data: {
    year: number,
    units: Array<{
      unitId: number,
      unitNumber: string,
      consumption: {
        STROM: number[],   // Index 0–11 = Jan–Dez, 0 wenn keine Daten
        GAS: number[],
        WASSER: number[],
        WAERME: number[],
      }
    }>
  }
}
```

Einheiten ohne Zähler werden nicht zurückgegeben. Monate ohne Readings erhalten den Wert `0`.

## Frontend — Neue Dateien

| Datei | Verantwortung |
|-------|---------------|
| `src/pages/Energie.tsx` | Energie-Seite: Immobilien-Dropdown, Klimaausweis-Abschnitt, Verbrauchscharts |
| `src/hooks/api/useEnergy.ts` | React Query Hooks: `useConsumption`, `useEnergyPassport`, `useUpsertEnergyPassport` |

### Hook-Signaturen (`useEnergy.ts`)

```typescript
// Verbrauchsdaten — disabled wenn propertyId null
useConsumption(propertyId: number | null, year: number)
// Query key: ["consumption", propertyId, year]
// enabled: !!propertyId

// Klimaausweis laden — disabled wenn propertyId null
useEnergyPassport(propertyId: number | null)
// Query key: ["energyPassport", propertyId]
// enabled: !!propertyId

// Klimaausweis anlegen/aktualisieren (upsert)
useUpsertEnergyPassport()
// useMutation → PUT /api/energy/passport/:propertyId
// onSuccess: invalidate ["energyPassport", propertyId]
```

## Frontend — Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/App.tsx` | Route `/energie` hinzufügen |
| `src/components/AppSidebar.tsx` | Sidebar-Eintrag "Energie" (Zap-Icon, unter Finanzen) |

## Energie-Seite — UI-Beschreibung

### Struktur

```
[Immobilie auswählen ▼]   [Jahr ◀ 2026 ▶]

─── Klimaausweis ──────────────────────────────────
  [Badge: Klasse B]  Primärenergie: 95 kWh/m²a
  Endenergie: 78 kWh/m²a  |  Energieträger: Gas
  Ausgestellt: 15.03.2022  |  Gültig bis: 15.03.2032
  Typ: Verbrauchsausweis   |  Nr.: DE-12345-67890
                                        [Bearbeiten]

─── Verbrauchsübersicht ───────────────────────────
  [Tab: Strom] [Tab: Gas] [Tab: Wasser] [Tab: Wärme]

  BarChart (Recharts):
  - X-Achse: Jan–Dez
  - Y-Achse: kWh (oder m³)
  - Eine Bar-Gruppe pro Monat, eine Bar pro Einheit
  - Legende: "EG links", "OG rechts", etc.
```

### Klimaausweis-Badge (Energieklasse)

| Klasse | Farbe |
|--------|-------|
| A+, A | Grün |
| B, C | Hellgrün/Gelb-Grün |
| D, E | Gelb/Orange |
| F, G, H | Orange/Rot |

Implementiert als Tailwind-Badge mit `switch` über `energyClass`.

### Klimaausweis bearbeiten

Dialog mit Feldern:
- Typ (Verbrauchsausweis / Bedarfsausweis) — Select
- Energieklasse — Select (A+ … H)
- Primärenergiebedarf kWh/m²a — optional Number-Input
- Endenergiebedarf kWh/m²a — optional Number-Input
- Energieträger — optional Text-Input
- Ausstellungsdatum — Date-Input
- Ablaufdatum — Date-Input
- Zertifikatsnummer — optional Text-Input

### Kein-Daten-States

- Keine Immobilie ausgewählt → "Bitte eine Immobilie auswählen"
- Kein Klimaausweis → "Noch kein Klimaausweis erfasst" + Button "Klimaausweis anlegen"
- Kein Verbrauch für gewählten Typ → "Keine Verbrauchsdaten für [Typ] vorhanden — Zähler und Ablesungen unter der Immobilie erfassen"

## Error Handling

- `PUT /passport/:propertyId`: Property nicht zur companyId → 404
- `GET /consumption`: Property nicht zur companyId → 404; keine Zähler mit unitId → leere `units: []`
- Ungültige Energieklasse (nicht A+/A–H) → Zod-Validierungsfehler 400
- Negative Verbrauchswerte (Zählertausch) → werden auf `0` gesetzt, kein Fehler

## Testing

- Unit test: `getConsumption` — 2 Einheiten, je 1 Strom-Zähler, Readings in Feb + März → korrekte monatliche Deltas, Jan = 0
- Unit test: `getConsumption` — Reading-Lücke über 2 Monate (z.B. Jan + März, kein Feb) → Delta wird März zugeordnet, Feb = 0
- Unit test: `getConsumption` — Einheit ohne Zähler wird nicht zurückgegeben
- Unit test: `getConsumption` — Zähler ohne unitId (property-wide) wird ignoriert
- Unit test: `getConsumption` — negativer Delta (Zählertausch) → wird auf 0 gesetzt
- Unit test: `upsertPassport` — create + update (idempotent)

## Frontend — ⚠️ Keine zusätzlichen Features

Explizit nicht implementiert:
- CO2-Emissions-Berechnung
- Vergleich zwischen Immobilien
- Export als PDF / CSV
- Benchmarking gegen Durchschnittswerte
