# Design: Anpassbares Dashboard (Widget-System)

**Datum:** 2026-07-18
**Status:** Freigegeben (Brainstorming abgeschlossen)
**Bereich:** Frontend (cozy-estate-central) + Backend (dashboard)

## Ziel

Das feste Dashboard (`Index.tsx`) wird zu einem pro Nutzer frei anpassbaren
Widget-Dashboard: Nutzer wählen, **welche** Widgets angezeigt werden, ordnen sie
per Drag & Drop an, ändern ihre **Größe** und ergänzen **neue Kennzahlen**
(Rendite, Fristen, Aufgaben, Energie).

### Umfang (bestätigt)

- **Enthalten:** Widgets an/aus, Reihenfolge & Layout (Drag & Drop + Resize),
  neue Kennzahlen-Widgets. Persistenz **pro Nutzer**.
- **Nicht enthalten (YAGNI):** Mehrere speicherbare Dashboard-Ansichten/Profile;
  firmenweite oder rollenbasierte Vorlagen; Anpassung durch andere Nutzer.

## Architektur

Bibliothek für das Raster: **react-grid-layout** (Drag & Drop + freies Resize +
responsive Breakpoints, für Dashboards gebaut).

```
Dashboard (Index.tsx)
├── DashboardHeader        → "Dashboard anpassen"-Button (Edit-Modus an/aus)
├── DashboardGrid          → react-grid-layout, rendert aus Layout-Config
│   └── WidgetRenderer     → mappt widgetKey → Komponente (via Register)
├── WidgetLibrary (Sheet)  → Katalog zum Hinzufügen/Entfernen
└── widgets/
    ├── registry.ts        → zentrale Map widgetKey → Meta
    ├── KpiWidget          (parametrisierbar über metric-key)
    ├── RoiWidget, RevenueChartWidget, OverdueWidget
    ├── ExpiringContractsWidget, ExpiringInsurancesWidget, MaintenanceDueWidget
    ├── OpenTicketsWidget, UpcomingEventsWidget
    ├── EnergyWidget
    └── PropertyTableWidget, QuickActionsWidget, RecentActivityWidget (gekapselt)
```

### Widget-Register (Kern)

`widgets/registry.ts` ist die einzige Quelle der Wahrheit. Grid, Bibliothek und
Renderer lesen ausschließlich daraus. Ein neues Widget = ein Register-Eintrag +
eine Komponente.

```ts
interface WidgetDefinition {
  key: string;                 // z.B. "kpi-properties", "revenue-chart"
  title: string;
  category: "basis" | "finanzen" | "vertraege" | "aufgaben" | "energie";
  component: React.ComponentType<WidgetProps>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  requiredRole?: Role;         // Widget nur sichtbar, wenn Rolle >= requiredRole
}
```

**Rollen-Sicherheit:** Finanz-Widgets deklarieren `requiredRole`, sodass sie für
READONLY nicht in Katalog/Grid auftauchen. Die Filterung passiert clientseitig im
Register **und** serverseitig beim Laden des Layouts (Widgets, für die die Rolle
fehlt, werden ausgefiltert).

## Widget-Katalog

`kpi-*`-Keys tragen die Metrik im Namen: **ein** Widget-Typ (`KpiWidget`),
mehrere Instanzen.

| widgetKey                  | Titel                        | Datenquelle                              | Größe (w×h) | requiredRole |
|----------------------------|------------------------------|------------------------------------------|-------------|--------------|
| `kpi-properties`           | Immobilien                   | `/dashboard/stats`                       | 1×1         | –            |
| `kpi-tenants`              | Mieter                       | `/dashboard/stats`                       | 1×1         | –            |
| `kpi-revenue`              | Monatl. Einnahmen            | `/dashboard/stats`                       | 1×1         | BUCHHALTER   |
| `kpi-vacancy`              | Leerstand                    | `/dashboard/stats`                       | 1×1         | –            |
| `kpi-units`                | Einheiten gesamt             | `/dashboard/stats`                       | 1×1         | –            |
| `roi`                      | Rendite / ROI                | `finance/roi`                            | 1×1         | BUCHHALTER   |
| `revenue-chart`            | Einnahmen-Verlauf (12 Mon.)  | **neu** `/dashboard/revenue-series`      | 2×2         | BUCHHALTER   |
| `overdue`                  | Offene Forderungen / Mahnw.  | `useDunning`                             | 1×2         | BUCHHALTER   |
| `expiring-contracts`       | Auslaufende Verträge         | `useContracts` (endet < 90 Tage)         | 1×2         | –            |
| `expiring-insurances`      | Ablaufende Versicherungen    | `useInsurance`                           | 1×2         | –            |
| `maintenance-due`          | Anstehende Wartung           | `useMaintenanceSchedules`                | 1×2         | –            |
| `open-tickets`             | Offene/dringende Tickets     | `useMaintenanceTickets`                  | 1×2         | –            |
| `upcoming-events`          | Anstehende Termine           | `useCalendarEvents`                      | 1×2         | –            |
| `energy`                   | Energie / Zähler             | `useEnergy` / `useMeters`                | 1×2         | –            |
| `property-table`           | Immobilien-Tabelle           | bestehend (`PropertyTable`)              | 2×3         | –            |
| `quick-actions`            | Schnellaktionen              | bestehend (`QuickActions`)               | 1×1         | ≠ READONLY   |
| `recent-activity`          | Letzte Aktivität             | `/dashboard/recent-activity`             | 1×2         | –            |

Fristen-/Listen-Widgets zeigen die **Top 5** relevanter Einträge plus einen
Link „Alle anzeigen" auf die jeweilige Vollseite. Jedes Widget kapselt seinen
eigenen Lade- (Skeleton) und Fehlerzustand; ein fehlerhaftes Widget darf das
restliche Dashboard nicht mitreißen.

