import { useState } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import { GripVertical, X } from "lucide-react";
import { WidgetRenderer } from "./WidgetRenderer";
import { WIDGET_REGISTRY } from "./registry";
import {
  GRID_COLS, GRID_BREAKPOINTS, GRID_ROW_HEIGHT, GRID_MARGIN, type LayoutItem,
} from "./types";
import "./gridStyles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Props {
  items: LayoutItem[];
  editMode: boolean;
  onLayoutChange: (items: LayoutItem[]) => void;
  onRemove: (key: string) => void;
}

export function DashboardGrid({ items, editMode, onLayoutChange, onRemove }: Props) {
  const [breakpoint, setBreakpoint] = useState<string>("lg");

  const rglLayout: Layout[] = items.map((it) => {
    const def = WIDGET_REGISTRY[it.key];
    return {
      i: it.key, x: it.x, y: it.y, w: it.w, h: it.h,
      minW: def?.minSize.w, minH: def?.minSize.h,
      maxW: def?.maxSize?.w, maxH: def?.maxSize?.h,
    };
  });

  const canEdit = editMode && breakpoint === "lg";

  return (
    <div className={editMode ? "dashboard-edit" : "dashboard-view"}>
      <ResponsiveGridLayout
        layouts={{ lg: rglLayout }}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        margin={GRID_MARGIN}
        isDraggable={canEdit}
        isResizable={canEdit}
        draggableHandle=".widget-drag-handle"
        onBreakpointChange={setBreakpoint}
        onLayoutChange={(current) => {
          if (!canEdit) return;
          onLayoutChange(current.map((l) => ({ key: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
        }}
      >
        {items.map((it) => (
          <div key={it.key} className="relative">
            {editMode && (
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between rounded-t-xl bg-muted/80 px-2 py-1 backdrop-blur">
                <button
                  type="button"
                  aria-label={`${WIDGET_REGISTRY[it.key]?.title ?? it.key} verschieben`}
                  className="widget-drag-handle cursor-move text-muted-foreground hover:text-foreground"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`${WIDGET_REGISTRY[it.key]?.title ?? it.key} entfernen`}
                  onClick={() => onRemove(it.key)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className={`h-full ${editMode ? "pt-7" : ""}`}>
              <WidgetRenderer widgetKey={it.key} />
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
