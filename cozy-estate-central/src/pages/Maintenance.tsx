import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Calendar,
  User,
  MessageSquare,
  Loader2,
  ListChecks,
  Trash2,
  Pencil,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMaintenanceTickets, useCreateMaintenanceTicket, useUpdateMaintenanceTicket, useDeleteMaintenanceTicket, type MaintenanceTicketItem } from "@/hooks/api/useMaintenanceTickets";
import { useMaintenanceSchedules, useCreateMaintenanceSchedule, useUpdateMaintenanceSchedule, useDeleteMaintenanceSchedule, type MaintenanceSchedule } from "@/hooks/api/useMaintenanceSchedules";
import { useProperties } from "@/hooks/api/useProperties";
import {
  mapMaintenanceCategory,
  mapMaintenancePriority,
  mapMaintenanceStatus,
  toBackendMaintenanceCategory,
  toBackendMaintenancePriority,
  toBackendMaintenanceStatus,
  formatDate,
} from "@/lib/mappings";

const priorityConfig: Record<string, { label: string; class: string }> = {
  dringend: { label: "Dringend", class: "bg-destructive/15 text-destructive border-destructive/30" },
  hoch: { label: "Hoch", class: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  mittel: { label: "Mittel", class: "bg-warning/15 text-warning-foreground border-warning/30" },
  niedrig: { label: "Niedrig", class: "bg-muted text-muted-foreground border-border" },
};

const statusConfigMap: Record<string, { label: string; class: string; icon: typeof AlertTriangle }> = {
  offen: { label: "Offen", class: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
  in_bearbeitung: { label: "In Bearbeitung", class: "bg-primary/10 text-primary border-primary/20", icon: Clock },
  wartend: { label: "Wartend", class: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  erledigt: { label: "Erledigt", class: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
};

const categoryIcons: Record<string, string> = {
  "Sanitär": "🔧",
  Elektrik: "⚡",
  Heizung: "🔥",
  "Gebäude": "🏢",
  "Außenanlage": "🌳",
  Sonstiges: "📋",
};

const Maintenance = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [priorityFilter, setPriorityFilter] = useState<string>("alle");
  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<MaintenanceTicketItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    priority: "",
    status: "",
    assignedTo: "",
    dueDate: "",
    cost: "",
    notes: "",
  });

  useEffect(() => {
    if (searchParams.get("action") === "add" && user?.role !== "READONLY") {
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, user]);

  const backendStatus = statusFilter !== "alle" ? toBackendMaintenanceStatus(statusFilter) : undefined;
  const backendPriority = priorityFilter !== "alle" ? toBackendMaintenancePriority(priorityFilter) : undefined;
  const backendCategory = categoryFilter !== "alle" ? toBackendMaintenanceCategory(categoryFilter) : undefined;

  const { data: ticketsResponse, isLoading } = useMaintenanceTickets(
    search || undefined,
    backendStatus,
    backendPriority,
    backendCategory,
  );
  const { data: propertiesResponse } = useProperties();
  const createTicket = useCreateMaintenanceTicket();
  const updateTicket = useUpdateMaintenanceTicket();
  const deleteTicket = useDeleteMaintenanceTicket();

  const tickets = ticketsResponse?.data ?? [];
  const properties = propertiesResponse?.data ?? [];

  // Wartungsplan state
  const { data: schedulesRes } = useMaintenanceSchedules();
  const schedules = schedulesRes ?? [];
  const createSchedule = useCreateMaintenanceSchedule();
  const deleteSchedule = useDeleteMaintenanceSchedule();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const EMPTY_SCHEDULE = {
    title: "", description: "", category: "SANITAER", interval: "JAEHRLICH",
    nextDue: new Date().toISOString().slice(0, 10), assignedTo: "", propertyId: "",
  };
  const [newSchedule, setNewSchedule] = useState(EMPTY_SCHEDULE);
  const updateSchedule = useUpdateMaintenanceSchedule();
  const [editSchedule, setEditSchedule] = useState<MaintenanceSchedule | null>(null);
  const [editScheduleForm, setEditScheduleForm] = useState({
    title: "",
    description: "",
    category: "",
    interval: "",
    nextDue: "",
    assignedTo: "",
  });

  const openEditSchedule = (s: MaintenanceSchedule) => {
    setEditSchedule(s);
    setEditScheduleForm({
      title: s.title,
      description: s.description ?? "",
      category: s.category,
      interval: s.interval,
      nextDue: s.nextDue ? (() => { const d = new Date(s.nextDue); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; })() : "",
      assignedTo: s.assignedTo ?? "",
    });
  };

  const handleSaveSchedule = async () => {
    if (!editSchedule) return;
    try {
      await updateSchedule.mutateAsync({
        id: editSchedule.id,
        title: editScheduleForm.title,
        description: editScheduleForm.description || undefined,
        category: editScheduleForm.category || undefined,
        interval: editScheduleForm.interval || undefined,
        nextDue: editScheduleForm.nextDue ? new Date(editScheduleForm.nextDue + "T12:00:00Z").toISOString() : undefined,
        assignedTo: editScheduleForm.assignedTo || undefined,
      });
      toast({ title: "Gespeichert", description: "Wartungsplan wurde aktualisiert." });
      setEditSchedule(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Fehler beim Speichern", description: msg, variant: "destructive" });
    }
  };

  const INTERVAL_LABELS: Record<string, string> = {
    MONATLICH: "Monatlich", VIERTELJAEHRLICH: "Vierteljährlich",
    HALBJAEHRLICH: "Halbjährlich", JAEHRLICH: "Jährlich",
  };
  const CATEGORY_LABELS: Record<string, string> = {
    SANITAER: "Sanitär", ELEKTRIK: "Elektrik", HEIZUNG: "Heizung",
    GEBAEUDE: "Gebäude", AUSSENANLAGE: "Außenanlage", SONSTIGES: "Sonstiges",
  };

  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    propertyId: "",
    unitLabel: "",
    reportedBy: "",
    category: "",
    priority: "",
    dueDate: "",
    assignedTo: "",
  });

  const stats = useMemo(() => {
    const open = tickets.filter((t) => mapMaintenanceStatus(t.status) === "offen").length;
    const inProgress = tickets.filter((t) => mapMaintenanceStatus(t.status) === "in_bearbeitung").length;
    const waiting = tickets.filter((t) => mapMaintenanceStatus(t.status) === "wartend").length;
    const done = tickets.filter((t) => mapMaintenanceStatus(t.status) === "erledigt").length;
    const urgent = tickets.filter((t) => {
      const p = mapMaintenancePriority(t.priority);
      const s = mapMaintenanceStatus(t.status);
      return (p === "dringend" || p === "hoch") && s !== "erledigt";
    }).length;
    const totalCost = tickets.filter((t) => t.cost).reduce((sum, t) => sum + (t.cost || 0), 0);
    return { open, inProgress, waiting, done, urgent, totalCost };
  }, [tickets]);

  const handleCreate = async () => {
    if (!newTicket.title || !newTicket.propertyId || !newTicket.category || !newTicket.priority) {
      toast({ title: "Bitte alle Pflichtfelder ausfüllen", variant: "destructive" });
      return;
    }
    try {
      await createTicket.mutateAsync({
        title: newTicket.title,
        description: newTicket.description || "",
        propertyId: Number(newTicket.propertyId),
        unitLabel: newTicket.unitLabel || "Allgemein",
        reportedBy: newTicket.reportedBy || "Hausverwaltung",
        category: toBackendMaintenanceCategory(newTicket.category),
        priority: toBackendMaintenancePriority(newTicket.priority),
        status: "OFFEN",
        dueDate: newTicket.dueDate ? new Date(newTicket.dueDate).toISOString() : null,
        assignedTo: newTicket.assignedTo || null,
      });
      setCreateOpen(false);
      setNewTicket({ title: "", description: "", propertyId: "", unitLabel: "", reportedBy: "", category: "", priority: "", dueDate: "", assignedTo: "" });
      toast({ title: "Ticket erstellt", description: `"${newTicket.title}" wurde angelegt.` });
    } catch {
      toast({ title: "Fehler", description: "Ticket konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const openDetail = (ticket: MaintenanceTicketItem) => {
    setDetailTicket(ticket);
    setEditForm({
      title: ticket.title,
      description: ticket.description ?? "",
      category: mapMaintenanceCategory(ticket.category),
      priority: mapMaintenancePriority(ticket.priority),
      status: mapMaintenanceStatus(ticket.status),
      assignedTo: ticket.assignedTo ?? "",
      dueDate: ticket.dueDate ? (() => { const d = new Date(ticket.dueDate!); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })() : "",
      cost: ticket.cost != null ? String(ticket.cost) : "",
      notes: ticket.notes ?? "",
    });
  };

  const handleSaveTicket = async () => {
    if (!detailTicket) return;
    try {
      await updateTicket.mutateAsync({
        id: detailTicket.id,
        data: {
          title: editForm.title,
          description: editForm.description,
          category: toBackendMaintenanceCategory(editForm.category),
          priority: toBackendMaintenancePriority(editForm.priority),
          status: toBackendMaintenanceStatus(editForm.status),
          assignedTo: editForm.assignedTo || null,
          dueDate: editForm.dueDate ? new Date(editForm.dueDate + "T12:00:00Z").toISOString() : null,
          cost: editForm.cost ? parseFloat(editForm.cost) : null,
          notes: editForm.notes || null,
        },
      });
      toast({ title: "Gespeichert", description: "Ticket wurde aktualisiert." });
      setDetailTicket(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Fehler beim Speichern", description: msg, variant: "destructive" });
    }
  };

  const handleDeleteTicket = async () => {
    if (!detailTicket) return;
    try {
      await deleteTicket.mutateAsync(detailTicket.id);
      toast({ title: "Ticket gelöscht" });
      setDetailTicket(null);
    } catch {
      toast({ title: "Fehler", description: "Ticket konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const handleCreateSchedule = async () => {
    if (!newSchedule.title.trim() || !newSchedule.propertyId) {
      toast({ title: "Fehler", description: "Bitte Titel und Immobilie angeben.", variant: "destructive" });
      return;
    }
    try {
      await createSchedule.mutateAsync({
        title: newSchedule.title.trim(),
        description: newSchedule.description || undefined,
        category: newSchedule.category,
        interval: newSchedule.interval,
        nextDue: new Date(newSchedule.nextDue + "T12:00:00Z").toISOString(),
        assignedTo: newSchedule.assignedTo || undefined,
        propertyId: Number(newSchedule.propertyId),
      });
      toast({ title: "Gespeichert", description: "Wartungsplan wurde erstellt." });
      setNewSchedule(EMPTY_SCHEDULE);
      setScheduleOpen(false);
    } catch {
      toast({ title: "Fehler", description: "Wartungsplan konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Wartung & Tickets</h1>
          <p className="text-xs text-muted-foreground">Reparaturanfragen und Instandhaltung</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          {user?.role !== "READONLY" && (
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Neues Ticket</Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Neues Wartungsticket</DialogTitle>
              <DialogDescription>Erfassen Sie eine neue Reparaturanfrage oder Wartungsaufgabe.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Titel *</Label>
                <Input placeholder="z.B. Heizung defekt" value={newTicket.title} onChange={(e) => setNewTicket((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Beschreibung</Label>
                <Textarea placeholder="Detailbeschreibung des Problems..." value={newTicket.description} onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Immobilie *</Label>
                  <Select value={newTicket.propertyId} onValueChange={(v) => setNewTicket((p) => ({ ...p, propertyId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Einheit</Label>
                  <Input placeholder="z.B. 2A, Keller" value={newTicket.unitLabel} onChange={(e) => setNewTicket((p) => ({ ...p, unitLabel: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Kategorie *</Label>
                  <Select value={newTicket.category} onValueChange={(v) => setNewTicket((p) => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      {["Sanitär", "Elektrik", "Heizung", "Gebäude", "Außenanlage", "Sonstiges"].map((c) => (
                        <SelectItem key={c} value={c}>{categoryIcons[c]} {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Priorität *</Label>
                  <Select value={newTicket.priority} onValueChange={(v) => setNewTicket((p) => ({ ...p, priority: v }))}>
                    <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="niedrig">Niedrig</SelectItem>
                      <SelectItem value="mittel">Mittel</SelectItem>
                      <SelectItem value="hoch">Hoch</SelectItem>
                      <SelectItem value="dringend">Dringend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Gemeldet von</Label>
                  <Input placeholder="Name" value={newTicket.reportedBy} onChange={(e) => setNewTicket((p) => ({ ...p, reportedBy: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Fällig bis</Label>
                  <Input type="date" value={newTicket.dueDate} onChange={(e) => setNewTicket((p) => ({ ...p, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Zugewiesen an</Label>
                <Input placeholder="Handwerker / Firma" value={newTicket.assignedTo} onChange={(e) => setNewTicket((p) => ({ ...p, assignedTo: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreate} disabled={createTicket.isPending}>
                {createTicket.isPending ? "Erstellen..." : "Ticket erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
              <div className="text-2xl font-bold font-heading text-foreground">{stats.open}</div>
              <div className="text-xs text-muted-foreground">Offen</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold font-heading text-foreground">{stats.inProgress}</div>
              <div className="text-xs text-muted-foreground">In Bearbeitung</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-warning" />
              <div className="text-2xl font-bold font-heading text-foreground">{stats.waiting}</div>
              <div className="text-xs text-muted-foreground">Wartend</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-success" />
              <div className="text-2xl font-bold font-heading text-foreground">{stats.done}</div>
              <div className="text-xs text-muted-foreground">Erledigt</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive/70" />
              <div className="text-2xl font-bold font-heading text-foreground">{stats.urgent}</div>
              <div className="text-xs text-muted-foreground">Dringend/Hoch</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Wrench className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold font-heading text-foreground">€ {stats.totalCost.toLocaleString("de-DE")}</div>
              <div className="text-xs text-muted-foreground">Gesamtkosten</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tickets" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="tickets" className="gap-1.5">
              <Wrench className="h-4 w-4" />
              Tickets ({tickets.length})
            </TabsTrigger>
            <TabsTrigger value="wartungsplan" className="gap-1.5">
              <ListChecks className="h-4 w-4" />
              Wartungsplan ({schedules.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Suchen..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Status</SelectItem>
                  <SelectItem value="offen">Offen</SelectItem>
                  <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                  <SelectItem value="wartend">Wartend</SelectItem>
                  <SelectItem value="erledigt">Erledigt</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Prioritäten</SelectItem>
                  <SelectItem value="dringend">Dringend</SelectItem>
                  <SelectItem value="hoch">Hoch</SelectItem>
                  <SelectItem value="mittel">Mittel</SelectItem>
                  <SelectItem value="niedrig">Niedrig</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Kategorien</SelectItem>
                  {["Sanitär", "Elektrik", "Heizung", "Gebäude", "Außenanlage", "Sonstiges"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tickets ({tickets.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Immobilie / Einheit</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Priorität</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Fällig</TableHead>
                    <TableHead>Zugewiesen</TableHead>
                    <TableHead className="text-right">Kosten</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Keine Tickets gefunden</TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((ticket) => {
                      const frontendPriority = mapMaintenancePriority(ticket.priority);
                      const frontendStatus = mapMaintenanceStatus(ticket.status);
                      const frontendCategory = mapMaintenanceCategory(ticket.category);
                      const prio = priorityConfig[frontendPriority] ?? priorityConfig.niedrig;
                      const stat = statusConfigMap[frontendStatus] ?? statusConfigMap.offen;
                      const StatusIcon = stat.icon;
                      return (
                        <TableRow key={ticket.id} className="cursor-pointer" onClick={() => openDetail(ticket)}>
                          <TableCell>
                            <div className="font-medium text-foreground">{ticket.title}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{ticket.description}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-foreground">{ticket.property.name}</div>
                            <div className="text-xs text-muted-foreground">{ticket.unitLabel}</div>
                          </TableCell>
                          <TableCell><span className="text-sm">{categoryIcons[frontendCategory] ?? ""} {frontendCategory}</span></TableCell>
                          <TableCell><Badge variant="outline" className={prio.class}>{prio.label}</Badge></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={stat.class}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {stat.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(ticket.createdAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{ticket.dueDate ? formatDate(ticket.dueDate) : "–"}</TableCell>
                          <TableCell className="text-sm">{ticket.assignedTo || <span className="text-muted-foreground">–</span>}</TableCell>
                          <TableCell className="text-right text-sm">{ticket.cost ? `€ ${ticket.cost.toLocaleString("de-DE")}` : "–"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(ticket); }}>Details</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
          </TabsContent>

          <TabsContent value="wartungsplan">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-foreground">Wartungsplan</h3>
                  <p className="text-sm text-muted-foreground">Wiederkehrende Wartungsaufgaben — bei Fälligkeit wird automatisch ein Ticket erstellt</p>
                </div>
                <Button size="sm" onClick={() => { setNewSchedule(EMPTY_SCHEDULE); setScheduleOpen(true); }} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Neuer Wartungsplan
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titel</TableHead>
                        <TableHead>Immobilie</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead>Intervall</TableHead>
                        <TableHead>Letzte Durchf.</TableHead>
                        <TableHead>Nächste Fälligkeit</TableHead>
                        <TableHead>Zugewiesen</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            Noch keine Wartungspläne vorhanden.
                          </TableCell>
                        </TableRow>
                      ) : (
                        schedules.map((s) => {
                          const now = new Date();
                          const due = new Date(s.nextDue);
                          const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          const dueBadgeClass = daysUntil < 0
                            ? "text-destructive font-medium"
                            : daysUntil <= 30
                            ? "text-warning font-medium"
                            : "text-foreground";
                          return (
                            <TableRow key={s.id}>
                              <TableCell>
                                <div className="font-medium text-sm">{s.title}</div>
                                {s.description && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{s.description}</div>}
                              </TableCell>
                              <TableCell className="text-sm">{s.property?.name ?? "—"}</TableCell>
                              <TableCell className="text-sm">{CATEGORY_LABELS[s.category] ?? s.category}</TableCell>
                              <TableCell className="text-sm">{INTERVAL_LABELS[s.interval] ?? s.interval}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {s.lastDone ? formatDate(s.lastDone) : "—"}
                              </TableCell>
                              <TableCell className={`text-sm ${dueBadgeClass}`}>
                                {formatDate(s.nextDue)}
                                {daysUntil < 0 && <span className="text-xs ml-1">(überfällig)</span>}
                                {daysUntil >= 0 && daysUntil <= 30 && <span className="text-xs ml-1">({daysUntil}d)</span>}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{s.assignedTo ?? "—"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {user?.role !== "READONLY" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => openEditSchedule(s)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!detailTicket} onOpenChange={(open) => !open && setDetailTicket(null)}>
        <DialogContent className="max-w-2xl">
          {detailTicket && (
            <>
                <DialogHeader>
                  <DialogTitle>Ticket bearbeiten</DialogTitle>
                  <DialogDescription>
                    {detailTicket.property?.name ?? ""} – {detailTicket.unitLabel} &nbsp;|&nbsp;
                    <User className="h-3 w-3 inline mx-1" />{detailTicket.reportedBy} &nbsp;|&nbsp;
                    <Calendar className="h-3 w-3 inline mx-1" />{formatDate(detailTicket.createdAt)}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-1">
                  {/* Titel + Beschreibung */}
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Titel</Label>
                      <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Beschreibung</Label>
                      <Textarea rows={3} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>

                  <Separator />

                  {/* Kategorie + Priorität */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Kategorie</Label>
                      <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Sanitär", "Elektrik", "Heizung", "Gebäude", "Außenanlage", "Sonstiges"].map((c) => (
                            <SelectItem key={c} value={c}>{categoryIcons[c]} {c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Priorität</Label>
                      <Select value={editForm.priority} onValueChange={(v) => setEditForm((f) => ({ ...f, priority: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="niedrig">Niedrig</SelectItem>
                          <SelectItem value="mittel">Mittel</SelectItem>
                          <SelectItem value="hoch">Hoch</SelectItem>
                          <SelectItem value="dringend">Dringend</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Status + Zugewiesen */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offen">Offen</SelectItem>
                          <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                          <SelectItem value="wartend">Wartend</SelectItem>
                          <SelectItem value="erledigt">Erledigt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Zugewiesen an</Label>
                      <Input className="h-9" placeholder="Handwerker / Firma" value={editForm.assignedTo} onChange={(e) => setEditForm((f) => ({ ...f, assignedTo: e.target.value }))} />
                    </div>
                  </div>

                  {/* Fälligkeitsdatum + Kosten */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Fälligkeitsdatum</Label>
                      <Input className="h-9" type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Kosten (EUR)</Label>
                      <Input className="h-9" type="number" step="0.01" placeholder="0.00" value={editForm.cost} onChange={(e) => setEditForm((f) => ({ ...f, cost: e.target.value }))} />
                    </div>
                  </div>

                  {/* Notizen */}
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Notizen</Label>
                    <Textarea rows={3} placeholder="Interne Notizen..." value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteTicket}
                    disabled={deleteTicket.isPending}
                    className="sm:mr-auto"
                  >
                    {deleteTicket.isPending ? "Löschen..." : "Löschen"}
                  </Button>
                  <Button variant="outline" onClick={() => setDetailTicket(null)}>Abbrechen</Button>
                  <Button onClick={handleSaveTicket} disabled={updateTicket.isPending}>
                    {updateTicket.isPending ? "Speichern..." : "Speichern"}
                  </Button>
                </DialogFooter>
              </>
          )}
        </DialogContent>
      </Dialog>

      {/* Wartungsplan erstellen Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuer Wartungsplan</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Titel *</Label>
              <Input
                value={newSchedule.title}
                onChange={(e) => setNewSchedule((s) => ({ ...s, title: e.target.value }))}
                placeholder="z.B. Heizungswartung"
              />
            </div>
            <div className="grid gap-2">
              <Label>Beschreibung</Label>
              <Input
                value={newSchedule.description}
                onChange={(e) => setNewSchedule((s) => ({ ...s, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Kategorie *</Label>
                <Select value={newSchedule.category} onValueChange={(v) => setNewSchedule((s) => ({ ...s, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Intervall *</Label>
                <Select value={newSchedule.interval} onValueChange={(v) => setNewSchedule((s) => ({ ...s, interval: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERVAL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Immobilie *</Label>
                <Select value={newSchedule.propertyId} onValueChange={(v) => setNewSchedule((s) => ({ ...s, propertyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Nächste Fälligkeit *</Label>
                <Input
                  type="date"
                  value={newSchedule.nextDue}
                  onChange={(e) => setNewSchedule((s) => ({ ...s, nextDue: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Zugewiesen an</Label>
              <Input
                value={newSchedule.assignedTo}
                onChange={(e) => setNewSchedule((s) => ({ ...s, assignedTo: e.target.value }))}
                placeholder="Handwerker / Firma"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateSchedule} disabled={createSchedule.isPending} className="gap-1.5">
              {createSchedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wartungsplan bearbeiten Dialog */}
      <Dialog open={!!editSchedule} onOpenChange={(open) => !open && setEditSchedule(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Wartungsplan bearbeiten</DialogTitle>
            <DialogDescription>
              {editSchedule?.property?.name ?? ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Titel *</Label>
              <Input
                value={editScheduleForm.title}
                onChange={(e) => setEditScheduleForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="z.B. Heizungswartung"
              />
            </div>
            <div className="grid gap-2">
              <Label>Beschreibung</Label>
              <Input
                value={editScheduleForm.description}
                onChange={(e) => setEditScheduleForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Kategorie</Label>
                <Select
                  value={editScheduleForm.category}
                  onValueChange={(v) => setEditScheduleForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Intervall</Label>
                <Select
                  value={editScheduleForm.interval}
                  onValueChange={(v) => setEditScheduleForm((f) => ({ ...f, interval: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERVAL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nächste Fälligkeit</Label>
                <Input
                  type="date"
                  value={editScheduleForm.nextDue}
                  onChange={(e) => setEditScheduleForm((f) => ({ ...f, nextDue: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Zugewiesen an</Label>
                <Input
                  value={editScheduleForm.assignedTo}
                  onChange={(e) => setEditScheduleForm((f) => ({ ...f, assignedTo: e.target.value }))}
                  placeholder="Handwerker / Firma"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={async () => {
                if (!editSchedule) return;
                try {
                  await deleteSchedule.mutateAsync(editSchedule.id);
                  toast({ title: "Wartungsplan gelöscht" });
                  setEditSchedule(null);
                } catch {
                  toast({ title: "Fehler", description: "Wartungsplan konnte nicht gelöscht werden.", variant: "destructive" });
                }
              }}
              disabled={deleteSchedule.isPending}
              className="sm:mr-auto"
            >
              {deleteSchedule.isPending ? "Löschen..." : "Löschen"}
            </Button>
            <Button variant="outline" onClick={() => setEditSchedule(null)}>Abbrechen</Button>
            <Button onClick={handleSaveSchedule} disabled={updateSchedule.isPending} className="gap-1.5">
              {updateSchedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Maintenance;
