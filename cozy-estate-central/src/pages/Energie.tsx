import { useState } from "react";
import { Zap, Pencil } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useProperties } from "@/hooks/api/useProperties";
import {
  useConsumption, useEnergyPassport, useUpsertEnergyPassport,
  type EnergyPassport,
} from "@/hooks/api/useEnergy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const ENERGY_CLASS_COLORS: Record<string, string> = {
  "A+": "bg-green-600 text-white",
  A: "bg-green-500 text-white",
  B: "bg-lime-500 text-white",
  C: "bg-yellow-400 text-black",
  D: "bg-yellow-500 text-black",
  E: "bg-orange-400 text-black",
  F: "bg-orange-500 text-white",
  G: "bg-red-500 text-white",
  H: "bg-red-700 text-white",
};

const BAR_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const METER_TYPES = [
  { key: "STROM", label: "Strom", unit: "kWh" },
  { key: "GAS", label: "Gas", unit: "m³" },
  { key: "WASSER", label: "Wasser", unit: "m³" },
  { key: "WAERME", label: "Wärme", unit: "kWh" },
] as const;

function PassportCard({
  passport,
  onEdit,
}: {
  passport: EnergyPassport | null | undefined;
  onEdit: () => void;
}) {
  if (!passport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Klimaausweis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Noch kein Klimaausweis erfasst.</p>
          <Button className="mt-3" onClick={onEdit}>
            Klimaausweis anlegen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Klimaausweis</CardTitle>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div className="col-span-2 md:col-span-3 flex items-center gap-3">
          <Badge className={ENERGY_CLASS_COLORS[passport.energyClass] ?? "bg-gray-400 text-white"}>
            Klasse {passport.energyClass}
          </Badge>
          <span className="text-muted-foreground">
            {passport.certificateType === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"}
          </span>
        </div>
        {passport.primaryEnergyDemand != null && (
          <div><p className="text-muted-foreground">Primärenergie</p><p className="font-medium">{passport.primaryEnergyDemand} kWh/m²a</p></div>
        )}
        {passport.finalEnergyDemand != null && (
          <div><p className="text-muted-foreground">Endenergie</p><p className="font-medium">{passport.finalEnergyDemand} kWh/m²a</p></div>
        )}
        {passport.energyCarrier && (
          <div><p className="text-muted-foreground">Energieträger</p><p className="font-medium">{passport.energyCarrier}</p></div>
        )}
        <div>
          <p className="text-muted-foreground">Ausgestellt</p>
          <p className="font-medium">{new Date(passport.issuedAt).toLocaleDateString("de-DE")}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Gültig bis</p>
          <p className="font-medium">{new Date(passport.validUntil).toLocaleDateString("de-DE")}</p>
        </div>
        {passport.certificateNumber && (
          <div><p className="text-muted-foreground">Ausweis-Nr.</p><p className="font-medium">{passport.certificateNumber}</p></div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Energie() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [activeType, setActiveType] = useState<string>("STROM");
  const [passportDialogOpen, setPassportDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<EnergyPassport>>({});
  const { toast } = useToast();

  const { data: propertiesRes } = useProperties();
  const properties = propertiesRes?.data ?? [];

  const { data: consumption } = useConsumption(selectedPropertyId, year);
  const { data: passport } = useEnergyPassport(selectedPropertyId);
  const upsertPassport = useUpsertEnergyPassport(selectedPropertyId ?? 0);

  const currentYear = new Date().getFullYear();

  const chartData = MONTHS.map((month, idx) => {
    const entry: Record<string, number | string> = { month };
    consumption?.units.forEach((u) => {
      const val = u.consumption[activeType as keyof typeof u.consumption]?.[idx] ?? 0;
      entry[u.unitNumber] = val;
    });
    return entry;
  });

  const unitNumbers = consumption?.units.map((u) => u.unitNumber) ?? [];
  const activeTypeMeta = METER_TYPES.find((t) => t.key === activeType)!;
  const hasData = consumption?.units.some((u) =>
    u.consumption[activeType as keyof typeof u.consumption]?.some((v) => v > 0),
  );

  function openEditDialog() {
    setForm(
      passport
        ? { ...passport, issuedAt: passport.issuedAt.slice(0, 10), validUntil: passport.validUntil.slice(0, 10) }
        : { certificateType: "VERBRAUCH", energyClass: "C" },
    );
    setPassportDialogOpen(true);
  }

  async function savePassport() {
    try {
      await upsertPassport.mutateAsync({
        certificateType: form.certificateType ?? "VERBRAUCH",
        energyClass: form.energyClass ?? "C",
        primaryEnergyDemand: form.primaryEnergyDemand ?? undefined,
        finalEnergyDemand: form.finalEnergyDemand ?? undefined,
        energyCarrier: form.energyCarrier ?? undefined,
        issuedAt: new Date(form.issuedAt ?? "").toISOString(),
        validUntil: new Date(form.validUntil ?? "").toISOString(),
        certificateNumber: form.certificateNumber ?? undefined,
      });
      setPassportDialogOpen(false);
      toast({ title: "Klimaausweis gespeichert" });
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2 flex-1">
          <Zap className="h-5 w-5" />
          <h1 className="font-heading text-lg font-semibold text-foreground">Energie</h1>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Property + Year selectors */}
        <div className="flex gap-3 flex-wrap items-center">
          <Select
            value={selectedPropertyId?.toString() ?? ""}
            onValueChange={(v) => setSelectedPropertyId(Number(v))}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Immobilie auswählen" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>◀</Button>
            <span className="font-medium w-12 text-center">{year}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= currentYear}
            >
              ▶
            </Button>
          </div>
        </div>

        {!selectedPropertyId ? (
          <p className="text-muted-foreground">Bitte eine Immobilie auswählen.</p>
        ) : (
          <>
            <PassportCard passport={passport} onEdit={openEditDialog} />

            {/* Consumption charts */}
            <Card>
              <CardHeader>
                <CardTitle>Verbrauchsübersicht {year}</CardTitle>
                <div className="flex gap-2 flex-wrap mt-2">
                  {METER_TYPES.map((t) => (
                    <Button
                      key={t.key}
                      variant={activeType === t.key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveType(t.key)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {!hasData ? (
                  <p className="text-muted-foreground text-sm">
                    Keine Verbrauchsdaten für {activeTypeMeta.label} vorhanden — Zähler und Ablesungen
                    unter der Immobilie erfassen.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis unit={` ${activeTypeMeta.unit}`} />
                      <Tooltip formatter={(v: number) => `${v} ${activeTypeMeta.unit}`} />
                      <Legend />
                      {unitNumbers.map((name, i) => (
                        <Bar key={name} dataKey={name} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Klimaausweis Edit Dialog */}
        <Dialog open={passportDialogOpen} onOpenChange={setPassportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Klimaausweis bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div>
                <Label>Typ</Label>
                <Select value={form.certificateType} onValueChange={(v) => setForm((f) => ({ ...f, certificateType: v as "VERBRAUCH" | "BEDARF" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VERBRAUCH">Verbrauchsausweis</SelectItem>
                    <SelectItem value="BEDARF">Bedarfsausweis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Energieklasse</Label>
                <Select value={form.energyClass} onValueChange={(v) => setForm((f) => ({ ...f, energyClass: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A+", "A", "B", "C", "D", "E", "F", "G", "H"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Primärenergie (kWh/m²a)</Label>
                <Input type="number" value={form.primaryEnergyDemand ?? ""} onChange={(e) => setForm((f) => ({ ...f, primaryEnergyDemand: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label>Endenergie (kWh/m²a)</Label>
                <Input type="number" value={form.finalEnergyDemand ?? ""} onChange={(e) => setForm((f) => ({ ...f, finalEnergyDemand: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label>Energieträger</Label>
                <Input value={form.energyCarrier ?? ""} onChange={(e) => setForm((f) => ({ ...f, energyCarrier: e.target.value }))} placeholder="z.B. Gas" />
              </div>
              <div>
                <Label>Ausweis-Nr.</Label>
                <Input value={form.certificateNumber ?? ""} onChange={(e) => setForm((f) => ({ ...f, certificateNumber: e.target.value }))} />
              </div>
              <div>
                <Label>Ausgestellt</Label>
                <Input type="date" value={form.issuedAt ?? ""} onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))} />
              </div>
              <div>
                <Label>Gültig bis</Label>
                <Input type="date" value={form.validUntil ?? ""} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPassportDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={savePassport} disabled={upsertPassport.isPending}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
