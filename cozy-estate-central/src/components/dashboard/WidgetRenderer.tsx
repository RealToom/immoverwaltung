import { WIDGET_REGISTRY } from "./registry";

export function WidgetRenderer({ widgetKey }: { widgetKey: string }) {
  const def = WIDGET_REGISTRY[widgetKey];
  if (!def) return null;
  const Component = def.component;
  return <Component widgetKey={widgetKey} />;
}
