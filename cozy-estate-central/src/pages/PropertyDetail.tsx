import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, MapPin, Building2, Users, CreditCard, Home, Mail, Phone,
  FileText, Download, Eye, Trash2, Upload, Plus, UserPlus, Loader2,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Pencil, Car,
  BarChart3, ClipboardList, ScanLine,
} from "lucide-react";
import { useProperty, useUpdateProperty, useCreateUnit, useUpdateUnit } from "@/hooks/api/useProperties";
import { useTenants } from "@/hooks/api/useTenants";
import { useUploadDocument, useDeleteDocument, useDownloadDocument, usePreviewDocument } from "@/hooks/api/useDocuments";
import { useTransactions, useUpdateTransaction, useUtilityStatement, useCreateTransaction } from "@/hooks/api/useFinance";
import { useCreateContract } from "@/hooks/api/useContracts";
import { useMeters, useCreateMeter, useAddMeterReading, useDeleteMeter, scanMeterReadingFile } from "@/hooks/api/useMeters";
import { type ScanPhase } from "@/lib/api";
import { useHandovers, useCreateHandover, useDeleteHandover } from "@/hooks/api/useHandover";
import { mapPropertyStatus, mapUnitStatus, mapUnitType, formatDate, formatCurrency } from "@/lib/mappings";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Gauge } from "lucide-react";

const PREVIEWABLE_TYPES = new Set(["PDF", "JPG", "JPEG", "PNG"]);

