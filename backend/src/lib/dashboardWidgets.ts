export type LayoutItem = { key: string; x: number; y: number; w: number; h: number };

export const WIDGET_KEYS = new Set<string>([
  "kpi-properties", "kpi-tenants", "kpi-revenue", "kpi-vacancy", "kpi-units",
  "roi", "revenue-chart", "overdue",
  "expiring-contracts", "expiring-insurances", "maintenance-due",
  "open-tickets", "upcoming-events", "energy",
  "property-table", "quick-actions", "recent-activity",
]);

// Widgets, die eine Mindestrolle erfordern (sonst frei sichtbar)
export const WIDGET_MIN_ROLE: Record<string, "BUCHHALTER"> = {
  "kpi-revenue": "BUCHHALTER",
  "roi": "BUCHHALTER",
  "revenue-chart": "BUCHHALTER",
  "overdue": "BUCHHALTER",
  "quick-actions": "BUCHHALTER",
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

const RANKS: Record<string, number> = { READONLY: 1, BUCHHALTER: 2, VERWALTER: 3, ADMIN: 4 };

export function roleRank(role: string): number {
  return RANKS[role] ?? 3; // Custom-Rollen wie VERWALTER behandeln
}

export function canSeeWidget(role: string, key: string): boolean {
  const min = WIDGET_MIN_ROLE[key];
  if (!min) return true;
  return roleRank(role) >= RANKS[min];
}

export function filterLayoutForRole(items: LayoutItem[], role: string): LayoutItem[] {
  return items.filter((it) => WIDGET_KEYS.has(it.key) && canSeeWidget(role, it.key));
}
