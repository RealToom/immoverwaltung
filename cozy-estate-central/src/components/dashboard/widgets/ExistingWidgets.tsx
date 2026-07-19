import { PropertyTable } from "@/components/PropertyTable";
import { QuickActions } from "@/components/QuickActions";
import { RecentActivity } from "@/components/RecentActivity";
import type { WidgetProps } from "../types";

export function PropertyTableWidget(_: WidgetProps) {
  return <PropertyTable />;
}

export function QuickActionsWidget(_: WidgetProps) {
  return <QuickActions />;
}

export function RecentActivityWidget(_: WidgetProps) {
  return <RecentActivity />;
}
