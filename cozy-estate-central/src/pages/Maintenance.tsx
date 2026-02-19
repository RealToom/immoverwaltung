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
} from "lucide-react";
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
import { useMaintenanceTickets, useCreateMaintenanceTicket, useUpdateMaintenanceTicket, useDeleteMaintenanceTicket, type MaintenanceTicketItem } from "@/hooks/api/useMaintenanceTickets";
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
  wartend: { label: "Wartend", class: "bg-warning/10 text-warning-foreground border-warning/20", icon: Clock },
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
    if (searchParams.get("action") === "add") {
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> Neues Ticket</Button>
          </DialogTrigger>
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
    </div>
  );
};

export default Maintenance;