const PropertyDetail = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const propertyId = id ? Number(id) : 0;
  const { data: response, isLoading, error } = useProperty(propertyId || undefined);
  const property = response?.data;

  // Edit property state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", street: "", zip: "", city: "", status: "", purchasePrice: "", equity: "" });
  const updatePropertyMutation = useUpdateProperty(propertyId);

  // Meter state
  const { data: metersRes } = useMeters(propertyId);
  const meters = metersRes ?? [];
  const [addMeterOpen, setAddMeterOpen] = useState(false);
  const [newMeter, setNewMeter] = useState({ label: "", type: "STROM", unitId: "" });
  const [addReadingMeterId, setAddReadingMeterId] = useState<number | null>(null);
  const [newReading, setNewReading] = useState({ value: "", readAt: new Date().toISOString().slice(0, 10), note: "" });
  const createMeterMutation = useCreateMeter(propertyId);
  const addReadingMutation = useAddMeterReading(addReadingMeterId ?? 0, propertyId);
  const deleteMeterMutation = useDeleteMeter(propertyId);
  const [meterScanPhase, setMeterScanPhase] = useState<ScanPhase>("idle");
  const meterScanInputRef = useRef<HTMLInputElement>(null);

  async function handleMeterScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || addReadingMeterId === null) return;
    try {
      const result = await scanMeterReadingFile(addReadingMeterId, file, setMeterScanPhase);
      if (result.value !== null) {
        setNewReading((r) => ({ ...r, value: String(result.value) }));
        toast({ title: "Zählerstand erkannt", description: `${result.value}${result.unit ? ` ${result.unit}` : ""}` });
      } else {
        toast({ variant: "destructive", title: "Kein Zählerstand erkannt", description: "Bitte manuell eingeben." });
      }
    } catch {
      toast({ variant: "destructive", title: "Scan fehlgeschlagen", description: "Bitte erneut versuchen." });
    } finally {
      setMeterScanPhase("idle");
    }
  }

  const METER_TYPE_LABELS: Record<string, string> = {
    STROM: "Strom (kWh)", WASSER: "Wasser (m³)", GAS: "Gas (m³)",
    WAERME: "Wärme (kWh)", SONSTIGES: "Sonstiges",
  };

  // Übergabeprotokoll state
  const { data: handoversRes } = useHandovers();
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverStep, setHandoverStep] = useState(1);
  const EMPTY_HANDOVER = {
    type: "EINZUG",
    date: new Date().toISOString().slice(0, 10),
    tenantName: "",
    notes: "",
    unitId: "",
    rooms: [] as { name: string; condition: string; notes: string }[],
    meterData: [] as { label: string; value: string; type: string }[],
  };
  const [newHandover, setNewHandover] = useState(EMPTY_HANDOVER);
  const [newRoom, setNewRoom] = useState({ name: "", condition: "GUT", notes: "" });
  const [newMeterEntry, setNewMeterEntry] = useState({ label: "", value: "", type: "STROM" });
  const createHandoverMutation = useCreateHandover();
  const deleteHandoverMutation = useDeleteHandover();

  // Nebenkosten state
  const [nebenkostenYear, setNebenkostenYear] = useState(new Date().getFullYear());
  const [showStatement, setShowStatement] = useState(false);
  const updateTransactionMutation = useUpdateTransaction();
  const { data: utilityRes, refetch: refetchStatement, isFetching: statementLoading } = useUtilityStatement(propertyId, nebenkostenYear, showStatement);

  // Mutations
  const uploadMutation = useUploadDocument(propertyId);
  const deleteMutation = useDeleteDocument(propertyId);
  const downloadMutation = useDownloadDocument();
  const previewMutation = usePreviewDocument();
  const createUnitMutation = useCreateUnit(propertyId);
  const updateUnitMutation = useUpdateUnit();

  // All tenants for assignment dropdown
  const { data: allTenantsRes } = useTenants();
  const allTenants = allTenantsRes?.data ?? [];

  // Property-specific transactions
  const { data: txRes } = useTransactions(1, 100, undefined, undefined);
  const propertyTransactions = (txRes?.data ?? []).filter(
    (tx) => tx.property?.id === propertyId
  );
  const propertyExpenses = propertyTransactions.filter((tx) => tx.type === "AUSGABE");

  // Document state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ id: number; name: string; fileType: string } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Unit state
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [newUnit, setNewUnit] = useState({ number: "", floor: "0", area: "", rent: "", type: "WOHNUNG" });

  // Tenant assignment state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUnitId, setAssignUnitId] = useState<number | null>(null);
  const [assignTenantId, setAssignTenantId] = useState<string>("");

  // Neue Transaktion state
  const EMPTY_TX = { date: new Date().toISOString().slice(0, 10), description: "", type: "AUSGABE", amount: "", category: "SONSTIGES" };
  const [newTxOpen, setNewTxOpen] = useState(false);
  const [newTx, setNewTx] = useState(EMPTY_TX);
  const createTransactionMutation = useCreateTransaction();

  // Auto-Vertrag state
  const EMPTY_CONTRACT = { type: "WOHNRAUM", startDate: new Date().toISOString().slice(0, 10), endDate: "", monthlyRent: "", deposit: "", noticePeriod: "3", notes: "" };
  const [autoContractOpen, setAutoContractOpen] = useState(false);
  const [autoContractTenantId, setAutoContractTenantId] = useState<number | null>(null);
  const [autoContractUnitId, setAutoContractUnitId] = useState<number | null>(null);
  const [contractForm, setContractForm] = useState(EMPTY_CONTRACT);
  const createContractMutation = useCreateContract();

  // Handlers
  const handleUpload = () => {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append("file", uploadFile);
    if (uploadName.trim()) formData.append("name", uploadName.trim());

    uploadMutation.mutate(formData, {
      onSuccess: () => {
        toast({ title: "Hochgeladen", description: "Dokument wurde erfolgreich hochgeladen." });
        setUploadOpen(false);
        setUploadName("");
        setUploadFile(null);
      },
      onError: (err) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
    });
  };

  const handleDownload = (docId: number, docName: string) => {
    downloadMutation.mutate({ docId, docName }, {
      onError: () => toast({ title: "Fehler", description: "Download fehlgeschlagen.", variant: "destructive" }),
    });
  };

  const handleDelete = (docId: number) => {
    deleteMutation.mutate(docId, {
      onSuccess: () => { toast({ title: "Geloescht", description: "Dokument wurde entfernt." }); setDeleteConfirmId(null); },
      onError: (err) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
    });
  };

  const handlePreview = (doc: { id: number; name: string; fileType: string }) => {
    if (PREVIEWABLE_TYPES.has(doc.fileType.toUpperCase())) {
      setPreviewDoc(doc);
      setPreviewBlobUrl(null);
      setPreviewOpen(true);
      previewMutation.mutate(doc.id, {
        onSuccess: ({ url }) => setPreviewBlobUrl(url),
        onError: () => toast({ title: "Fehler", description: "Vorschau konnte nicht geladen werden.", variant: "destructive" }),
      });
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
    setPreviewDoc(null);
  };

  const handleAddUnit = async () => {
    if (!newUnit.number.trim() || !newUnit.area || !newUnit.rent) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfuellen.", variant: "destructive" });
      return;
    }
    try {
      await createUnitMutation.mutateAsync({
        number: newUnit.number.trim(),
        floor: parseInt(newUnit.floor, 10),
        area: parseFloat(newUnit.area),
        rent: parseFloat(newUnit.rent),
        type: newUnit.type,
      });
      toast({ title: "Erstellt", description: `Einheit ${newUnit.number} wurde angelegt.` });
      setNewUnit({ number: "", floor: "0", area: "", rent: "", type: "WOHNUNG" });
      setAddUnitOpen(false);
    } catch {
      toast({ title: "Fehler", description: "Einheit konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const handleAssignTenant = async () => {
    if (!assignUnitId) return;
    const tenantId = assignTenantId === "none" ? null : Number(assignTenantId);
    try {
      await updateUnitMutation.mutateAsync({
        unitId: assignUnitId,
        data: {
          tenantId,
          status: tenantId ? "VERMIETET" : "FREI",
        },
      });
      toast({ title: "Aktualisiert", description: tenantId ? "Mieter wurde zugewiesen." : "Mieter wurde entfernt." });
      setAssignOpen(false);
      // Offer auto-contract creation when assigning a tenant
      if (tenantId) {
        const unit = property?.units?.find((u: { id: number; rent: number }) => u.id === assignUnitId);
        setAutoContractTenantId(tenantId);
        setAutoContractUnitId(assignUnitId);
        setContractForm({ ...EMPTY_CONTRACT, monthlyRent: unit?.rent ? String(unit.rent) : "" });
        setAutoContractOpen(true);
      }
      setAssignTenantId("");
      setAssignUnitId(null);
    } catch {
      toast({ title: "Fehler", description: "Zuweisung fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleCreateContract = async () => {
    if (!autoContractTenantId || !autoContractUnitId || !contractForm.monthlyRent) {
      toast({ title: "Fehler", description: "Monatsmiete ist ein Pflichtfeld.", variant: "destructive" });
      return;
    }
    try {
      await createContractMutation.mutateAsync({
        type: contractForm.type,
        startDate: new Date(contractForm.startDate + "T12:00:00Z").toISOString(),
        endDate: contractForm.endDate ? new Date(contractForm.endDate + "T12:00:00Z").toISOString() : null,
        monthlyRent: parseFloat(contractForm.monthlyRent),
        deposit: contractForm.deposit ? parseFloat(contractForm.deposit) : 0,
        noticePeriod: parseInt(contractForm.noticePeriod, 10),
        notes: contractForm.notes || null,
        tenantId: autoContractTenantId,
        propertyId,
        unitId: autoContractUnitId,
        status: "AKTIV",
      });
      toast({ title: "Vertrag erstellt", description: "Mietvertrag wurde automatisch angelegt." });
      setAutoContractOpen(false);
      setContractForm(EMPTY_CONTRACT);
    } catch {
      toast({ title: "Fehler", description: "Vertrag konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const openAssignDialog = (unitId: number, currentTenantId: number | null) => {
    setAssignUnitId(unitId);
    setAssignTenantId(currentTenantId ? String(currentTenantId) : "none");
    setAssignOpen(true);
  };

  const handleCreateHandover = async () => {
    if (!newHandover.unitId || !newHandover.tenantName.trim()) {
      toast({ title: "Fehler", description: "Bitte Einheit und Mietername angeben.", variant: "destructive" });
      return;
    }
    try {
      await createHandoverMutation.mutateAsync({
        type: newHandover.type,
        date: new Date(newHandover.date + "T12:00:00Z").toISOString(),
        tenantName: newHandover.tenantName.trim(),
        notes: newHandover.notes || undefined,
        unitId: Number(newHandover.unitId),
        rooms: newHandover.rooms,
        meterData: newHandover.meterData.map((m) => ({ ...m, value: Number(m.value) })),
      });
      toast({ title: "Gespeichert", description: "Übergabeprotokoll wurde erstellt." });
      setNewHandover(EMPTY_HANDOVER);
      setHandoverStep(1);
      setHandoverOpen(false);
    } catch {
      toast({ title: "Fehler", description: "Protokoll konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const openEditDialog = () => {
    if (property) {
      setEditForm({
        name: property.name,
        street: property.street,
        zip: property.zip,
        city: property.city,
        status: property.status,
        purchasePrice: property.purchasePrice != null ? String(property.purchasePrice) : "",
        equity: property.equity != null ? String(property.equity) : "",
      });
      setEditOpen(true);
    }
  };

  const handleEditProperty = async () => {
    if (!editForm.name.trim() || !editForm.street.trim() || !editForm.zip.trim() || !editForm.city.trim()) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfuellen.", variant: "destructive" });
      return;
    }
    try {
      await updatePropertyMutation.mutateAsync({
        name: editForm.name.trim(),
        street: editForm.street.trim(),
        zip: editForm.zip.trim(),
        city: editForm.city.trim(),
        status: editForm.status,
        purchasePrice: editForm.purchasePrice ? parseFloat(editForm.purchasePrice) : null,
        equity: editForm.equity ? parseFloat(editForm.equity) : null,
      });
      toast({ title: "Gespeichert", description: "Immobilie wurde aktualisiert." });
      setEditOpen(false);
    } catch {
      toast({ title: "Fehler", description: "Immobilie konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  // All tenants are available for assignment (one tenant can rent multiple units)
  const availableTenants = allTenants;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="h-6" />
          <span className="text-muted-foreground">Immobilie nicht gefunden</span>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-lg">Diese Immobilie existiert nicht.</p>
            <Button variant="outline" onClick={() => navigate("/properties")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurueck zu Immobilien
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const status = mapPropertyStatus(property.status);
  const units = property.units ?? [];
  const documents = property.documents ?? [];
  const tenants = units.filter((u) => u.tenant).map((u) => ({
    id: u.tenant!.id,
    name: u.tenant!.name,
    email: u.tenant!.email,
    phone: u.tenant!.phone,
    unit: u.number,
    rent: u.rent,
  }));
  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => mapUnitStatus(u.status) === "vermietet").length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const monthlyRevenue = units
    .filter((u) => mapUnitStatus(u.status) === "vermietet")
    .reduce((sum, u) => sum + u.rent, 0);

  // Finance for this property
  const propIncome = propertyTransactions.filter((t) => t.type === "EINNAHME").reduce((s, t) => s + t.amount, 0);
  const propExpenses = propertyTransactions.filter((t) => t.type === "AUSGABE").reduce((s, t) => s + Math.abs(t.amount), 0);

  const unitStatusColor = (bs: string) => {
    const s = mapUnitStatus(bs);
    switch (s) {
      case "vermietet": return "bg-success/15 text-success border-0";
      case "frei": return "bg-primary/10 text-primary border-0";
      case "wartung": return "bg-warning/15 text-warning border-0";
      default: return "";
    }
  };

  const unitStatusLabel = (bs: string) => {
    const s = mapUnitStatus(bs);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm" onClick={() => navigate("/properties")} className="text-muted-foreground hover:text-foreground gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Immobilien
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="font-heading text-lg font-semibold text-foreground">{property.name}</h1>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{property.address}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-1.5">
            <Pencil className="h-4 w-4" />
            Bearbeiten
          </Button>
          <Badge className={status === "aktiv" ? "bg-success/15 text-success border-0" : "bg-warning/15 text-warning border-0"}>
            {status === "aktiv" ? "Aktiv" : "Wartung"}
          </Badge>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Einheiten</p>
                <p className="text-xl font-heading font-bold">{totalUnits}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
                <Building2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Belegung</p>
                <p className="text-xl font-heading font-bold">{occupancyRate}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
                <Users className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mieter</p>
                <p className="text-xl font-heading font-bold">{tenants.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
                <CreditCard className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monatseinnahmen</p>
                <p className="text-xl font-heading font-bold">{formatCurrency(monthlyRevenue)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="units" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="units" className="gap-1.5">
              <Home className="h-4 w-4" />
              Einheiten ({units.length})
            </TabsTrigger>
            <TabsTrigger value="tenants" className="gap-1.5">
              <Users className="h-4 w-4" />
              Mieter ({tenants.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Dokumente ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="finances" className="gap-1.5">
              <CreditCard className="h-4 w-4" />
              Finanzen
            </TabsTrigger>
            <TabsTrigger value="nebenkosten" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Nebenkosten
            </TabsTrigger>
            <TabsTrigger value="zaehler" className="gap-1.5">
              <Gauge className="h-4 w-4" />
              Zähler
            </TabsTrigger>
            <TabsTrigger value="protokolle" className="gap-1.5">
              <ClipboardList className="h-4 w-4" />
              Protokolle
            </TabsTrigger>
          </TabsList>

          {/* Units Tab */}
          <TabsContent value="units">
            <Card className="border border-border/60 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                  <h3 className="text-sm font-semibold text-foreground">Einheiten</h3>
                  <Button size="sm" onClick={() => setAddUnitOpen(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Einheit hinzufuegen
                  </Button>
                </div>
                {units.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Home className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">Noch keine Einheiten vorhanden.</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setAddUnitOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Erste Einheit anlegen
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/60">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nr.</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typ</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Etage</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flaeche</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Miete</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mieter</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {units.map((unit) => (
                        <TableRow key={unit.id} className="hover:bg-muted/50 border-border/40">
                          <TableCell className="font-medium">{unit.number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              {(unit.type === "GARAGE" || unit.type === "STELLPLATZ") ? <Car className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
                              <span className="text-xs">{mapUnitType(unit.type)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{unit.floor}. OG</TableCell>
                          <TableCell className="text-muted-foreground">{unit.area} m2</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(unit.rent)}</TableCell>
                          <TableCell className="text-muted-foreground">{unit.tenant?.name || "–"}</TableCell>
                          <TableCell>
                            <Badge className={unitStatusColor(unit.status)}>{unitStatusLabel(unit.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => openAssignDialog(unit.id, unit.tenant?.id ?? null)}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              {unit.tenant ? "Aendern" : "Zuweisen"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tenants Tab */}
          <TabsContent value="tenants">
            {tenants.length === 0 ? (
              <Card className="border border-border/60 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">Noch keine Mieter zugewiesen.</p>
                  <p className="text-xs mt-1">Weisen Sie Mieter ueber den Einheiten-Tab zu.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenants.map((tenant) => (
                  <Card key={tenant.id} className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-heading font-semibold text-foreground">{tenant.name}</h3>
                          <p className="text-sm text-muted-foreground">Wohnung {tenant.unit}</p>
                        </div>
                        <span className="text-lg font-heading font-bold text-foreground">
                          {formatCurrency(tenant.rent)}
                          <span className="text-xs text-muted-foreground font-normal">/Monat</span>
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{tenant.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{tenant.phone || "–"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card className="border border-border/60 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                  <h3 className="text-sm font-semibold text-foreground">Dokumente</h3>
                  <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
                    <Upload className="h-4 w-4" />
                    Hochladen
                  </Button>
                </div>
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">Noch keine Dokumente vorhanden.</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setUploadOpen(true)}>
                      <Upload className="h-4 w-4" />
                      Erstes Dokument hochladen
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/60">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dokument</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typ</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datum</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Groesse</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-muted/50 border-border/40">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{doc.name}</span>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{doc.fileType}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                          <TableCell className="text-muted-foreground">{doc.fileSize}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {PREVIEWABLE_TYPES.has(doc.fileType.toUpperCase()) && (
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePreview(doc)} title="Vorschau">
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownload(doc.id, doc.name)} disabled={downloadMutation.isPending} title="Herunterladen">
                                <Download className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => setDeleteConfirmId(doc.id)} title="Loeschen">
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finances Tab */}
          <TabsContent value="finances">
            <div className="space-y-6">
              {/* Finance KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gebuchte Einnahmen</p>
                      <p className="text-xl font-heading font-bold text-success">{formatCurrency(propIncome)}</p>
                      {monthlyRevenue > 0 && <p className="text-xs text-muted-foreground">Sollmiete: {formatCurrency(monthlyRevenue)}/Mo.</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ausgaben</p>
                      <p className="text-xl font-heading font-bold text-destructive">{formatCurrency(propExpenses)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Netto</p>
                      <p className="text-xl font-heading font-bold">{formatCurrency(propIncome - propExpenses)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Property Transactions */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-heading font-semibold">Transaktionen</CardTitle>
                      <CardDescription>Alle Buchungen fuer diese Immobilie</CardDescription>
                    </div>
                    {user?.role !== "READONLY" && (
                      <Button size="sm" className="gap-1.5" onClick={() => { setNewTx(EMPTY_TX); setNewTxOpen(true); }}>
                        <Plus className="h-4 w-4" />Neue Transaktion
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {propertyTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-1">
                      <CreditCard className="h-10 w-10 mb-2 opacity-40" />
                      <p className="text-sm">Keine Transaktionen für diese Immobilie.</p>
                      <p className="text-xs text-center max-w-sm">Mieteinnahmen werden nicht automatisch gebucht. Erfassen Sie diese manuell über „Neue Transaktion" oder importieren Sie sie über die Bankanbindung.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6">Datum</TableHead>
                          <TableHead>Beschreibung</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead className="text-right pr-6">Betrag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {propertyTransactions.map((tx) => {
                          const isIncome = tx.type === "EINNAHME";
                          return (
                            <TableRow key={tx.id}>
                              <TableCell className="pl-6 text-muted-foreground">{formatDate(tx.date)}</TableCell>
                              <TableCell className="font-medium">{tx.description}</TableCell>
                              <TableCell>
                                <Badge variant={isIncome ? "default" : "destructive"} className="text-xs">
                                  {isIncome ? "Einnahme" : "Ausgabe"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className={`flex items-center justify-end gap-1 font-medium ${isIncome ? "text-success" : "text-destructive"}`}>
                                  {isIncome ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                  {formatCurrency(Math.abs(tx.amount))}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          {/* Nebenkosten Tab */}
          <TabsContent value="nebenkosten">
            <div className="space-y-6">
              {/* Header with year select and generate button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Select value={String(nebenkostenYear)} onValueChange={(v) => { setNebenkostenYear(Number(v)); setShowStatement(false); }}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">Abrechnungsjahr</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => { setShowStatement(true); setTimeout(() => refetchStatement(), 0); }}
                  disabled={statementLoading}
                  className="gap-1.5"
                >
                  {statementLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  Abrechnung generieren
                </Button>
              </div>

              {/* Expense transactions with allocatable toggle */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-heading font-semibold">Ausgaben markieren</CardTitle>
                  <CardDescription>Umlagefaehige Kosten werden auf Mieter nach Wohnflaeche verteilt</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {propertyExpenses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
                      <p className="text-sm">Keine Ausgaben fuer diese Immobilie.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/60">
                          <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datum</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beschreibung</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Betrag</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center pr-6">Umlagefaehig</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {propertyExpenses.map((tx) => (
                          <TableRow key={tx.id} className="hover:bg-muted/50 border-border/40">
                            <TableCell className="pl-6 text-muted-foreground">{formatDate(tx.date)}</TableCell>
                            <TableCell className="font-medium">{tx.description}</TableCell>
                            <TableCell className="text-right text-destructive font-medium">{formatCurrency(Math.abs(tx.amount))}</TableCell>
                            <TableCell className="text-center pr-6">
                              <Checkbox
                                checked={tx.allocatable ?? false}
                                onCheckedChange={(checked) => {
                                  updateTransactionMutation.mutate({ id: tx.id, data: { allocatable: !!checked } }, {
                                    onError: () => toast({ title: "Fehler beim Speichern", variant: "destructive" }),
                                  });
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Utility Statement Result */}
              {showStatement && utilityRes?.data && (
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-heading font-semibold">Nebenkostenabrechnung {nebenkostenYear}</CardTitle>
                        <CardDescription>
                          Gesamtkosten: {formatCurrency(utilityRes.data.totalCosts)} auf {utilityRes.data.totalArea.toFixed(1)} m² verteilt
                        </CardDescription>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={async () => {
                        const token = localStorage.getItem("accessToken");
                        const res = await fetch(
                          `/api/finance/utility-statement/pdf?propertyId=${propertyId}&year=${nebenkostenYear}`,
                          { headers: { Authorization: `Bearer ${token}` } },
                        );
                        if (!res.ok) return;
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Nebenkostenabrechnung_${nebenkostenYear}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}>
                        <Download className="h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {utilityRes.data.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <p className="text-sm">Keine vermieteten Einheiten oder keine umlagefaehigen Kosten.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-border/60">
                            <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mieter</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Einheit</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flaeche</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Anteil</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Betrag</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {utilityRes.data.items.map((item) => (
                            <TableRow key={item.unitId} className="hover:bg-muted/50 border-border/40">
                              <TableCell className="pl-6 font-medium">{item.tenantName}</TableCell>
                              <TableCell className="text-muted-foreground">{item.unitNumber}</TableCell>
                              <TableCell className="text-muted-foreground">{item.area.toFixed(1)} m²</TableCell>
                              <TableCell className="text-right text-muted-foreground">{item.areaPercent.toFixed(1)}%</TableCell>
                              <TableCell className="text-right font-semibold pr-6">{formatCurrency(item.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Zähler Tab */}
          <TabsContent value="zaehler">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-heading font-semibold">Zähler & Ablesungen</h3>
                <Button size="sm" onClick={() => setAddMeterOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Zähler hinzufügen
                </Button>
              </div>
              {meters.length === 0 ? (
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Noch keine Zähler erfasst.
                  </CardContent>
                </Card>
              ) : (
                meters.map((meter) => (
                  <Card key={meter.id} className="border border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{meter.label}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {METER_TYPE_LABELS[meter.type] ?? meter.type}
                            {meter.unit && ` · Einheit ${meter.unit.number}`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setAddReadingMeterId(meter.id)}>
                            <Plus className="h-3 w-3 mr-1" /> Ablesung
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteMeterMutation.mutate(meter.id, {
                            onError: () => toast({ title: "Zähler konnte nicht gelöscht werden", variant: "destructive" }),
                          })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {meter.readings.length > 0 && (
                      <CardContent className="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Datum</TableHead>
                              <TableHead className="text-right">Zählerstand</TableHead>
                              <TableHead className="text-right">Verbrauch</TableHead>
                              <TableHead>Notiz</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {meter.readings.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell>{formatDate(r.readAt)}</TableCell>
                                <TableCell className="text-right font-mono">{r.value.toLocaleString("de-DE")}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  {r.consumption != null ? `+${r.consumption.toLocaleString("de-DE")}` : "—"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{r.note ?? "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Protokolle Tab */}
          <TabsContent value="protokolle">
            {(() => {
              const unitIds = new Set(units.map((u: { id: number }) => u.id));
              const propertyHandovers = (handoversRes ?? []).filter((h) => unitIds.has(h.unitId));
              const CONDITION_LABELS: Record<string, string> = { GUT: "Gut", MAENGEL: "Mängel", DEFEKT: "Defekt" };
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading font-semibold text-foreground">Übergabeprotokolle</h3>
                      <p className="text-sm text-muted-foreground">Ein- und Auszugsprotokolle mit Raumzustand und Zählerständen</p>
                    </div>
                    <Button size="sm" onClick={() => { setHandoverStep(1); setNewHandover(EMPTY_HANDOVER); setHandoverOpen(true); }} className="gap-1.5">
                      <Plus className="h-4 w-4" />
                      Neues Protokoll
                    </Button>
                  </div>

                  {propertyHandovers.length === 0 ? (
                    <Card className="border border-border/60 shadow-sm">
                      <CardContent className="p-8 text-center text-muted-foreground">
                        Noch keine Protokolle vorhanden.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {propertyHandovers.map((h) => (
                        <Card key={h.id} className="border border-border/60 shadow-sm">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge className={h.type === "EINZUG" ? "bg-success/15 text-success border-0" : "bg-warning/15 text-warning border-0"}>
                                  {h.type === "EINZUG" ? "Einzug" : "Auszug"}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">{h.tenantName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(h.date)} · Einheit {h.unit?.number ?? h.unitId}
                                  </p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                onClick={() => deleteHandoverMutation.mutate(h.id, {
                                onError: () => toast({ title: "Protokoll konnte nicht gelöscht werden", variant: "destructive" }),
                              })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          {(h.rooms.length > 0 || h.meterData.length > 0 || h.notes) && (
                            <CardContent className="pt-0 space-y-3">
                              {h.notes && <p className="text-sm text-muted-foreground italic">{h.notes}</p>}
                              {h.rooms.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Raumzustand</p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Raum</TableHead>
                                        <TableHead>Zustand</TableHead>
                                        <TableHead>Notiz</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {h.rooms.map((r, i) => (
                                        <TableRow key={i}>
                                          <TableCell>{r.name}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className={
                                              r.condition === "GUT" ? "border-success text-success" :
                                              r.condition === "MAENGEL" ? "border-warning text-warning" :
                                              "border-destructive text-destructive"
                                            }>
                                              {CONDITION_LABELS[r.condition] ?? r.condition}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-muted-foreground">{r.notes ?? "—"}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                              {h.meterData.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Zählerstände</p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Zähler</TableHead>
                                        <TableHead>Typ</TableHead>
                                        <TableHead className="text-right">Stand</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {h.meterData.map((m, i) => (
                                        <TableRow key={i}>
                                          <TableCell>{m.label}</TableCell>
                                          <TableCell className="text-muted-foreground">{m.type}</TableCell>
                                          <TableCell className="text-right font-mono">{m.value.toLocaleString("de-DE")}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Meter Dialog */}
      <Dialog open={addMeterOpen} onOpenChange={setAddMeterOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zähler hinzufügen</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Bezeichnung *</Label>
              <Input value={newMeter.label} onChange={(e) => setNewMeter((m) => ({ ...m, label: e.target.value }))} placeholder="z.B. Stromzähler EG" />
            </div>
            <div className="grid gap-2">
              <Label>Typ *</Label>
              <Select value={newMeter.type} onValueChange={(v) => setNewMeter((m) => ({ ...m, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METER_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Einheit (optional)</Label>
              <Select value={newMeter.unitId} onValueChange={(v) => setNewMeter((m) => ({ ...m, unitId: v }))}>
                <SelectTrigger><SelectValue placeholder="Hauptzähler (kein Einheitsbezug)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Hauptzähler</SelectItem>
                  {property?.units?.map((u: { id: number; number: string }) => (
                    <SelectItem key={u.id} value={String(u.id)}>Einheit {u.number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMeterOpen(false)}>Abbrechen</Button>
            <Button disabled={!newMeter.label} onClick={() => {
              createMeterMutation.mutate({
                label: newMeter.label, type: newMeter.type, propertyId,
                ...(newMeter.unitId && newMeter.unitId !== "none" ? { unitId: Number(newMeter.unitId) } : {}),
              });
              setAddMeterOpen(false);
              setNewMeter({ label: "", type: "STROM", unitId: "" });
            }}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Reading Dialog */}
      <Dialog open={addReadingMeterId !== null} onOpenChange={(o) => { if (!o) { setAddReadingMeterId(null); setMeterScanPhase("idle"); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ablesung erfassen</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Zählerstand *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={meterScanPhase !== "idle"}
                  onClick={() => meterScanInputRef.current?.click()}
                  className="gap-1.5 text-xs"
                >
                  {meterScanPhase !== "idle"
                    ? <><Loader2 className="h-3 w-3 animate-spin" />{meterScanPhase === "uploading" ? "Hochladen…" : "KI liest…"}</>
                    : <><ScanLine className="h-3 w-3" />KI-Scan</>}
                </Button>
                <input ref={meterScanInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleMeterScan} />
              </div>
              <Input type="number" value={newReading.value} onChange={(e) => setNewReading((r) => ({ ...r, value: e.target.value }))} placeholder="z.B. 12345.6" />
            </div>
            <div className="grid gap-2">
              <Label>Datum *</Label>
              <Input type="date" value={newReading.readAt} onChange={(e) => setNewReading((r) => ({ ...r, readAt: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Notiz</Label>
              <Input value={newReading.note} onChange={(e) => setNewReading((r) => ({ ...r, note: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddReadingMeterId(null)}>Abbrechen</Button>
            <Button disabled={!newReading.value} onClick={() => {
              if (addReadingMeterId === null) return;
              addReadingMutation.mutate({
                value: Number(newReading.value),
                readAt: `${newReading.readAt}T12:00:00Z`,
                ...(newReading.note ? { note: newReading.note } : {}),
              });
              setAddReadingMeterId(null);
              setNewReading({ value: "", readAt: new Date().toISOString().slice(0, 10), note: "" });
            }}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Unit Dialog */}
      <Dialog open={addUnitOpen} onOpenChange={setAddUnitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Einheit hinzufuegen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unit-number">Nr. *</Label>
                <Input id="unit-number" value={newUnit.number} onChange={(e) => setNewUnit((u) => ({ ...u, number: e.target.value }))} placeholder="z.B. 1A, TG-1" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-type">Typ</Label>
                <Select value={newUnit.type} onValueChange={(v) => setNewUnit((u) => ({ ...u, type: v }))}>
                  <SelectTrigger id="unit-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WOHNUNG">Wohnung</SelectItem>
                    <SelectItem value="GARAGE">Garage</SelectItem>
                    <SelectItem value="STELLPLATZ">Stellplatz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-floor">Etage</Label>
                <Input id="unit-floor" type="number" value={newUnit.floor} onChange={(e) => setNewUnit((u) => ({ ...u, floor: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unit-area">Flaeche (m2) *</Label>
                <Input id="unit-area" type="number" step="0.1" value={newUnit.area} onChange={(e) => setNewUnit((u) => ({ ...u, area: e.target.value }))} placeholder="z.B. 65.5" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-rent">Kaltmiete (EUR) *</Label>
                <Input id="unit-rent" type="number" step="0.01" value={newUnit.rent} onChange={(e) => setNewUnit((u) => ({ ...u, rent: e.target.value }))} placeholder="z.B. 750" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUnitOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAddUnit} disabled={createUnitMutation.isPending}>
              {createUnitMutation.isPending ? "Anlegen..." : "Einheit anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tenant Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mieter zuweisen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Mieter auswaehlen</Label>
              <Select value={assignTenantId} onValueChange={setAssignTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Mieter waehlen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Kein Mieter (Einheit freigeben) --</SelectItem>
                  {/* Show currently assigned tenant if any */}
                  {assignUnitId && units.find((u) => u.id === assignUnitId)?.tenant && (
                    <SelectItem value={String(units.find((u) => u.id === assignUnitId)!.tenant!.id)}>
                      {units.find((u) => u.id === assignUnitId)!.tenant!.name} (aktuell)
                    </SelectItem>
                  )}
                  {availableTenants.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableTenants.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Alle Mieter sind bereits zugewiesen. Erstelle zuerst einen neuen Mieter unter Mieter &gt; Neuer Mieter.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAssignTenant} disabled={updateUnitMutation.isPending}>
              {updateUnitMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument hochladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="doc-file">Datei</Label>
              <Input id="doc-file" type="file" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0] ?? null; setUploadFile(file); if (file && !uploadName) setUploadName(file.name); }} />
              <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPG, PNG (max. 10 MB)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-name">Dokumentname</Label>
              <Input id="doc-name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="z.B. Mietvertrag Wohnung 1A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Abbrechen</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploadMutation.isPending} className="gap-1.5">
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Hochladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-[60vh]">
            {!previewBlobUrl ? (
              <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewDoc?.fileType.toUpperCase() === "PDF" ? (
              <iframe src={previewBlobUrl} className="w-full h-[60vh] border rounded" title={previewDoc.name} />
            ) : (
              <div className="flex items-center justify-center h-[60vh]">
                <img src={previewBlobUrl} alt={previewDoc?.name} className="max-w-full max-h-full object-contain rounded" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Property Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Immobilie bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-street">Straße *</Label>
              <Input id="edit-street" value={editForm.street} onChange={(e) => setEditForm((f) => ({ ...f, street: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-zip">PLZ *</Label>
                <Input id="edit-zip" value={editForm.zip} onChange={(e) => setEditForm((f) => ({ ...f, zip: e.target.value }))} />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="edit-city">Stadt *</Label>
                <Input id="edit-city" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AKTIV">Aktiv</SelectItem>
                  <SelectItem value="WARTUNG">Wartung</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-purchase-price">Kaufpreis (€)</Label>
                <Input
                  id="edit-purchase-price"
                  type="number"
                  step="1000"
                  min="0"
                  placeholder="z.B. 350000"
                  value={editForm.purchasePrice}
                  onChange={(e) => setEditForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-equity">Eigenkapital (€)</Label>
                <Input
                  id="edit-equity"
                  type="number"
                  step="1000"
                  min="0"
                  placeholder="z.B. 70000"
                  value={editForm.equity}
                  onChange={(e) => setEditForm((f) => ({ ...f, equity: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={handleEditProperty} disabled={updatePropertyMutation.isPending}>
              {updatePropertyMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument loeschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Das Dokument wird unwiderruflich geloescht.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} disabled={deleteMutation.isPending} className="gap-1.5">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Loeschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neue Transaktion Dialog */}
      <Dialog open={newTxOpen} onOpenChange={setNewTxOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Neue Transaktion</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Datum *</Label>
                <Input type="date" value={newTx.date} onChange={(e) => setNewTx((t) => ({ ...t, date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Typ *</Label>
                <Select value={newTx.type} onValueChange={(v) => setNewTx((t) => ({ ...t, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EINNAHME">Einnahme</SelectItem>
                    <SelectItem value="AUSGABE">Ausgabe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Beschreibung *</Label>
              <Input value={newTx.description} onChange={(e) => setNewTx((t) => ({ ...t, description: e.target.value }))} placeholder="z.B. Mietzahlung Februar" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Betrag (€) *</Label>
                <Input type="number" step="0.01" min="0" value={newTx.amount} onChange={(e) => setNewTx((t) => ({ ...t, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label>Kategorie</Label>
                <Select value={newTx.category} onValueChange={(v) => setNewTx((t) => ({ ...t, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MIETE">Miete</SelectItem>
                    <SelectItem value="NEBENKOSTEN">Nebenkosten</SelectItem>
                    <SelectItem value="REPARATUR">Reparatur</SelectItem>
                    <SelectItem value="VERWALTUNG">Verwaltung</SelectItem>
                    <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTxOpen(false)}>Abbrechen</Button>
            <Button
              disabled={createTransactionMutation.isPending}
              onClick={async () => {
                if (!newTx.description.trim() || !newTx.amount) {
                  toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen.", variant: "destructive" });
                  return;
                }
                try {
                  await createTransactionMutation.mutateAsync({
                    date: new Date(newTx.date + "T12:00:00Z").toISOString(),
                    description: newTx.description.trim(),
                    type: newTx.type,
                    amount: parseFloat(newTx.amount),
                    category: newTx.category,
                    propertyId,
                  });
                  toast({ title: "Gespeichert", description: "Transaktion wurde erstellt." });
                  setNewTxOpen(false);
                  setNewTx(EMPTY_TX);
                } catch {
                  toast({ title: "Fehler", description: "Transaktion konnte nicht erstellt werden.", variant: "destructive" });
                }
              }}
            >
              {createTransactionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Vertrag Dialog (nach Mieter-Zuweisung) */}
      <Dialog open={autoContractOpen} onOpenChange={setAutoContractOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mietvertrag erstellen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Möchten Sie einen Mietvertrag für den zugewiesenen Mieter anlegen?</p>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Vertragstyp</Label>
                <Select value={contractForm.type} onValueChange={(v) => setContractForm((c) => ({ ...c, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WOHNRAUM">Wohnraum</SelectItem>
                    <SelectItem value="GEWERBE">Gewerbe</SelectItem>
                    <SelectItem value="STAFFEL">Staffelmiete</SelectItem>
                    <SelectItem value="INDEX">Indexmiete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Startdatum *</Label>
                <Input type="date" value={contractForm.startDate} onChange={(e) => setContractForm((c) => ({ ...c, startDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Enddatum (leer = unbefristet)</Label>
                <Input type="date" value={contractForm.endDate} onChange={(e) => setContractForm((c) => ({ ...c, endDate: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Kündigungsfrist (Monate)</Label>
                <Input type="number" min="0" value={contractForm.noticePeriod} onChange={(e) => setContractForm((c) => ({ ...c, noticePeriod: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Monatsmiete (€) *</Label>
                <Input type="number" step="0.01" min="0" value={contractForm.monthlyRent} onChange={(e) => setContractForm((c) => ({ ...c, monthlyRent: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label>Kaution (€)</Label>
                <Input type="number" step="0.01" min="0" value={contractForm.deposit} onChange={(e) => setContractForm((c) => ({ ...c, deposit: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoContractOpen(false)}>Überspringen</Button>
            <Button onClick={handleCreateContract} disabled={createContractMutation.isPending} className="gap-1.5">
              {createContractMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Vertrag erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Übergabeprotokoll Dialog (3 Schritte) */}
      <Dialog open={handoverOpen} onOpenChange={(o) => { if (!o) { setHandoverOpen(false); setHandoverStep(1); setNewHandover(EMPTY_HANDOVER); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Neues Übergabeprotokoll
              <span className="ml-2 text-sm font-normal text-muted-foreground">Schritt {handoverStep}/3</span>
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Grunddaten */}
          {handoverStep === 1 && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Typ *</Label>
                <Select value={newHandover.type} onValueChange={(v) => setNewHandover((h) => ({ ...h, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EINZUG">Einzug</SelectItem>
                    <SelectItem value="AUSZUG">Auszug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Einheit *</Label>
                <Select value={newHandover.unitId} onValueChange={(v) => setNewHandover((h) => ({ ...h, unitId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Einheit wählen" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u: { id: number; number: string }) => (
                      <SelectItem key={u.id} value={String(u.id)}>Einheit {u.number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Mieter *</Label>
                <Input
                  value={newHandover.tenantName}
                  onChange={(e) => setNewHandover((h) => ({ ...h, tenantName: e.target.value }))}
                  placeholder="Name des Mieters"
                />
              </div>
              <div className="grid gap-2">
                <Label>Datum *</Label>
                <Input
                  type="date"
                  value={newHandover.date}
                  onChange={(e) => setNewHandover((h) => ({ ...h, date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Notizen</Label>
                <Input
                  value={newHandover.notes}
                  onChange={(e) => setNewHandover((h) => ({ ...h, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
          )}

          {/* Step 2: Räume */}
          {handoverStep === 2 && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Raumzustand erfassen (optional)</p>
              <div className="flex gap-2">
                <Input
                  value={newRoom.name}
                  onChange={(e) => setNewRoom((r) => ({ ...r, name: e.target.value }))}
                  placeholder="Raum (z.B. Wohnzimmer)"
                  className="flex-1"
                />
                <Select value={newRoom.condition} onValueChange={(v) => setNewRoom((r) => ({ ...r, condition: v }))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GUT">Gut</SelectItem>
                    <SelectItem value="MAENGEL">Mängel</SelectItem>
                    <SelectItem value="DEFEKT">Defekt</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => {
                  if (!newRoom.name.trim()) return;
                  setNewHandover((h) => ({ ...h, rooms: [...h.rooms, { ...newRoom, name: newRoom.name.trim() }] }));
                  setNewRoom({ name: "", condition: "GUT", notes: "" });
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {newHandover.rooms.length > 0 && (
                <div className="space-y-1">
                  {newHandover.rooms.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                      <span>{r.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {r.condition === "GUT" ? "Gut" : r.condition === "MAENGEL" ? "Mängel" : "Defekt"}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
                          onClick={() => setNewHandover((h) => ({ ...h, rooms: h.rooms.filter((_, j) => j !== i) }))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Zählerstände */}
          {handoverStep === 3 && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Zählerstände erfassen (optional)</p>
              <div className="flex gap-2">
                <Input
                  value={newMeterEntry.label}
                  onChange={(e) => setNewMeterEntry((m) => ({ ...m, label: e.target.value }))}
                  placeholder="Zählerbezeichnung"
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={newMeterEntry.value}
                  onChange={(e) => setNewMeterEntry((m) => ({ ...m, value: e.target.value }))}
                  placeholder="Stand"
                  className="w-28"
                />
                <Select value={newMeterEntry.type} onValueChange={(v) => setNewMeterEntry((m) => ({ ...m, type: v }))}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STROM">Strom</SelectItem>
                    <SelectItem value="WASSER">Wasser</SelectItem>
                    <SelectItem value="GAS">Gas</SelectItem>
                    <SelectItem value="WAERME">Wärme</SelectItem>
                    <SelectItem value="SONSTIGES">Sonst.</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => {
                  if (!newMeterEntry.label.trim() || !newMeterEntry.value) return;
                  setNewHandover((h) => ({ ...h, meterData: [...h.meterData, { ...newMeterEntry }] }));
                  setNewMeterEntry({ label: "", value: "", type: "STROM" });
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {newHandover.meterData.length > 0 && (
                <div className="space-y-1">
                  {newHandover.meterData.map((m, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                      <span>{m.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{m.value} ({m.type})</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
                          onClick={() => setNewHandover((h) => ({ ...h, meterData: h.meterData.filter((_, j) => j !== i) }))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {handoverStep > 1 && (
              <Button variant="outline" onClick={() => setHandoverStep((s) => s - 1)}>Zurück</Button>
            )}
            <Button variant="outline" onClick={() => { setHandoverOpen(false); setHandoverStep(1); setNewHandover(EMPTY_HANDOVER); }}>
              Abbrechen
            </Button>
            {handoverStep < 3 ? (
              <Button onClick={() => setHandoverStep((s) => s + 1)}
                disabled={handoverStep === 1 && (!newHandover.unitId || !newHandover.tenantName.trim())}>
                Weiter
              </Button>
            ) : (
              <Button onClick={handleCreateHandover} disabled={createHandoverMutation.isPending} className="gap-1.5">
                {createHandoverMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Speichern
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyDetail;