### Backend-Erweiterungen (minimal)

- **Neu:** `GET /dashboard/revenue-series` → Monatssummen der Einnahmen der
  letzten 12 Monate für den Chart, tenant-isoliert.
- **Optional:** `/dashboard/stats` um Zähler erweitern (`expiringContracts`,
  `overduePayments`), damit Fristen-Widgets einen Badge zeigen können, ohne die
  volle Liste zu laden. Kein Muss für die erste Version.

Alle anderen Widgets nutzen **bestehende** Endpunkte/Hooks unverändert.

## Datenmodell & Persistenz

### Prisma-Modell (folgt Multi-Tenancy-Muster)

```prisma
model DashboardLayout {
  id        Int      @id @default(autoincrement())
  userId    Int      @unique          // pro Nutzer genau eine Config
  companyId Int                        // Tenant-Isolation wie überall
  widgets   Json                       // Layout-Blob (siehe unten)
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([companyId])
}
```

### Layout-Blob (`widgets` JSON)

Array, pro Widget ein Eintrag. `x/y/w/h` liefert react-grid-layout beim
Verschieben/Resizen direkt:

```json
[
  { "key": "kpi-properties", "x": 0, "y": 0, "w": 1, "h": 1 },
  { "key": "revenue-chart",  "x": 0, "y": 1, "w": 2, "h": 2 },
  { "key": "overdue",        "x": 2, "y": 0, "w": 1, "h": 2 }
]
```

### Endpunkte

- `GET /dashboard/layout` → gespeicherte Config des Nutzers. Existiert keine, wird
  das **Standard-Layout** zurückgegeben (bildet das heutige Dashboard nach),
  rollengefiltert.
- `PUT /dashboard/layout` → speichert den Blob. **Zod-validiert:** Keys müssen im
  Register existieren, `x/y/w/h` sind nicht-negative Zahlen innerhalb der
  Grid-Grenzen und der min/max-Größe des Widgets.

### Robustheit beim Laden

Der geladene Blob wird gegen das Register abgeglichen:
- **Unbekannte Keys** (entferntes/umbenanntes Widget) → ignoriert.
- **Neue Standard-Widgets** werden **nicht** automatisch eingefügt (kein
  ungefragtes Verschieben des Nutzer-Layouts).
- Widgets, für die die Rolle des Nutzers nicht ausreicht → ausgefiltert.

### Frontend-Hooks (React Query)

- `useDashboardLayout()` (GET) — liefert normalisierte Layout-Config.
- `useSaveDashboardLayout()` (PUT) — optimistisch, **debounced**: gespeichert wird
  beim Verlassen des Edit-Modus („Speichern"), nicht bei jeder Pixel-Bewegung.

## Bearbeitungs-UX (Edit-Modus)

### Zustände

- **Ansicht** (Standard): Widgets statisch, kein Drag; volle Interaktivität
  (Links, Buttons funktionieren normal).
- **Bearbeiten** (Button „Dashboard anpassen" oben rechts): Raster wird aktiv.

### Im Edit-Modus

- Jedes Widget: **Drag-Handle** oben (Verschieben) + **X** (Entfernen).
- **Resize-Griffe** an den Kanten (react-grid-layout Standard), begrenzt durch
  `minSize`/`maxSize` des Widgets.
- **„+ Widget"** öffnet die **Widget-Bibliothek** (Shadcn `Sheet`, von rechts):
  gruppiert nach Kategorie (Basis, Finanzen, Verträge, Aufgaben, Energie), jedes
  mit Icon + Kurzbeschreibung. Bereits platzierte Widgets sind als „hinzugefügt"
  markiert. Klick fügt das Widget oben links ins Raster ein.
- Aktionen: **Speichern**, **Abbrechen** (verwirft Änderungen → letzter
  gespeicherter Stand), **Auf Standard zurücksetzen**.
- Speichern → `PUT /dashboard/layout`, Toast „Dashboard gespeichert".

### Responsiv

react-grid-layout mit Breakpoints `lg / md / sm`. Auf `sm` (Mobil) fällt alles
auf **1 Spalte**, Reihenfolge = y-Position. Drag/Resize ist primär Desktop; auf
Mobil nur Ansicht + Widgets an/aus.

### Leerer Zustand

Entfernt der Nutzer alle Widgets → freundlicher Empty-State mit „Widget
hinzufügen" und „Standard wiederherstellen".

### Barrierefreiheit

Drag-Handles sind Buttons mit `aria-label`. Als Tastatur-Fallback für die
Reihenfolge bietet jedes Widget im Edit-Modus ein Kontextmenü mit
„Nach oben / Nach unten / Entfernen".

## Testing

- **Backend:** Service-Tests für `getDashboardLayout` (Standard-Fallback,
  Rollenfilter, Ignorieren unbekannter Keys) und `saveDashboardLayout`
  (Zod-Validierung, Tenant-Isolation, Upsert pro Nutzer). Test für
  `revenue-series` (korrekte Monatsaggregation, companyId-Isolation).
- **Frontend:** Register-Konsistenz (jeder Key hat Komponente + Meta);
  Rendering der Standard-Config; Widget-Bibliothek Hinzufügen/Entfernen;
  Persistenz-Roundtrip (Layout ändern → speichern → neu laden).

## Offene technische Notizen

- react-grid-layout benötigt eigenes CSS-Anpassen für Shadcn/Dark-Mode
  (Griffe, Platzhalter, Hintergrund). Wird in der Umsetzung mit Tailwind-Klassen
  überschrieben.
- `companyId` im Layout-Endpunkt kommt wie überall aus `req.companyId`
  (tenantGuard); `userId` aus dem JWT.
```
