import { WIDGET_REGISTRY } from "./registry";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";

export function WidgetRenderer({ widgetKey }: { widgetKey: string }) {
  const def = WIDGET_REGISTRY[widgetKey];
  if (!def) return null;
  const Component = def.component;
  return (
    <WidgetErrorBoundary title={def.title}>
      <Component widgetKey={widgetKey} />
    </WidgetErrorBoundary>
  );
}
