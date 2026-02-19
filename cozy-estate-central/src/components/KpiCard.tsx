import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
}

export function KpiCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
}: KpiCardProps) {
  const changeColors = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  };

  return (
    <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-heading font-bold text-foreground">
              {value}
            </p>
            {change && (
              <p className={`text-xs font-medium ${changeColors[changeType]}`}>
                {change}
              </p>
            )}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
