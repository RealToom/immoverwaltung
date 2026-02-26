import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  MapPin,
  Search,
  Users,
  CreditCard,
  AlertTriangle,
  Plus,
  Loader2,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useProperties, useCreateProperty } from "@/hooks/api/useProperties";
import { mapPropertyStatus, formatCurrency } from "@/lib/mappings";
import { KpiCard } from "@/components/KpiCard";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const Properties = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [addOpen, setAddOpen] = useState(false);
  const [newProp, setNewProp] = useState({ name: "", street: "", zip: "", city: "" });
  const createProperty = useCreateProperty();

  useEffect(() => {
    if (searchParams.get("action") === "add" && user?.role !== "READONLY") {
      setAddOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, user]);

  const handleAddProperty = async () => {
    if (!newProp.name.trim() || !newProp.street.trim() || !newProp.zip.trim() || !newProp.city.trim()) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfuellen.", variant: "destructive" });
      return;
    }
    try {
      await createProperty.mutateAsync({
        name: newProp.name.trim(),
        street: newProp.street.trim(),
        zip: newProp.zip.trim(),
        city: newProp.city.trim(),
      });
      toast({ title: "Erstellt", description: `${newProp.name} wurde angelegt.` });
      setNewProp({ name: "", street: "", zip: "", city: "" });
      setAddOpen(false);
    } catch {
      toast({ title: "Fehler", description: "Immobilie konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const backendStatus = statusFilter !== "alle" ? statusFilter.toUpperCase() : undefined;
  const { data: response, isLoading, error } = useProperties(search || undefined, backendStatus);
  const properties = response?.data ?? [];

  const stats = useMemo(() => {
    const totalUnits = properties.reduce((s, p) => s + p.totalUnits, 0);
    const totalOccupied = properties.reduce((s, p) => s + p.occupiedUnits, 0);
    const totalVacant = totalUnits - totalOccupied;
    const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;
    return { totalUnits, totalOccupied, totalVacant, occupancyRate };
  }, [properties]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-destructive">Fehler beim Laden der Immobilien.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Immobilien</h1>
          <p className="text-xs text-muted-foreground">
            {properties.length} Objekte verwaltet
          </p>
        </div>
        {user?.role !== "READONLY" && (
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Neue Immobilie
          </Button>
        )}
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Immobilien"
            value={String(properties.length)}
            change={`${properties.filter((p) => mapPropertyStatus(p.status) === "aktiv").length} aktiv`}
            changeType="positive"
            icon={Building2}
          />
          <KpiCard
            title="Einheiten gesamt"
            value={String(stats.totalUnits)}
            change={`${stats.totalOccupied} belegt`}
            changeType="positive"
            icon={Users}
            iconBg="bg-accent/15"
            iconColor="text-accent-foreground"
          />
          <KpiCard
            title="Belegungsquote"
            value={`${stats.occupancyRate}%`}
            change={`${stats.totalVacant} frei`}
            changeType={stats.occupancyRate >= 90 ? "positive" : "negative"}
            icon={CreditCard}
            iconBg="bg-success/15"
            iconColor="text-success"
          />
          <KpiCard
            title="Leerstand"
            value={String(stats.totalVacant)}
            change={stats.totalUnits > 0 ? `${Math.round((stats.totalVacant / stats.totalUnits) * 100)}% Leerstandsquote` : "0%"}
            changeType="negative"
            icon={AlertTriangle}
            iconBg="bg-destructive/10"
            iconColor="text-destructive"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Immobilie suchen..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Status</SelectItem>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="wartung">Wartung</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Property Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {properties.map((property) => {
                const status = mapPropertyStatus(property.status);
                const occupancy = property.totalUnits > 0
                  ? Math.round((property.occupiedUnits / property.totalUnits) * 100)
                  : 0;
                const vacant = property.totalUnits - property.occupiedUnits;

                return (
                  <Card
                    key={property.id}
                    className="border border-border/60 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="font-heading text-base font-semibold text-foreground">
                            {property.name}
                          </CardTitle>
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{property.address}</span>
                          </div>
                        </div>
                        <Badge
                          variant={status === "aktiv" ? "default" : "secondary"}
                          className={
                            status === "aktiv"
                              ? "bg-success/15 text-success border-0 hover:bg-success/20"
                              : "bg-warning/15 text-warning border-0 hover:bg-warning/20"
                          }
                        >
                          {status === "aktiv" ? "Aktiv" : "Wartung"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Occupancy bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Belegung</span>
                          <span>{occupancy}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-sm font-semibold text-foreground">{property.totalUnits}</div>
                          <div className="text-[10px] text-muted-foreground">Einheiten</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-sm font-semibold text-foreground">{vacant}</div>
                          <div className="text-[10px] text-muted-foreground">Leer</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-sm font-semibold text-foreground">{property.maintenanceUnits}</div>
                          <div className="text-[10px] text-muted-foreground">Wartung</div>
                        </div>
                      </div>

                      {/* Revenue */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-xs text-muted-foreground">Monatseinnahmen</span>
                        <span className="font-semibold text-foreground">{formatCurrency(property.monthlyRevenue)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {properties.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Keine Immobilien gefunden
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Add Property Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Immobilie anlegen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="prop-name">Name *</Label>
              <Input
                id="prop-name"
                value={newProp.name}
                onChange={(e) => setNewProp((p) => ({ ...p, name: e.target.value }))}
                placeholder="z.B. Wohnanlage Am Park"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prop-street">Straße *</Label>
              <Input
                id="prop-street"
                value={newProp.street}
                onChange={(e) => setNewProp((p) => ({ ...p, street: e.target.value }))}
                placeholder="z.B. Musterstr. 1"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="prop-zip">PLZ *</Label>
                <Input
                  id="prop-zip"
                  value={newProp.zip}
                  onChange={(e) => setNewProp((p) => ({ ...p, zip: e.target.value }))}
                  placeholder="10115"
                />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="prop-city">Stadt *</Label>
                <Input
                  id="prop-city"
                  value={newProp.city}
                  onChange={(e) => setNewProp((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Berlin"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAddProperty} disabled={createProperty.isPending}>
              {createProperty.isPending ? "Anlegen..." : "Immobilie anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Properties;
