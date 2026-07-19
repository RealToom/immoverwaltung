import { Link } from "react-router-dom";
import { Loader2, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ListRow {
  id: string | number;
  primary: string;
  secondary?: string;
  badge?: string;
}

interface Props {
  title: string;
  icon: LucideIcon;
  rows: ListRow[];
  isLoading: boolean;
  linkTo: string;
  emptyText: string;
}

export function WidgetListPrimitive({ title, icon: Icon, rows, isLoading, linkTo, emptyText }: Props) {
  return (
    <Card className="h-full flex flex-col border border-border/60 shadow-sm">
      <CardHeader className="pb-3 flex-row items-center gap-2 space-y-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="font-heading text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyText}</p>
        ) : (
          <>
            {rows.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.primary}</p>
                  {r.secondary && (
                    <p className="text-xs text-muted-foreground truncate">{r.secondary}</p>
                  )}
                </div>
                {r.badge && (
                  <span className="text-xs font-medium text-muted-foreground shrink-0">{r.badge}</span>
                )}
              </div>
            ))}
            <Link to={linkTo} className="block text-xs font-medium text-primary hover:underline pt-1">
              Alle anzeigen →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
