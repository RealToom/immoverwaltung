import { TrendingUp, Loader2 } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { useRoiData } from "@/hooks/api/useFinance";
import { formatCurrency } from "@/lib/mappings";

export function RoiWidget() {
  const year = new Date().getFullYear();
  const { data, isLoading } = useRoiData(year);
  const rows = data?.data ?? [];

  if (isLoading) {
    return (
      <Card className="h-full border border-border/60 shadow-sm">
        <CardContent className="flex h-full items-center justify-center p-5">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const netIncome = rows.reduce((sum, r) => sum + r.netIncome, 0);
  const withYield = rows.filter((r) => r.nettorendite != null);
  const avgYield = withYield.length
    ? withYield.reduce((s, r) => s + (r.nettorendite ?? 0), 0) / withYield.length
    : null;

  return (
    <KpiCard
      title="Rendite (Netto)"
      value={formatCurrency(netIncome)}
      change={avgYield != null ? `⌀ ${avgYield.toFixed(1)}% Nettorendite` : "Kaufpreis/EK erfassen"}
      changeType="positive"
      icon={TrendingUp}
      iconBg="bg-success/15"
      iconColor="text-success"
    />
  );
}
