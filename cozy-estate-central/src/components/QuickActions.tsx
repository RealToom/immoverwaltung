import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, FileText, Wrench } from "lucide-react";

const actions = [
  { label: "Immobilie hinzufügen", icon: Plus, description: "Neues Objekt anlegen", path: "/properties?action=add" },
  { label: "Mieter hinzufügen", icon: UserPlus, description: "Neuen Mieter erfassen", path: "/tenants?action=add" },
  { label: "Vertrag erstellen", icon: FileText, description: "Mietvertrag aufsetzen", path: "/contracts?action=add" },
  { label: "Wartung melden", icon: Wrench, description: "Schadensmeldung erfassen", path: "/maintenance?action=add" },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-semibold">
          Schnellaktionen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-3 px-3 hover:bg-primary/5 group"
            onClick={() => navigate(action.path)}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <action.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">
                {action.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {action.description}
              </p>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
