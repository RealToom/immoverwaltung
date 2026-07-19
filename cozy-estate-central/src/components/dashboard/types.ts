import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type LayoutItem = { key: string; x: number; y: number; w: number; h: number };

export interface WidgetProps {
  widgetKey: string;
}

export type WidgetCategory = "basis" | "finanzen" | "vertraege" | "aufgaben" | "energie";

export interface WidgetDefinition {
  key: string;
  title: string;
  description: string;
  category: WidgetCategory;
  icon: LucideIcon;
  component: ComponentType<WidgetProps>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  requiredRole?: "BUCHHALTER";
}

export const GRID_COLS = { lg: 4, md: 2, sm: 1 };
export const GRID_BREAKPOINTS = { lg: 1024, md: 640, sm: 0 };
export const GRID_ROW_HEIGHT = 120;
export const GRID_MARGIN: [number, number] = [16, 16];

const RANKS: Record<string, number> = { READONLY: 1, BUCHHALTER: 2, VERWALTER: 3, ADMIN: 4 };

export function roleRank(role: string): number {
  return RANKS[role] ?? 3;
}

export function canSeeWidget(role: string, def: WidgetDefinition): boolean {
  if (!def.requiredRole) return true;
  return roleRank(role) >= RANKS[def.requiredRole];
}
