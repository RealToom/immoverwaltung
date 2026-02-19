import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, UserPlus, Wrench, Loader2 } from "lucide-react";
import { useRecentActivity, type ActivityItem } from "@/hooks/api/useDashboard";

const iconMap: Record<ActivityItem["type"], { icon: typeof CreditCard; color: string; bg: string }> = {
  payment: { icon: CreditCard, color: "text-success", bg: "bg-success/10" },
  tenant: { icon: UserPlus, color: "text-primary", bg: "bg-primary/10" },
  maintenance: { icon: Wrench, color: "text-warning", bg: "bg-warning/10" },
};

export function RecentActivity() {
  const { data, isLoading } = useRecentActivity();
  const activities = data?.data ?? [];

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-semibold">
          Letzte Aktivitäten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Noch keine Aktivitäten vorhanden.
          </p>
        ) : (
          activities.map((activity, i) => {
            const { icon: Icon, color, bg } = iconMap[activity.type] ?? iconMap.payment;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.text}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.detail}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {activity.time}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
