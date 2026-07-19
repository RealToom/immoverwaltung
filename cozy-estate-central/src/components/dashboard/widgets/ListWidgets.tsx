import { AlertCircle, FileClock, ShieldAlert, Wrench, Ticket, CalendarClock, Leaf } from "lucide-react";
import { WidgetListPrimitive, type ListRow } from "./WidgetListPrimitive";
import { formatCurrency } from "@/lib/mappings";
import { useDunning } from "@/hooks/api/useDunning";
import { useContracts } from "@/hooks/api/useContracts";
import { useInsurancePolicies } from "@/hooks/api/useInsurance";
import { useMaintenanceSchedules } from "@/hooks/api/useMaintenanceSchedules";
import { useMaintenanceTickets } from "@/hooks/api/useMaintenanceTickets";
import { useCalendarEvents } from "@/hooks/api/useCalendarEvents";
import { useExpiringCertificates } from "@/hooks/api/useDashboard";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("de-DE") : "—";

const daysUntil = (iso?: string | null) =>
  iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : Infinity;

export function OverdueWidget() {
  const { data, isLoading } = useDunning();
  const rows: ListRow[] = (data ?? [])
    .filter((d) => d.status === "OFFEN")
    .map((d) => ({
      id: d.id,
      primary: d.contract?.tenant.name ?? `Vertrag #${d.contractId}`,
      secondary: `${d.contract?.property.name ?? ""} · Mahnstufe ${d.level}`,
      badge: formatCurrency(d.totalAmount),
    }));
  return (
    <WidgetListPrimitive title="Offene Forderungen" icon={AlertCircle} rows={rows}
      isLoading={isLoading} linkTo="/finances" emptyText="Keine offenen Mahnungen." />
  );
}

export function ExpiringContractsWidget() {
  const { data, isLoading } = useContracts();
  const rows: ListRow[] = (data?.data ?? [])
    .filter((c) => c.endDate && daysUntil(c.endDate) <= 90 && daysUntil(c.endDate) >= 0)
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
    .map((c) => ({
      id: c.id,
      primary: c.tenant.name,
      secondary: `${c.property.name} · ${c.unit.number}`,
      badge: fmtDate(c.endDate),
    }));
  return (
    <WidgetListPrimitive title="Auslaufende Verträge" icon={FileClock} rows={rows}
      isLoading={isLoading} linkTo="/contracts" emptyText="Keine Verträge laufen bald aus." />
  );
}

export function ExpiringInsurancesWidget() {
  const { data, isLoading } = useInsurancePolicies();
  const rows: ListRow[] = (data?.data ?? [])
    .filter((p) => p.endDate && daysUntil(p.endDate) <= 90 && daysUntil(p.endDate) >= 0)
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
    .map((p) => ({
      id: p.id,
      primary: p.name,
      secondary: `${p.insurer}${p.property ? ` · ${p.property.name}` : ""}`,
      badge: fmtDate(p.endDate),
    }));
  return (
    <WidgetListPrimitive title="Ablaufende Versicherungen" icon={ShieldAlert} rows={rows}
      isLoading={isLoading} linkTo="/insurance" emptyText="Keine Versicherungen laufen bald aus." />
  );
}

export function MaintenanceDueWidget() {
  const { data, isLoading } = useMaintenanceSchedules();
  const rows: ListRow[] = (data ?? [])
    .filter((m) => m.isActive && daysUntil(m.nextDue) <= 60)
    .sort((a, b) => daysUntil(a.nextDue) - daysUntil(b.nextDue))
    .map((m) => ({
      id: m.id,
      primary: m.title,
      secondary: m.property.name,
      badge: fmtDate(m.nextDue),
    }));
  return (
    <WidgetListPrimitive title="Anstehende Wartung" icon={Wrench} rows={rows}
      isLoading={isLoading} linkTo="/maintenance" emptyText="Keine anstehende Wartung." />
  );
}

export function OpenTicketsWidget() {
  const { data, isLoading } = useMaintenanceTickets();
  const rows: ListRow[] = (data?.data ?? [])
    .filter((t) => t.status !== "ERLEDIGT")
    .sort((a, b) => (a.priority === "DRINGEND" || a.priority === "HOCH" ? -1 : 1))
    .map((t) => ({
      id: t.id,
      primary: t.title,
      secondary: `${t.property.name}${t.unit ? ` · ${t.unit.number}` : ""}`,
      badge: t.priority,
    }));
  return (
    <WidgetListPrimitive title="Offene Tickets" icon={Ticket} rows={rows}
      isLoading={isLoading} linkTo="/maintenance" emptyText="Keine offenen Tickets." />
  );
}

export function UpcomingEventsWidget() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const { data, isLoading } = useCalendarEvents(now, in30);
  const rows: ListRow[] = (data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((e) => ({
      id: e.id,
      primary: e.title,
      secondary: e.description ?? undefined,
      badge: fmtDate(e.start),
    }));
  return (
    <WidgetListPrimitive title="Anstehende Termine" icon={CalendarClock} rows={rows}
      isLoading={isLoading} linkTo="/calendar" emptyText="Keine Termine in den nächsten 30 Tagen." />
  );
}

export function EnergyWidget() {
  const { data, isLoading } = useExpiringCertificates();
  const rows: ListRow[] = (data?.data ?? []).map((c) => ({
    id: c.id,
    primary: c.propertyName,
    secondary: `Energieklasse ${c.energyClass}`,
    badge: fmtDate(c.validUntil),
  }));
  return (
    <WidgetListPrimitive title="Ablaufende Energieausweise" icon={Leaf} rows={rows}
      isLoading={isLoading} linkTo="/energie" emptyText="Keine ablaufenden Energieausweise." />
  );
}
