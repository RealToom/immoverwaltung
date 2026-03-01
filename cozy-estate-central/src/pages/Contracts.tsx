import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  Search,
  Plus,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  Bell,
  Filter,
  Eye,
  Loader2,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useContracts, useCreateContract } from "@/hooks/api/useContracts";
import { useDunning, useSendDunning, useResolveDunning } from "@/hooks/api/useDunning";
import { useProperties } from "@/hooks/api/useProperties";
import {
  mapContractType,
  mapContractStatus,
  mapReminderType,
  formatDate,
  toBackendContractType,
  toBackendContractStatus,
} from "@/lib/mappings";

const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary"; icon: typeof CheckCircle2 }> = {
  aktiv: { label: "Aktiv", variant: "default", icon: CheckCircle2 },
  gekuendigt: { label: "Gekündigt", variant: "destructive", icon: AlertTriangle },
  auslaufend: { label: "Auslaufend", variant: "secondary", icon: Clock },
  entwurf: { label: "Entwurf", variant: "outline", icon: FileEdit },
};

const reminderConfig: Record<string, { color: string; bg: string }> = {
  "Kündigungsfrist": { color: "text-destructive", bg: "bg-destructive/10" },
  "Vertragsverlängerung": { color: "text-primary", bg: "bg-primary/10" },
  "Mietanpassung": { color: "text-accent", bg: "bg-accent/10" },
  "Kautionsrückzahlung": { color: "text-muted-foreground", bg: "bg-muted" },
};

