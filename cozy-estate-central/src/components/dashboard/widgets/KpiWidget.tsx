import { Building2, Users, CreditCard, AlertTriangle, LayoutGrid, Loader2, type LucideIcon } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/api/useDashboard";
import { formatCurrency } from "@/lib/mappings";
import type { WidgetProps } from "../types";

interface Stats {
  properties: number; totalUnits: number; occupiedUnits: number; vacantUnits: number;
  tenants: number; monthlyRevenue: number; openTickets: number;
}

interface KpiConfig {
  title: string;
  icon: LucideIcon;
  value: (s: Stats) => string;
  change: (s: Stats) => string;
  changeType: "positive" | "negative" | "neutral";
  iconBg?: string;
  iconColor?: string;
}

const vacancyRate = (s: Stats) =>
  s.totalUnits > 0 ? Math.round((s.vacantUnits / s.totalUnits) * 1000) / 10 : 0;

const KPI: Record<string, KpiConfig> = {
  "kpi-properties": {
    title: "Immobilien", icon: Building2, changeType: "positive",
    value: (s) => String(s.properties), change: (s) => `${s.totalUnits} Einheiten gesamt`,
  },
  "kpi-tenants": {
    title: "Mieter", icon: Users, changeType: "positive",
    iconBg: "bg-accent/15", iconColor: "text-accent-foreground",
    value: (s) => String(s.tenants), change: (s) => `${s.occupiedUnits} belegte Einheiten`,
  },
  "kpi-revenue": {
    title: "Monatl. Einnahmen", icon: CreditCard, changeType: "positive",
    iconBg: "bg-success/15", iconColor: "text-success",
    value: (s) => formatCurrency(s.monthlyRevenue), change: (s) => `${s.openTickets} offene Tickets`,
  },
  "kpi-vacancy": {
    title: "Leerstand", icon: AlertTriangle, changeType: "negative",
    iconBg: "bg-destructive/10", iconColor: "text-destructive",
    value: (s) => String(s.vacantUnits), change: (s) => `${vacancyRate(s)}% Leerstandsquote`,
  },
  "kpi-units": {
    title: "Einheiten gesamt", icon: LayoutGrid, changeType: "neutral",
    value: (s) => String(s.totalUnits), change: (s) => `${s.occupiedUnits} belegt`,
  },
};

export function KpiWidget({ widgetKey }: WidgetProps) {
  const { data, isLoading } = useDashboardStats();
  const cfg = KPI[widgetKey] ?? KPI["kpi-properties"];
  const stats = data?.data;

  if (isLoading || !stats) {
    return (
      <Card className="h-full border border-border/60 shadow-sm">
        <CardContent className="flex h-full items-center justify-center p-5">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <KpiCard
      title={cfg.title}
      value={cfg.value(stats)}
      change={cfg.change(stats)}
      changeType={cfg.changeType}
      icon={cfg.icon}
      iconBg={cfg.iconBg}
      iconColor={cfg.iconColor}
    />
  );
}
