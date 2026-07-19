import {
  Building2, Users, CreditCard, AlertTriangle, LayoutGrid, TrendingUp, AlertCircle,
  FileClock, ShieldAlert, Wrench, Ticket, CalendarClock, Leaf, Table, Zap, Activity,
} from "lucide-react";
import type { WidgetDefinition, LayoutItem } from "./types";
import { canSeeWidget } from "./types";
import { KpiWidget } from "./widgets/KpiWidget";
import { PropertyTableWidget, QuickActionsWidget, RecentActivityWidget } from "./widgets/ExistingWidgets";
import {
  OverdueWidget, ExpiringContractsWidget, ExpiringInsurancesWidget,
  MaintenanceDueWidget, OpenTicketsWidget, UpcomingEventsWidget, EnergyWidget,
} from "./widgets/ListWidgets";
import { RoiWidget } from "./widgets/RoiWidget";
import { RevenueChartWidget } from "./widgets/RevenueChartWidget";

const KPI = { defaultSize: { w: 1, h: 1 }, minSize: { w: 1, h: 1 }, maxSize: { w: 2, h: 2 } };
const LIST = { defaultSize: { w: 1, h: 2 }, minSize: { w: 1, h: 2 }, maxSize: { w: 2, h: 4 } };

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  "kpi-properties": { key: "kpi-properties", title: "Immobilien", description: "Anzahl Immobilien & Einheiten", category: "basis", icon: Building2, component: KpiWidget, ...KPI },
  "kpi-tenants": { key: "kpi-tenants", title: "Mieter", description: "Anzahl Mieter & belegte Einheiten", category: "basis", icon: Users, component: KpiWidget, ...KPI },
  "kpi-revenue": { key: "kpi-revenue", title: "Monatl. Einnahmen", description: "Summe der monatlichen Mieteinnahmen", category: "finanzen", icon: CreditCard, component: KpiWidget, requiredRole: "BUCHHALTER", ...KPI },
  "kpi-vacancy": { key: "kpi-vacancy", title: "Leerstand", description: "Leerstehende Einheiten & Quote", category: "basis", icon: AlertTriangle, component: KpiWidget, ...KPI },
  "kpi-units": { key: "kpi-units", title: "Einheiten gesamt", description: "Gesamtzahl aller Einheiten", category: "basis", icon: LayoutGrid, component: KpiWidget, ...KPI },
  "roi": { key: "roi", title: "Rendite / ROI", description: "Netto-Ertrag & Nettorendite", category: "finanzen", icon: TrendingUp, component: RoiWidget, requiredRole: "BUCHHALTER", ...KPI },
  "revenue-chart": { key: "revenue-chart", title: "Einnahmen-Verlauf", description: "Einnahmen der letzten 12 Monate", category: "finanzen", icon: Activity, component: RevenueChartWidget, requiredRole: "BUCHHALTER", defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 4, h: 3 } },
  "overdue": { key: "overdue", title: "Offene Forderungen", description: "Überfällige Mieten / Mahnwesen", category: "finanzen", icon: AlertCircle, component: OverdueWidget, requiredRole: "BUCHHALTER", ...LIST },
  "expiring-contracts": { key: "expiring-contracts", title: "Auslaufende Verträge", description: "Verträge, die < 90 Tage enden", category: "vertraege", icon: FileClock, component: ExpiringContractsWidget, ...LIST },
  "expiring-insurances": { key: "expiring-insurances", title: "Ablaufende Versicherungen", description: "Policen, die bald enden", category: "vertraege", icon: ShieldAlert, component: ExpiringInsurancesWidget, ...LIST },
  "maintenance-due": { key: "maintenance-due", title: "Anstehende Wartung", description: "Fällige Wartungstermine", category: "vertraege", icon: Wrench, component: MaintenanceDueWidget, ...LIST },
  "open-tickets": { key: "open-tickets", title: "Offene Tickets", description: "Offene & dringende Tickets", category: "aufgaben", icon: Ticket, component: OpenTicketsWidget, ...LIST },
  "upcoming-events": { key: "upcoming-events", title: "Anstehende Termine", description: "Termine der nächsten 30 Tage", category: "aufgaben", icon: CalendarClock, component: UpcomingEventsWidget, ...LIST },
  "energy": { key: "energy", title: "Ablaufende Energieausweise", description: "Energieausweise mit naher Frist", category: "energie", icon: Leaf, component: EnergyWidget, ...LIST },
  "property-table": { key: "property-table", title: "Immobilien-Tabelle", description: "Übersicht aller Immobilien", category: "basis", icon: Table, component: PropertyTableWidget, defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 3 }, maxSize: { w: 4, h: 6 } },
  "quick-actions": { key: "quick-actions", title: "Schnellaktionen", description: "Häufige Aktionen", category: "basis", icon: Zap, component: QuickActionsWidget, requiredRole: "BUCHHALTER", ...KPI },
  "recent-activity": { key: "recent-activity", title: "Letzte Aktivität", description: "Neueste Ereignisse", category: "basis", icon: Activity, component: RecentActivityWidget, ...LIST },
};

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { key: "kpi-properties",  x: 0, y: 0, w: 1, h: 1 },
  { key: "kpi-tenants",     x: 1, y: 0, w: 1, h: 1 },
  { key: "kpi-revenue",     x: 2, y: 0, w: 1, h: 1 },
  { key: "kpi-vacancy",     x: 3, y: 0, w: 1, h: 1 },
  { key: "property-table",  x: 0, y: 1, w: 3, h: 4 },
  { key: "quick-actions",   x: 3, y: 1, w: 1, h: 1 },
  { key: "recent-activity", x: 3, y: 2, w: 1, h: 3 },
];

export function getVisibleWidgets(role: string): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter((def) => canSeeWidget(role, def));
}

export function normalizeLayout(items: LayoutItem[], role: string): LayoutItem[] {
  return items.filter((it) => {
    const def = WIDGET_REGISTRY[it.key];
    return def && canSeeWidget(role, def);
  });
}