const Contracts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const sendDunning = useSendDunning();
  const resolveDunning = useResolveDunning();

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [typeFilter, setTypeFilter] = useState<string>("alle");
  const [propertyFilter, setPropertyFilter] = useState<string>("alle");
  const [selectedContract, setSelectedContract] = useState<Record<string, unknown> | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (searchParams.get("action") === "add" && user?.role !== "READONLY") {
      setShowAddDialog(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, user]);

  const backendStatus = statusFilter !== "alle" ? toBackendContractStatus(statusFilter) : undefined;
  const backendType = typeFilter !== "alle" ? toBackendContractType(typeFilter) : undefined;
  const propertyId = propertyFilter !== "alle" ? Number(propertyFilter) : undefined;

  const { data: contractsResponse, isLoading } = useContracts(
    search || undefined,
    backendStatus,
    backendType,
    propertyId,
  );
  const { data: propertiesResponse } = useProperties();
  const createContract = useCreateContract();

  const contracts = contractsResponse?.data ?? [];
  const properties = propertiesResponse?.data ?? [];

  const [newContract, setNewContract] = useState({
    tenantId: "",
    propertyId: "",
    unitId: "",
    type: "Wohnraum",
    startDate: "",
    endDate: "",
    noticePeriod: "3",
    monthlyRent: "",
    deposit: "",
    notes: "",
  });

  const upcomingReminders = useMemo(() => {
    return contracts
      .filter((c) => c.nextReminder && c.reminderType)
      .sort((a, b) => new Date(a.nextReminder!).getTime() - new Date(b.nextReminder!).getTime())
      .slice(0, 6);
  }, [contracts]);

  const totalActive = contracts.filter((c) => mapContractStatus(c.status) === "aktiv").length;
  const totalExpiring = contracts.filter((c) => mapContractStatus(c.status) === "auslaufend").length;
  const totalCancelled = contracts.filter((c) => mapContractStatus(c.status) === "gekuendigt").length;
  const totalMonthlyRent = contracts
    .filter((c) => {
      const s = mapContractStatus(c.status);
      return s === "aktiv" || s === "auslaufend";
    })
    .reduce((s, c) => s + c.monthlyRent, 0);

  const handleAddContract = async () => {
    if (!newContract.tenantId || !newContract.propertyId || !newContract.unitId || !newContract.startDate || !newContract.monthlyRent) {
      toast({ title: "Fehler", description: "Bitte füllen Sie alle Pflichtfelder aus.", variant: "destructive" });
      return;
    }
    try {
      await createContract.mutateAsync({
        tenantId: Number(newContract.tenantId),
        propertyId: Number(newContract.propertyId),
        unitId: Number(newContract.unitId),
        type: toBackendContractType(newContract.type),
        startDate: new Date(newContract.startDate).toISOString(),
        endDate: newContract.endDate ? new Date(newContract.endDate).toISOString() : null,
        noticePeriod: parseInt(newContract.noticePeriod),
        monthlyRent: parseFloat(newContract.monthlyRent),
        deposit: parseFloat(newContract.deposit) || 0,
        status: "ENTWURF",
        notes: newContract.notes || null,
      });
      setShowAddDialog(false);
      setNewContract({ tenantId: "", propertyId: "", unitId: "", type: "Wohnraum", startDate: "", endDate: "", noticePeriod: "3", monthlyRent: "", deposit: "", notes: "" });
      toast({ title: "Vertrag erstellt", description: "Vertrag wurde als Entwurf angelegt." });
    } catch {
      toast({ title: "Fehler", description: "Vertrag konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Verträge</h1>
          <p className="text-xs text-muted-foreground">Vertragslaufzeiten, Kündigungsfristen & Erinnerungen</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          {user?.role !== "READONLY" && (
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Neuer Vertrag
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Neuen Vertrag anlegen</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Mieter-ID *</Label>
                  <Input value={newContract.tenantId} onChange={(e) => setNewContract((p) => ({ ...p, tenantId: e.target.value }))} placeholder="z.B. 1" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Immobilie *</Label>
                  <Select value={newContract.propertyId} onValueChange={(v) => setNewContract((p) => ({ ...p, propertyId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Unit-ID</Label>
                  <Input value={newContract.unitId} onChange={(e) => setNewContract((p) => ({ ...p, unitId: e.target.value }))} placeholder="z.B. 1" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Vertragsart</Label>
                  <Select value={newContract.type} onValueChange={(v) => setNewContract((p) => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wohnraum">Wohnraum</SelectItem>
                      <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                      <SelectItem value="Staffel">Staffelmiete</SelectItem>
                      <SelectItem value="Index">Indexmiete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Kündigungsfrist</Label>
                  <Select value={newContract.noticePeriod} onValueChange={(v) => setNewContract((p) => ({ ...p, noticePeriod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Monat</SelectItem>
                      <SelectItem value="3">3 Monate</SelectItem>
                      <SelectItem value="6">6 Monate</SelectItem>
                      <SelectItem value="12">12 Monate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vertragsbeginn *</Label>
                  <Input type="date" value={newContract.startDate} onChange={(e) => setNewContract((p) => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vertragsende</Label>
                  <Input type="date" value={newContract.endDate} onChange={(e) => setNewContract((p) => ({ ...p, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Monatliche Miete (€) *</Label>
                  <Input type="number" value={newContract.monthlyRent} onChange={(e) => setNewContract((p) => ({ ...p, monthlyRent: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Kaution (€)</Label>
                  <Input type="number" value={newContract.deposit} onChange={(e) => setNewContract((p) => ({ ...p, deposit: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notizen</Label>
                <Textarea value={newContract.notes} onChange={(e) => setNewContract((p) => ({ ...p, notes: e.target.value }))} placeholder="Optionale Anmerkungen..." rows={2} />
              </div>
              <Button onClick={handleAddContract} className="w-full mt-1" disabled={createContract.isPending}>
                {createContract.isPending ? "Erstellen..." : "Vertrag erstellen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Aktive Verträge" value={String(totalActive)} change={`${totalExpiring} auslaufend`} changeType="neutral" icon={CheckCircle2} iconBg="bg-primary/10" iconColor="text-primary" />
          <KpiCard title="Auslaufend" value={String(totalExpiring)} change="In den nächsten 6 Monaten" changeType="negative" icon={Clock} iconBg="bg-accent/10" iconColor="text-accent" />
          <KpiCard title="Gekündigt" value={String(totalCancelled)} change="Offene Abwicklung" changeType="negative" icon={AlertTriangle} iconBg="bg-destructive/10" iconColor="text-destructive" />
          <KpiCard title="Vertragsvolumen" value={`€ ${totalMonthlyRent.toLocaleString("de-DE")}/M`} change={`${contracts.length} Verträge gesamt`} changeType="positive" icon={FileText} iconBg="bg-primary/10" iconColor="text-primary" />
        </div>

        {/* Reminders */}
        {upcomingReminders.length > 0 && (
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-accent" />
                <CardTitle className="text-base font-heading font-semibold">Anstehende Erinnerungen</CardTitle>
              </div>
              <CardDescription>Automatische Fristen und Termine</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingReminders.map((c) => {
                  const reminderLabel = mapReminderType(c.reminderType) ?? "";
                  const rc = reminderConfig[reminderLabel] || { color: "text-muted-foreground", bg: "bg-muted" };
                  return (
                    <div key={c.id} className={`flex items-start gap-3 rounded-lg border border-border/40 p-3 ${rc.bg}`}>
                      <CalendarClock className={`h-5 w-5 mt-0.5 shrink-0 ${rc.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{c.tenant.name}</p>
                        <p className={`text-xs font-medium ${rc.color}`}>{reminderLabel}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(c.nextReminder)} · {c.property.name}, {c.unit.number}</p>
                        {c.notes && <p className="text-xs text-muted-foreground/80 mt-1 italic truncate">{c.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mieter, Immobilie oder Einheit suchen..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value="aktiv">Aktiv</SelectItem>
              <SelectItem value="auslaufend">Auslaufend</SelectItem>
              <SelectItem value="gekuendigt">Gekündigt</SelectItem>
              <SelectItem value="entwurf">Entwurf</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Typen</SelectItem>
              <SelectItem value="Wohnraum">Wohnraum</SelectItem>
              <SelectItem value="Gewerbe">Gewerbe</SelectItem>
              <SelectItem value="Staffel">Staffelmiete</SelectItem>
              <SelectItem value="Index">Indexmiete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Immobilien</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contract table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Mieter</TableHead>
                    <TableHead>Immobilie / Einheit</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Laufzeit</TableHead>
                    <TableHead>Kündigungsfrist</TableHead>
                    <TableHead>Miete</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c) => {
                    const frontendStatus = mapContractStatus(c.status);
                    const sc = statusConfig[frontendStatus] ?? statusConfig.entwurf;
                    const StatusIcon = sc.icon;
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedContract(c as unknown as Record<string, unknown>)}>
                        <TableCell className="pl-6 font-medium text-foreground">{c.tenant.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.property.name}, {c.unit.number}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{mapContractType(c.type)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(c.startDate)} – {c.endDate ? formatDate(c.endDate) : "unbefristet"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.noticePeriod} Monate</TableCell>
                        <TableCell className="font-medium text-foreground">€ {c.monthlyRent.toLocaleString("de-DE")}</TableCell>
                        <TableCell>
                          <Badge variant={sc.variant} className="gap-1 text-xs">
                            <StatusIcon className="h-3 w-3" />
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={(e) => { e.stopPropagation(); setSelectedContract(c as unknown as Record<string, unknown>); }}>
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {contracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Keine Verträge gefunden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Contract Detail Dialog */}
        <Dialog open={!!selectedContract} onOpenChange={(open) => !open && setSelectedContract(null)}>
          <DialogContent className="max-w-lg">
            {selectedContract && (() => {
              const c = selectedContract as unknown as typeof contracts[0];
              const frontendStatus = mapContractStatus(c.status);
              const sc = statusConfig[frontendStatus] ?? statusConfig.entwurf;
              const Icon = sc.icon;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-heading">Vertragsdetails</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">{c.tenant.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={sc.variant} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {sc.label}
                        </Badge>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs gap-1"
                          disabled={sendDunning.isPending}
                          onClick={async () => {
                            try {
                              await sendDunning.mutateAsync(c.id);
                              toast({ title: "Mahnung versendet" });
                            } catch {
                              toast({ title: "Fehler", description: "Mahnung konnte nicht versendet werden.", variant: "destructive" });
                            }
                          }}
                        >
                          Mahnung senden
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Immobilie</p>
                        <p className="font-medium text-foreground">{c.property.name}, {c.unit.number}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vertragsart</p>
                        <p className="font-medium text-foreground">{mapContractType(c.type)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vertragsbeginn</p>
                        <p className="font-medium text-foreground">{formatDate(c.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vertragsende</p>
                        <p className="font-medium text-foreground">{c.endDate ? formatDate(c.endDate) : "Unbefristet"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Kündigungsfrist</p>
                        <p className="font-medium text-foreground">{c.noticePeriod} Monate</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monatliche Miete</p>
                        <p className="font-medium text-foreground">€ {c.monthlyRent.toLocaleString("de-DE")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Kaution</p>
                        <p className="font-medium text-foreground">€ {c.deposit.toLocaleString("de-DE")}</p>
                      </div>
                      {c.nextReminder && (
                        <div>
                          <p className="text-muted-foreground">Nächste Erinnerung</p>
                          <p className="font-medium text-foreground">{formatDate(c.nextReminder)}</p>
                          <p className="text-xs text-accent">{mapReminderType(c.reminderType)}</p>
                        </div>
                      )}
                    </div>
                    {c.notes && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Notizen</p>
                        <p className="text-sm text-foreground">{c.notes}</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Contracts;
