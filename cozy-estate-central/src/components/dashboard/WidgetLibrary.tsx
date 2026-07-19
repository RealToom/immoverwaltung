import { Check, Plus } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { getVisibleWidgets } from "./registry";
import type { WidgetCategory } from "./types";

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  basis: "Basis",
  finanzen: "Finanzen",
  vertraege: "Verträge & Fristen",
  aufgaben: "Aufgaben & Termine",
  energie: "Energie",
};

const ORDER: WidgetCategory[] = ["basis", "finanzen", "vertraege", "aufgaben", "energie"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  activeKeys: string[];
  onAdd: (key: string) => void;
}

export function WidgetLibrary({ open, onOpenChange, role, activeKeys, onAdd }: Props) {
  const widgets = getVisibleWidgets(role);
  const active = new Set(activeKeys);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-auto">
        <SheetHeader>
          <SheetTitle>Widget hinzufügen</SheetTitle>
          <SheetDescription>Wähle Kacheln für dein Dashboard.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {ORDER.map((cat) => {
            const inCat = widgets.filter((w) => w.category === cat);
            if (inCat.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="space-y-2">
                  {inCat.map((w) => {
                    const isActive = active.has(w.key);
                    const Icon = w.icon;
                    return (
                      <button
                        key={w.key}
                        type="button"
                        disabled={isActive}
                        onClick={() => onAdd(w.key)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{w.title}</p>
                          <p className="text-xs text-muted-foreground">{w.description}</p>
                        </div>
                        {isActive ? (
                          <Check className="h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
