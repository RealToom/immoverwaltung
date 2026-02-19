import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  AlertTriangle,
  FileText,
  Wrench,
  Calendar,
  Clock,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContracts } from "@/hooks/api/useContracts";
import { useMaintenanceTickets } from "@/hooks/api/useMaintenanceTickets";
import { mapContractStatus, mapReminderType, mapMaintenanceStatus, mapMaintenancePriority, formatDate } from "@/lib/mappings";

interface Notification {
  id: string;
  type: "vertrag" | "ticket" | "termin";
  title: string;
  description: string;
  date: string;
  urgency: "kritisch" | "warnung" | "info";
  link: string;
  source: string;
}

const urgencyConfig = {
  kritisch: { label: "Kritisch", class: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle },
  warnung: { label: "Warnung", class: "bg-warning/15 text-warning-foreground border-warning/30", icon: Clock },
  info: { label: "Info", class: "bg-primary/10 text-primary border-primary/20", icon: Bell },
};

const typeConfig = {
  vertrag: { label: "Vertrag", icon: FileText, color: "text-primary" },
  ticket: { label: "Ticket", icon: Wrench, color: "text-destructive" },
  termin: { label: "Termin", icon: Calendar, color: "text-warning" },
};

const Notifications = () => {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>("alle");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("alle");

  const { data: contractsRes, isLoading: contractsLoading } = useContracts();
  const { data: ticketsRes, isLoading: ticketsLoading } = useMaintenanceTickets();

  const isLoading = contractsLoading || ticketsLoading;
  const contracts = contractsRes?.data ?? [];
  const tickets = ticketsRes?.data ?? [];

  const notifications = useMemo<Notification[]>(() => {
    const items: Notification[] = [];

    contracts.forEach((c) => {
      const status = mapContractStatus(c.status);
      if (status === "auslaufend") {
        items.push({
          id: `c-exp-${c.id}`,
          type: "vertrag",
          title: `Vertrag läuft aus: ${c.tenant.name}`,
          description: `${c.property.name}, Einheit ${c.unit.number} – Enddatum: ${formatDate(c.endDate)}`,
          date: c.endDate ?? "",
          urgency: "kritisch",
          link: "/contracts",
          source: c.property.name,
        });
      }
      if (status === "gekuendigt") {
        items.push({
          id: `c-cancel-${c.id}`,
          type: "vertrag",
          title: `Vertrag gekündigt: ${c.tenant.name}`,
          description: `${c.property.name}, Einheit ${c.unit.number} – Ende: ${formatDate(c.endDate)}`,
          date: c.endDate ?? "",
          urgency: "warnung",
          link: "/contracts",
          source: c.property.name,
        });
      }
      if (c.nextReminder && c.reminderType && status !== "gekuendigt" && status !== "auslaufend") {
        items.push({
          id: `c-rem-${c.id}`,
          type: "termin",
          title: `${mapReminderType(c.reminderType) ?? c.reminderType}: ${c.tenant.name}`,
          description: `${c.property.name}, Einheit ${c.unit.number} – Fällig: ${formatDate(c.nextReminder)}`,
          date: c.nextReminder,
          urgency: "info",
          link: "/contracts",
          source: c.property.name,
        });
      }
    });

    tickets.forEach((t) => {
      const status = mapMaintenanceStatus(t.status);
      if (status === "erledigt") return;

      const priority = mapMaintenancePriority(t.priority);
      const isUrgent = priority === "dringend" || priority === "hoch";
      const statusLabel = status === "offen" ? "Offenes Ticket"
        : status === "wartend" ? "Wartendes Ticket"
        : "Ticket in Bearbeitung";

      items.push({
        id: `t-${t.id}`,
        type: "ticket",
        title: `${statusLabel}: ${t.title}`,
        description: `${t.property.name}, ${t.unitLabel || t.unit?.number || "–"}${t.assignedTo ? ` – Zugewiesen: ${t.assignedTo}` : ""}${t.dueDate ? ` – Fällig: ${formatDate(t.dueDate)}` : ""}`,
        date: t.dueDate ?? t.createdAt,
        urgency: isUrgent ? "kritisch" : "warnung",
        link: "/maintenance",
        source: t.property.name,
      });
    });

    return items;
  }, [contracts, tickets]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const matchType = typeFilter === "alle" || n.type === typeFilter;
      const matchUrgency = urgencyFilter === "alle" || n.urgency === urgencyFilter;
      return matchType && matchUrgency;
    });
  }, [notifications, typeFilter, urgencyFilter]);

  const stats = useMemo(() => ({
    total: notifications.length,
    kritisch: notifications.filter((n) => n.urgency === "kritisch").length,
    vertraege: notifications.filter((n) => n.type === "vertrag").length,
    tickets: notifications.filter((n) => n.type === "ticket").length,
    termine: notifications.filter((n) => n.type === "termin").length,
  }), [notifications]);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Benachrichtigungen</h1>
          <p className="text-xs text-muted-foreground">{stats.total} aktive Meldungen</p>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                  <div className="text-2xl font-bold font-heading text-foreground">{stats.kritisch}</div>
                  <div className="text-xs text-muted-foreground">Kritisch</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <div className="text-2xl font-bold font-heading text-foreground">{stats.vertraege}</div>
                  <div className="text-xs text-muted-foreground">Verträge</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Wrench className="h-5 w-5 mx-auto mb-1 text-destructive/70" />
                  <div className="text-2xl font-bold font-heading text-foreground">{stats.tickets}</div>
                  <div className="text-xs text-muted-foreground">Tickets</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="h-5 w-5 mx-auto mb-1 text-warning" />
                  <div className="text-2xl font-bold font-heading text-foreground">{stats.termine}</div>
                  <div className="text-xs text-muted-foreground">Termine</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Typen</SelectItem>
                      <SelectItem value="vertrag">Verträge</SelectItem>
                      <SelectItem value="ticket">Tickets</SelectItem>
                      <SelectItem value="termin">Termine</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Dringlichkeiten</SelectItem>
                      <SelectItem value="kritisch">Kritisch</SelectItem>
                      <SelectItem value="warnung">Warnung</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Notification list */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                    Keine Benachrichtigungen in dieser Kategorie
                  </CardContent>
                </Card>
              ) : (
                filtered.map((n) => {
                  const urg = urgencyConfig[n.urgency];
                  const typ = typeConfig[n.type];
                  const TypeIcon = typ.icon;
                  const UrgIcon = urg.icon;

                  return (
                    <Card
                      key={n.id}
                      className="border border-border/60 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(n.link)}
                    >
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 ${typ.color}`}>
                          <TypeIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-foreground truncate">{n.title}</span>
                            <Badge variant="outline" className={`shrink-0 text-[10px] ${urg.class}`}>
                              <UrgIcon className="h-3 w-3 mr-0.5" />
                              {urg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{n.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDate(n.date)}
                            </span>
                            <Badge variant="outline" className="text-[10px] border-border">{typ.label}</Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-2" />
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Notifications;
