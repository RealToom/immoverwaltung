import { useState, useMemo } from "react";
import {
  Users,
  Wrench,
  TrendingUp,
  CreditCard,
  Loader2,
  Download,
  CalendarDays,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KpiCard } from "@/components/KpiCard";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/hooks/api/useProperties";
import { useMaintenanceTickets } from "@/hooks/api/useMaintenanceTickets";
import { useRevenueByProperty, useMonthlyByYear, useRoiData } from "@/hooks/api/useFinance";
import { mapMaintenanceCategory, mapMaintenanceStatus, formatCurrency } from "@/lib/mappings";
import { getToken } from "@/lib/api";

const COLORS = [
  "hsl(215, 60%, 28%)",
  "hsl(38, 92%, 55%)",
  "hsl(152, 60%, 42%)",
  "hsl(0, 72%, 51%)",
  "hsl(215, 25%, 55%)",
];

const Reports = () => {
  const { data: propertiesRes, isLoading: propsLoading } = useProperties();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const currentYear = new Date().getFullYear();
  const [annualYear, setAnnualYear] = useState(currentYear);
  const { data: monthlyByYearRes } = useMonthlyByYear(annualYear);
  const { data: roiRes } = useRoiData(annualYear);
  const { data: ticketsRes, isLoading: ticketsLoading } = useMaintenanceTickets(
    undefined, undefined, undefined, undefined, from || undefined, to || undefined,
  );
  const { data: revenueRes, isLoading: revenueLoading } = useRevenueByProperty();

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const token = getToken();
      const res = await fetch(`/api/reports/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Export fehlgeschlagen (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bericht.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const isLoading = propsLoading || ticketsLoading || revenueLoading;
  const properties = propertiesRes?.data ?? [];
  const tickets = ticketsRes?.data ?? [];
  const revenueByProp = revenueRes?.data ?? [];

  // Occupancy per property
  const occupancyData = useMemo(() => {
    return properties.map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
      fullName: p.name,
      belegt: p.occupiedUnits,
      leer: p.totalUnits - p.occupiedUnits,
      quote: p.totalUnits > 0 ? Math.round((p.occupiedUnits / p.totalUnits) * 100) : 0,
    }));
  }, [properties]);

  const occupancyChartConfig = {
    belegt: { label: "Belegt", color: "hsl(152, 60%, 42%)" },
    leer: { label: "Leer", color: "hsl(0, 72%, 51%)" },
  };

  // Revenue per property
  const revenueData = useMemo(() => {
    return properties.map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
      fullName: p.name,
      einnahmen: p.monthlyRevenue,
    }));
  }, [properties]);

  const revenueChartConfig = {
    einnahmen: { label: "Monatseinnahmen", color: "hsl(215, 60%, 28%)" },
  };

  // Revenue per sqm using revenue-by-property endpoint (no unit-level area available)
  const revenuePerSqm = useMemo(() => {
    return revenueByProp.map((p) => ({
      name: p.propertyName.length > 14 ? p.propertyName.slice(0, 14) + "…" : p.propertyName,
      fullName: p.propertyName,
      auslastung: p.occupancyRate,
    }));
  }, [revenueByProp]);

  const sqmChartConfig = {
    auslastung: { label: "Auslastung %", color: "hsl(38, 92%, 55%)" },
  };

  // Maintenance costs by category
  const maintenanceByCat = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      if (t.cost) {
        const cat = mapMaintenanceCategory(t.category);
        map[cat] = (map[cat] || 0) + t.cost;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const maintenanceCatConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {};
    maintenanceByCat.forEach((item, i) => {
      cfg[item.name] = { label: item.name, color: COLORS[i % COLORS.length] };
    });
    return cfg;
  }, [maintenanceByCat]);

  // Maintenance costs by property
  const maintenanceByProp = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      if (t.cost) {
        const propName = t.property.name;
        map[propName] = (map[propName] || 0) + t.cost;
      }
    });
    return Object.entries(map)
      .map(([name, kosten]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, fullName: name, kosten }))
      .sort((a, b) => b.kosten - a.kosten);
  }, [tickets]);

  const maintenancePropConfig = {
    kosten: { label: "Wartungskosten", color: "hsl(0, 72%, 51%)" },
  };

  // Top-level stats
  const stats = useMemo(() => {
    const totalUnits = properties.reduce((s, p) => s + p.totalUnits, 0);
    const totalOccupied = properties.reduce((s, p) => s + p.occupiedUnits, 0);
    const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;
    const totalRevenue = properties.reduce((s, p) => s + p.monthlyRevenue, 0);
    const totalMaintenance = tickets.reduce((s, t) => s + (t.cost || 0), 0);
    const openTickets = tickets.filter((t) => mapMaintenanceStatus(t.status) !== "erledigt").length;
    return { totalUnits, totalOccupied, occupancyRate, totalRevenue, totalMaintenance, openTickets };
  }, [properties, tickets]);

  // Property detail table
  const propertyDetails = useMemo(() => {
    return properties.map((p) => {
      const occupancy = p.totalUnits > 0 ? Math.round((p.occupiedUnits / p.totalUnits) * 100) : 0;
      const maintenance = tickets
        .filter((t) => t.property.name === p.name)
        .reduce((s, t) => s + (t.cost || 0), 0);
      const openTix = tickets
        .filter((t) => t.property.name === p.name && mapMaintenanceStatus(t.status) !== "erledigt")
        .length;
      return { ...p, occupancy, maintenance, openTix };
    });
  }, [properties, tickets]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Berichte</h1>
          <p className="text-xs text-muted-foreground">Auswertungen und Analysen</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-background"
            title="Von"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-background"
            title="Bis"
          />
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="flex items-center gap-1.5 text-sm border rounded px-3 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting}
            className="flex items-center gap-1.5 text-sm border rounded px-3 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <Tabs defaultValue="uebersicht" className="h-full flex flex-col">
          <div className="px-6 pt-4 border-b pb-0">
            <TabsList className="bg-transparent p-0 h-auto gap-0 rounded-none">
              <TabsTrigger value="uebersicht" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3">
                <Users className="h-4 w-4 mr-1.5" />
                Übersicht
              </TabsTrigger>
              <TabsTrigger value="jahresabschluss" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3">
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Jahresabschluss
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="uebersicht" className="flex-1 overflow-auto m-0 p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Belegungsquote" value={`${stats.occupancyRate}%`} change={`${stats.totalOccupied} von ${stats.totalUnits} Einheiten`} changeType={stats.occupancyRate >= 90 ? "positive" : "negative"} icon={Users} />
          <KpiCard title="Monatl. Einnahmen" value={formatCurrency(stats.totalRevenue)} change={`${properties.length} Immobilien`} changeType="positive" icon={CreditCard} iconBg="bg-success/15" iconColor="text-success" />
          <KpiCard title="Wartungskosten" value={formatCurrency(stats.totalMaintenance)} change={`${stats.openTickets} offene Tickets`} changeType="negative" icon={Wrench} iconBg="bg-destructive/10" iconColor="text-destructive" />
          <KpiCard
            title="Rendite (ca.)"
            value={`${stats.totalRevenue > 0 ? Math.round(((stats.totalRevenue - stats.totalMaintenance) / stats.totalRevenue) * 100) : 0}%`}
            change="nach Wartungskosten"
            changeType="positive"
            icon={TrendingUp}
            iconBg="bg-accent/15"
            iconColor="text-accent-foreground"
          />
        </div>

        {/* Charts Row 1: Occupancy + Revenue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Belegung nach Immobilie</CardTitle>
              <CardDescription>Belegte vs. leere Einheiten</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={occupancyChartConfig} className="h-[280px] w-full">
                <BarChart data={occupancyData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} interval={0} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent labelKey="fullName" />} />
                  <Bar dataKey="belegt" stackId="a" fill="hsl(152, 60%, 42%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="leer" stackId="a" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monatseinnahmen nach Immobilie</CardTitle>
              <CardDescription>Brutto-Mieteinnahmen pro Monat</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => `€ ${Number(value).toLocaleString("de-DE")}`} />} />
                  <Bar dataKey="einnahmen" fill="hsl(215, 60%, 28%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2: Auslastung + Maintenance by Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Auslastung nach Immobilie</CardTitle>
              <CardDescription>Belegungsquote pro Objekt (%)</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={sqmChartConfig} className="h-[280px] w-full">
                <BarChart data={revenuePerSqm} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={110} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
                  <Bar dataKey="auslastung" fill="hsl(38, 92%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Wartungskosten nach Kategorie</CardTitle>
              <CardDescription>Verteilung der Instandhaltungskosten</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ChartContainer config={maintenanceCatConfig} className="h-[280px] w-full">
                <PieChart>
                  <Pie
                    data={maintenanceByCat}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: €${value.toLocaleString("de-DE")}`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {maintenanceByCat.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => `€ ${Number(value).toLocaleString("de-DE")}`} />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Maintenance costs by property */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Wartungskosten nach Immobilie</CardTitle>
            <CardDescription>Gesamt-Instandhaltungsaufwand pro Objekt</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={maintenancePropConfig} className="h-[250px] w-full">
              <BarChart data={maintenanceByProp}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `€ ${Number(value).toLocaleString("de-DE")}`} />} />
                <Bar dataKey="kosten" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Detail Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Immobilien-Kennzahlen</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Immobilie</TableHead>
                  <TableHead className="text-center">Einheiten</TableHead>
                  <TableHead className="text-center">Belegung</TableHead>
                  <TableHead className="text-right">Einnahmen</TableHead>
                  <TableHead className="text-right">Wartung</TableHead>
                  <TableHead className="text-center">Offene Tickets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyDetails.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-center">{p.occupiedUnits}/{p.totalUnits}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={p.occupancy >= 90 ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                        {p.occupancy}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(p.monthlyRevenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.maintenance)}</TableCell>
                    <TableCell className="text-center">
                      {p.openTix > 0 ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">{p.openTix}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Jahresabschluss Tab */}
          <TabsContent value="jahresabschluss" className="flex-1 overflow-auto m-0 p-6 space-y-6">
            {/* Year selector */}
            <div className="flex items-center gap-3">
              <h2 className="font-heading font-semibold text-foreground">Jahresabschluss</h2>
              <div className="flex items-center gap-1 ml-2">
                <Button variant="outline" size="sm" onClick={() => setAnnualYear((y) => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-base min-w-16 text-center">{annualYear}</span>
                <Button variant="outline" size="sm" onClick={() => setAnnualYear((y) => Math.min(currentYear + 1, y + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Annual KPIs */}
            {(() => {
              const months = monthlyByYearRes?.data ?? [];
              const roiData = roiRes?.data ?? [];
              const totalEin = months.reduce((s, m) => s + m.einnahmen, 0);
              const totalAus = months.reduce((s, m) => s + m.ausgaben, 0);
              const totalNet = totalEin - totalAus;
              const avgRendite = roiData.length > 0
                ? roiData.reduce((s, p) => s + (p.nettorendite ?? 0), 0) / roiData.length
                : 0;

              const monthlyChartData = months.map((m) => ({
                monat: m.month.slice(5), // "MM"
                Einnahmen: m.einnahmen,
                Ausgaben: m.ausgaben,
                Nettoertrag: m.netto,
              }));

              const annualChartConfig = {
                Einnahmen: { label: "Einnahmen", color: "hsl(152, 60%, 42%)" },
                Ausgaben: { label: "Ausgaben", color: "hsl(0, 72%, 51%)" },
                Nettoertrag: { label: "Nettoertrag", color: "hsl(215, 60%, 28%)" },
              };

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard title="Jahreseinnahmen" value={formatCurrency(totalEin)} change={`${annualYear}`} changeType="positive" icon={CreditCard} iconBg="bg-success/15" iconColor="text-success" />
                    <KpiCard title="Jahresausgaben" value={formatCurrency(totalAus)} change="inkl. Wartung & Kosten" changeType="negative" icon={Wrench} iconBg="bg-destructive/10" iconColor="text-destructive" />
                    <KpiCard title="Nettoertrag" value={formatCurrency(totalNet)} change="Einnahmen – Ausgaben" changeType={totalNet >= 0 ? "positive" : "negative"} icon={TrendingUp} iconBg="bg-accent/15" iconColor="text-accent-foreground" />
                    <KpiCard title="Ø Nettorendite" value={`${avgRendite.toFixed(1)}%`} change="über alle Objekte" changeType={avgRendite >= 3 ? "positive" : "negative"} icon={BarChart3} />
                  </div>

                  {/* Monthly Trend Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Monatlicher Verlauf {annualYear}</CardTitle>
                      <CardDescription>Einnahmen, Ausgaben und Nettoertrag je Monat</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={annualChartConfig} className="h-[300px] w-full">
                        <LineChart data={monthlyChartData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="monat" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `€ ${Number(value).toLocaleString("de-DE")}`} />} />
                          <Legend />
                          <Line type="monotone" dataKey="Einnahmen" stroke="hsl(152, 60%, 42%)" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="Ausgaben" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="Nettoertrag" stroke="hsl(215, 60%, 28%)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Per-Property ROI Table */}
                  {roiData.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Rendite nach Immobilie {annualYear}</CardTitle>
                        <CardDescription>Jahresergebnis und Renditekennzahlen pro Objekt</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Immobilie</TableHead>
                              <TableHead className="text-right">Jahreseinnahmen</TableHead>
                              <TableHead className="text-right">Jahresausgaben</TableHead>
                              <TableHead className="text-right">Nettoertrag</TableHead>
                              <TableHead className="text-right">Brutto-Rendite</TableHead>
                              <TableHead className="text-right">Netto-Rendite</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {roiData.map((p) => (
                              <TableRow key={p.propertyId}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell className="text-right text-success font-medium">{formatCurrency(p.annualIncome)}</TableCell>
                                <TableCell className="text-right text-destructive">{formatCurrency(p.annualExpenses)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(p.netIncome)}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className="bg-accent/10">{(p.bruttorendite ?? 0).toFixed(1)}%</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className={(p.nettorendite ?? 0) >= 3 ? "bg-success/10 text-success border-success/20" : "bg-muted"}>
                                    {(p.nettorendite ?? 0).toFixed(1)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Reports;
