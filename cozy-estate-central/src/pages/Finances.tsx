import { useState, useMemo, useRef } from "react";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Loader2,
  Plus,
  ScanLine,
  BarChart3,
  Building2,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { useFinanceSummary, useMonthlyRevenue, useRevenueByProperty, useTransactions, useExpenseBreakdown, useRentCollection, useCreateTransaction, useRoiData } from "@/hooks/api/useFinance";
import type { ScannedReceipt } from "@/hooks/api/useFinance";
import { useRecurringTransactions, useCreateRecurring, useUpdateRecurring, useDeleteRecurring } from "@/hooks/api/useRecurringTransactions";
import { useProperties } from "@/hooks/api/useProperties";
import { formatDate, formatCurrency, formatChartMonth } from "@/lib/mappings";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFileWithProgress, type ScanPhase } from "@/lib/api";

const PIE_COLORS = [
  "hsl(215, 60%, 28%)",
  "hsl(38, 92%, 55%)",
  "hsl(152, 60%, 42%)",
  "hsl(0, 72%, 51%)",
  "hsl(215, 10%, 48%)",
  "hsl(270, 50%, 50%)",
  "hsl(180, 50%, 40%)",
];

const revenueChartConfig = {
  einnahmen: { label: "Einnahmen", color: "hsl(152, 60%, 42%)" },
  ausgaben: { label: "Ausgaben", color: "hsl(0, 72%, 51%)" },
  netto: { label: "Netto", color: "hsl(215, 60%, 28%)" },
};

const collectionChartConfig = {
  pünktlich: { label: "Pünktlich", color: "hsl(152, 60%, 42%)" },
  verspätet: { label: "Verspätet", color: "hsl(38, 92%, 55%)" },
  ausstehend: { label: "Ausstehend", color: "hsl(0, 72%, 51%)" },
};

const propertyChartConfig = {
  einnahmen: { label: "Einnahmen", color: "hsl(215, 60%, 28%)" },
  potenzial: { label: "Potenzial", color: "hsl(215, 60%, 28%, 0.2)" },
};

const EMPTY_TX = {
  type: "AUSGABE",
  date: "",
  description: "",
  amount: "",
  category: "",
  propertyId: "none",
};

const CATEGORIES = ["Miete", "Nebenkosten", "Instandhaltung", "Verwaltung", "Versicherung", "Sonstiges"];

const Finances = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState("8m");
  const [txFilter, setTxFilter] = useState<"alle" | "einnahme" | "ausgabe">("alle");
  const [mainTab, setMainTab] = useState("uebersicht");
  const [roiYear, setRoiYear] = useState(new Date().getFullYear());

  // New transaction dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newTx, setNewTx] = useState(EMPTY_TX);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Wiederkehrende Transaktionen state
  const [recurringOpen, setRecurringOpen] = useState(false);
  const EMPTY_RECURRING = { description: "", type: "AUSGABE", amount: "", category: "", allocatable: false, interval: "MONATLICH", dayOfMonth: "1", startDate: "", endDate: "", propertyId: "none" };
  const [newRecurring, setNewRecurring] = useState(EMPTY_RECURRING);

  const months = parseInt(period.replace("m", ""), 10);
  const { data: summaryRes, isLoading: summaryLoading } = useFinanceSummary();
  const { data: monthlyRes } = useMonthlyRevenue(months);
  const { data: byPropertyRes } = useRevenueByProperty();
  const { data: txRes, isLoading: txLoading } = useTransactions(
    1, 25,
    txFilter !== "alle" ? txFilter : undefined,
  );
  const { data: expenseRes } = useExpenseBreakdown();
  const { data: rentCollectionRes } = useRentCollection(months);
  const { data: propertiesRes } = useProperties();
  const { data: roiRes } = useRoiData(roiYear);
  const createTx = useCreateTransaction();
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const { data: recurringRes } = useRecurringTransactions();
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();
  const deleteRecurring = useDeleteRecurring();

  const summary = summaryRes?.data;
  const transactions = txRes?.data ?? [];
  const properties = propertiesRes?.data ?? [];

  const expenseCategories = useMemo(() => {
    const raw = expenseRes?.data ?? [];
    return raw.map((cat, i) => ({
      ...cat,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [expenseRes]);

  const monthlyData = useMemo(() => {
    const raw = monthlyRes?.data ?? [];
    return raw.map((d) => ({
      ...d,
      month: formatChartMonth(d.month),
    }));
  }, [monthlyRes]);

  const propertyRevenue = useMemo(() => {
    const raw = byPropertyRes?.data ?? [];
    return raw.map((p) => ({
      name: p.propertyName,
      einnahmen: p.actualRevenue,
      potenzial: p.potentialRevenue - p.actualRevenue,
      auslastung: p.occupancyRate,
    }));
  }, [byPropertyRes]);

  const rentCollection = useMemo(() => {
    const raw = rentCollectionRes?.data ?? [];
    return raw.map((d) => ({
      month: formatChartMonth(d.month),
      "pünktlich": d.puenktlich,
      "verspätet": d.verspaetet,
      ausstehend: d.ausstehend,
    }));
  }, [rentCollectionRes]);

  const totalExpenseAmount = expenseCategories.reduce((s, c) => s + c.value, 0);

  const roiKpis = useMemo(() => {
    const items = roiRes?.data ?? [];
    const withData = items.filter((p) => p.nettorendite !== null);
    const portfolioNet = withData.length > 0
      ? withData.reduce((s, p) => s + (p.nettorendite ?? 0), 0) / withData.length
      : null;
    const best = withData.length > 0
      ? withData.reduce((a, b) => (b.nettorendite ?? -Infinity) > (a.nettorendite ?? -Infinity) ? b : a)
      : null;
    return { portfolioNet, best };
  }, [roiRes]);

  const openCreateDialog = () => {
    setNewTx(EMPTY_TX);
    setScanInfo(null);
    setCreateOpen(true);
  };

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
    try {
      const res = await uploadFileWithProgress<{ data: ScannedReceipt }>(
        "/finance/scan",
        fd,
        setScanPhase,
      );
      const d = res.data;
      setNewTx((prev) => ({
        ...prev,
        amount: d.amount != null ? String(d.amount) : prev.amount,
        date: d.date ?? prev.date,
        description: d.description ?? prev.description,
        category: d.category ?? prev.category,
        type: d.type ?? prev.type,
      }));
      setScanInfo("Felder automatisch ausgefüllt – bitte prüfen und ggf. korrigieren.");
    } catch {
      toast({ title: "Scan fehlgeschlagen", description: "Bitte erneut versuchen.", variant: "destructive" });
    } finally {
      setScanPhase("idle");
    }
  };

  const handleCreate = async () => {
    if (!newTx.date || !newTx.description || !newTx.amount) {
      toast({ title: "Pflichtfelder fehlen", description: "Datum, Beschreibung und Betrag sind erforderlich.", variant: "destructive" });
      return;
    }
    try {
      await createTx.mutateAsync({
        type: newTx.type,
        date: new Date(newTx.date + "T12:00:00Z").toISOString(),
        description: newTx.description,
        amount: parseFloat(newTx.amount),
        category: newTx.category || undefined,
        propertyId: newTx.propertyId && newTx.propertyId !== "none" ? Number(newTx.propertyId) : null,
      });
      setCreateOpen(false);
      toast({ title: "Transaktion gespeichert" });
    } catch {
      toast({ title: "Speichern fehlgeschlagen", description: "Bitte erneut versuchen.", variant: "destructive" });
    }
  };

  const handleCreateRecurring = async () => {
    if (!newRecurring.description || !newRecurring.amount || !newRecurring.startDate) {
      toast({ title: "Pflichtfelder fehlen", description: "Beschreibung, Betrag und Startdatum sind erforderlich.", variant: "destructive" });
      return;
    }
    try {
      await createRecurring.mutateAsync({
        description: newRecurring.description,
        type: newRecurring.type,
        amount: parseFloat(newRecurring.amount),
        category: newRecurring.category || "",
        allocatable: newRecurring.allocatable,
        interval: newRecurring.interval,
        dayOfMonth: parseInt(newRecurring.dayOfMonth, 10),
        startDate: new Date(newRecurring.startDate + "T12:00:00Z").toISOString(),
        endDate: newRecurring.endDate ? new Date(newRecurring.endDate + "T12:00:00Z").toISOString() : undefined,
        propertyId: newRecurring.propertyId && newRecurring.propertyId !== "none" ? Number(newRecurring.propertyId) : undefined,
      });
      setRecurringOpen(false);
      setNewRecurring(EMPTY_RECURRING);
      toast({ title: "Wiederkehrende Buchung gespeichert" });
    } catch {
      toast({ title: "Speichern fehlgeschlagen", description: "Bitte erneut versuchen.", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Finanzen</h1>
          <p className="text-xs text-muted-foreground">Einnahmen, Ausgaben & Analysen</p>
        </div>
        {user?.role !== "READONLY" && (
          <Button size="sm" onClick={openCreateDialog} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Neue Transaktion
          </Button>
        )}
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Letzte 3 Monate</SelectItem>
            <SelectItem value="6m">Letzte 6 Monate</SelectItem>
            <SelectItem value="8m">Letzte 8 Monate</SelectItem>
            <SelectItem value="12m">Letzte 12 Monate</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Main Tabs: Uebersicht / Rendite */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="uebersicht" className="gap-1.5">
              <CreditCard className="h-4 w-4" />
              Uebersicht
            </TabsTrigger>
            <TabsTrigger value="rendite" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Rendite
            </TabsTrigger>
            <TabsTrigger value="wiederkehrend" className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Wiederkehrend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="space-y-6 mt-0">
            {/* KPI Row */}
            {summaryLoading || !summary ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="Monatl. Einnahmen"
                  value={formatCurrency(summary.monthlyRevenue)}
                  change={`${formatCurrency(summary.totalIncome)} Gesamt`}
                  changeType="positive"
                  icon={TrendingUp}
                  iconBg="bg-success/15"
                  iconColor="text-success"
                />
                <KpiCard
                  title="Monatl. Ausgaben"
                  value={formatCurrency(summary.totalExpenses)}
                  change="aus Transaktionen"
                  changeType="positive"
                  icon={TrendingDown}
                  iconBg="bg-destructive/10"
                  iconColor="text-destructive"
                />
                <KpiCard
                  title="Netto-Ertrag"
                  value={formatCurrency(summary.netIncome)}
                  change="Einnahmen - Ausgaben"
                  changeType="positive"
                  icon={CreditCard}
                  iconBg="bg-primary/10"
                  iconColor="text-primary"
                />
                <KpiCard
                  title="Potenzielle Miete"
                  value={formatCurrency(
                    propertyRevenue.reduce((s, p) => s + p.einnahmen + p.potenzial, 0)
                  )}
                  change={`${formatCurrency(
                    propertyRevenue.reduce((s, p) => s + p.potenzial, 0)
                  )} ungenutzt`}
                  changeType="negative"
                  icon={Receipt}
                  iconBg="bg-warning/15"
                  iconColor="text-accent"
                />
              </div>
            )}

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue/Expense Chart */}
              <Card className="lg:col-span-2 border border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading font-semibold">Einnahmen & Ausgaben</CardTitle>
                  <CardDescription>Monatliche Übersicht</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
                    <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillEinnahmen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fillAusgaben" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(215, 10%, 48%)" }} />
                      <YAxis className="text-xs" tick={{ fill: "hsl(215, 10%, 48%)" }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => `€ ${Number(value).toLocaleString("de-DE")}`} />} />
                      <Area type="monotone" dataKey="einnahmen" stroke="hsl(152, 60%, 42%)" fill="url(#fillEinnahmen)" strokeWidth={2} />
                      <Area type="monotone" dataKey="ausgaben" stroke="hsl(0, 72%, 51%)" fill="url(#fillAusgaben)" strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading font-semibold">Ausgabenverteilung</CardTitle>
                  <CardDescription>Nach Kategorie</CardDescription>
                </CardHeader>
                <CardContent>
                  {expenseCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      Keine Ausgaben vorhanden.
                    </p>
                  ) : (
                    <>
                      <ChartContainer config={Object.fromEntries(expenseCategories.map(c => [c.name, { label: c.name, color: c.color }]))} className="h-[200px] w-full">
                        <PieChart>
                          <Pie
                            data={expenseCategories}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {expenseCategories.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `€ ${Number(value).toLocaleString("de-DE")}`} />} />
                        </PieChart>
                      </ChartContainer>
                      <div className="space-y-2 mt-2">
                        {expenseCategories.map((cat) => (
                          <div key={cat.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: cat.color }} />
                              <span className="text-muted-foreground">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-foreground">€ {cat.value.toLocaleString("de-DE")}</span>
                              <span className="text-xs text-muted-foreground w-10 text-right">
                                {totalExpenseAmount > 0 ? Math.round((cat.value / totalExpenseAmount) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Property Revenue Comparison */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading font-semibold">Einnahmen nach Immobilie</CardTitle>
                  <CardDescription>Aktuelle vs. potenzielle Einnahmen</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={propertyChartConfig} className="h-[280px] w-full">
                    <BarChart data={propertyRevenue} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "hsl(215, 10%, 48%)", fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "hsl(215, 10%, 48%)", fontSize: 11 }} width={130} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => `€ ${Number(value).toLocaleString("de-DE")}`} />} />
                      <Bar dataKey="einnahmen" stackId="a" fill="hsl(215, 60%, 28%)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="potenzial" stackId="a" fill="hsl(215, 60%, 28%)" fillOpacity={0.15} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Rent Collection Rate */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading font-semibold">Mieteingangsquote</CardTitle>
                  <CardDescription>Pünktlichkeit der Mietzahlungen (%)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={collectionChartConfig} className="h-[280px] w-full">
                    <BarChart data={rentCollection} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(215, 10%, 48%)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(215, 10%, 48%)", fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
                      <Bar dataKey="pünktlich" stackId="a" fill="hsl(152, 60%, 42%)" />
                      <Bar dataKey="verspätet" stackId="a" fill="hsl(38, 92%, 55%)" />
                      <Bar dataKey="ausstehend" stackId="a" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Transactions Table */}
            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-heading font-semibold">Letzte Transaktionen</CardTitle>
                    <CardDescription>Alle Ein- und Ausgänge</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tabs value={txFilter} onValueChange={(v) => setTxFilter(v as typeof txFilter)}>
                      <TabsList className="h-8">
                        <TabsTrigger value="alle" className="text-xs px-3 h-7">Alle</TabsTrigger>
                        <TabsTrigger value="einnahme" className="text-xs px-3 h-7">Einnahmen</TabsTrigger>
                        <TabsTrigger value="ausgabe" className="text-xs px-3 h-7">Ausgaben</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {txLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Datum</TableHead>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead>Immobilie</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead className="text-right pr-6">Betrag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Keine Transaktionen gefunden.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((tx) => {
                          const isIncome = tx.type === "EINNAHME";
                          return (
                            <TableRow key={tx.id}>
                              <TableCell className="pl-6 text-muted-foreground">{formatDate(tx.date)}</TableCell>
                              <TableCell className="font-medium text-foreground">{tx.description}</TableCell>
                              <TableCell className="text-muted-foreground">{tx.property?.name ?? "Alle"}</TableCell>
                              <TableCell>
                                <Badge variant={isIncome ? "default" : "destructive"} className="text-xs">
                                  {isIncome ? "Einnahme" : "Ausgabe"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className={`flex items-center justify-end gap-1 font-medium ${isIncome ? "text-success" : "text-destructive"}`}>
                                  {isIncome ? (
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDownRight className="h-3.5 w-3.5" />
                                  )}
                                  € {Math.abs(tx.amount).toLocaleString("de-DE")}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rendite Tab */}
          <TabsContent value="rendite" className="space-y-6 mt-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-heading font-semibold">Rendite-Analyse</h2>
                <p className="text-xs text-muted-foreground">Brutto- und Nettorendite sowie Eigenkapitalrendite pro Immobilie</p>
              </div>
              <Select value={String(roiYear)} onValueChange={(v) => setRoiYear(Number(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ROI KPIs */}
            {roiRes?.data && roiRes.data.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ø Portfolio-Nettorendite</p>
                      <p className="text-xl font-heading font-bold">
                        {roiKpis.portfolioNet !== null ? `${roiKpis.portfolioNet.toFixed(2)} %` : "–"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
                      <Building2 className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bestes Objekt (Netto)</p>
                      <p className="text-xl font-heading font-bold">
                        {roiKpis.best ? `${roiKpis.best.name} (${roiKpis.best.nettorendite?.toFixed(2)} %)` : "–"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading font-semibold">Rendite nach Immobilie</CardTitle>
                <CardDescription>
                  Kaufpreis und Eigenkapital in Immobilie → Bearbeiten eintragen
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!roiRes?.data || roiRes.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">Keine Immobilien vorhanden.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/60">
                        <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Immobilie</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Kaufpreis</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Eigenkapital</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Brutto %</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Netto %</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">EK-Rendite %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roiRes.data.map((p) => (
                        <TableRow key={p.propertyId} className="hover:bg-muted/50 border-border/40">
                          <TableCell className="pl-6 font-medium">{p.name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {p.purchasePrice != null ? formatCurrency(p.purchasePrice) : "–"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {p.equity != null ? formatCurrency(p.equity) : "–"}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.bruttorendite !== null ? (
                              <Badge className={p.bruttorendite >= 0 ? "bg-success/15 text-success border-0" : "bg-destructive/10 text-destructive border-0"}>
                                {p.bruttorendite.toFixed(2)} %
                              </Badge>
                            ) : "–"}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.nettorendite !== null ? (
                              <Badge className={p.nettorendite >= 0 ? "bg-success/15 text-success border-0" : "bg-destructive/10 text-destructive border-0"}>
                                {p.nettorendite.toFixed(2)} %
                              </Badge>
                            ) : "–"}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {p.ekRendite !== null ? (
                              <Badge className={p.ekRendite >= 0 ? "bg-primary/10 text-primary border-0" : "bg-destructive/10 text-destructive border-0"}>
                                {p.ekRendite.toFixed(2)} %
                              </Badge>
                            ) : "–"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wiederkehrende Transaktionen */}
          <TabsContent value="wiederkehrend" className="space-y-4 mt-0">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold">Wiederkehrende Buchungen</h2>
                <p className="text-sm text-muted-foreground">Automatisch generierte Transaktionen nach Zeitplan</p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => { setNewRecurring(EMPTY_RECURRING); setRecurringOpen(true); }}>
                <Plus className="h-4 w-4" />
                Neue Regel
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {!recurringRes || recurringRes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <RefreshCw className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">Noch keine wiederkehrenden Buchungen definiert.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/60">
                        <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beschreibung</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typ</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Betrag</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervall</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Letzter Lauf</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="pr-6" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recurringRes.map((rec) => (
                        <TableRow key={rec.id} className="hover:bg-muted/50 border-border/40">
                          <TableCell className="pl-6 font-medium">
                            {rec.description}
                            {rec.property && <span className="ml-2 text-xs text-muted-foreground">({rec.property.name})</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={rec.type === "EINNAHME" ? "bg-success/15 text-success border-0" : "bg-destructive/10 text-destructive border-0"}>
                              {rec.type === "EINNAHME" ? "Einnahme" : "Ausgabe"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(rec.amount)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {{ MONATLICH: "Monatlich", VIERTELJAEHRLICH: "Vierteljährlich", HALBJAEHRLICH: "Halbjährlich", JAEHRLICH: "Jährlich" }[rec.interval] ?? rec.interval}
                            {" "}(Tag {rec.dayOfMonth})
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {rec.lastRun ? formatDate(rec.lastRun) : "–"}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => updateRecurring.mutate({ id: rec.id, data: { isActive: !rec.isActive } })}
                              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                              {rec.isActive ? (
                                <><ToggleRight className="h-5 w-5 text-success" /><span className="text-success">Aktiv</span></>
                              ) : (
                                <><ToggleLeft className="h-5 w-5" /><span>Inaktiv</span></>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <button
                              onClick={() => deleteRecurring.mutate(rec.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Neue Transaktion Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Neue Transaktion</DialogTitle>
            <DialogDescription>Erfassen Sie eine Einnahme oder Ausgabe.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Beleg scannen */}
            <div className="flex flex-col gap-2">
              <input
                ref={scanInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleScanFile}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={scanPhase !== "idle"}
                onClick={() => scanInputRef.current?.click()}
              >
                {scanPhase !== "idle" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanLine className="h-4 w-4" />
                )}
                {scanPhase !== "idle"
                  ? (scanPhase === "uploading" ? "Wird hochgeladen…" : "KI analysiert…")
                  : "Beleg scannen (KI)"}
              </Button>
              {scanPhase !== "idle" && (
                <div className="space-y-1.5 px-1">
                  <Progress
                    value={scanPhase === "uploading" ? 45 : 90}
                    className="h-1.5"
                  />
                  <p className="text-[10px] text-muted-foreground animate-pulse text-center">
                    {scanPhase === "uploading" ? "Übertragung läuft..." : "Dokument wird von der KI verarbeitet..."}
                  </p>
                </div>
              )}
              {scanInfo && (
                <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
                  ✓ {scanInfo}
                </p>
              )}
            </div>

            <Separator />

            {/* Typ & Datum */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Typ</Label>
                <Select value={newTx.type} onValueChange={(v) => setNewTx((p) => ({ ...p, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUSGABE">Ausgabe</SelectItem>
                    <SelectItem value="EINNAHME">Einnahme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Datum *</Label>
                <Input
                  type="date"
                  value={newTx.date}
                  onChange={(e) => setNewTx((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>

            {/* Beschreibung */}
            <div className="space-y-1.5">
              <Label>Beschreibung *</Label>
              <Input
                placeholder="z.B. Handwerkerrechnung Maler"
                value={newTx.description}
                onChange={(e) => setNewTx((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            {/* Betrag & Kategorie */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Betrag (€) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={newTx.amount}
                  onChange={(e) => setNewTx((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kategorie</Label>
                <Select value={newTx.category} onValueChange={(v) => setNewTx((p) => ({ ...p, category: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Immobilie */}
            <div className="space-y-1.5">
              <Label>Immobilie</Label>
              <Select value={newTx.propertyId} onValueChange={(v) => setNewTx((p) => ({ ...p, propertyId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Immobilien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Alle Immobilien</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={String(prop.id)}>{prop.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createTx.isPending}>
              {createTx.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wiederkehrende Buchung Dialog */}
      <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Wiederkehrende Buchung</DialogTitle>
            <DialogDescription>Automatisch wiederkehrende Einnahme oder Ausgabe einrichten.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Typ *</Label>
                <Select value={newRecurring.type} onValueChange={(v) => setNewRecurring((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EINNAHME">Einnahme</SelectItem>
                    <SelectItem value="AUSGABE">Ausgabe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Betrag (€) *</Label>
                <Input type="number" step="0.01" value={newRecurring.amount} onChange={(e) => setNewRecurring((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung *</Label>
              <Input value={newRecurring.description} onChange={(e) => setNewRecurring((p) => ({ ...p, description: e.target.value }))} placeholder="z.B. Hausmeisterdienst" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Intervall</Label>
                <Select value={newRecurring.interval} onValueChange={(v) => setNewRecurring((p) => ({ ...p, interval: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONATLICH">Monatlich</SelectItem>
                    <SelectItem value="VIERTELJAEHRLICH">Vierteljährlich</SelectItem>
                    <SelectItem value="HALBJAEHRLICH">Halbjährlich</SelectItem>
                    <SelectItem value="JAEHRLICH">Jährlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tag des Monats (1–28)</Label>
                <Input type="number" min="1" max="28" value={newRecurring.dayOfMonth} onChange={(e) => setNewRecurring((p) => ({ ...p, dayOfMonth: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Startdatum *</Label>
                <Input type="date" value={newRecurring.startDate} onChange={(e) => setNewRecurring((p) => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Enddatum (optional)</Label>
                <Input type="date" value={newRecurring.endDate} onChange={(e) => setNewRecurring((p) => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategorie</Label>
                <Select value={newRecurring.category} onValueChange={(v) => setNewRecurring((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Immobilie</Label>
                <Select value={newRecurring.propertyId} onValueChange={(v) => setNewRecurring((p) => ({ ...p, propertyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Alle Immobilien" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Alle Immobilien</SelectItem>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={String(prop.id)}>{prop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateRecurring} disabled={createRecurring.isPending}>
              {createRecurring.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Finances;
