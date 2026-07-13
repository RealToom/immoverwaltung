import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronRight, Settings, Send, AlertTriangle, Leaf, Building2, Flame, Download, Plus, X, CalendarClock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useProperties } from "@/hooks/api/useProperties";
import { useGenerateUtilityStatement, useUtilityDisputes, useUpdateDisputeStatus, useFinalizeStatement, useStatementDeadlines, useSetDistributionKeys } from "@/hooks/api/useUtilityBilling";
import type { UtilityStatementTransaction, FinalizedStatementItem } from "@/hooks/api/useUtilityBilling";
import { useUpdateTransaction } from "@/hooks/api/useFinance";
import { useDownloadDocument } from "@/hooks/api/useDocuments";
import { BETRKV_LABELS, mapBetrkvCategory, mapDisputeStatus, DISTRIBUTION_KEY_LABELS } from "@/lib/mappings";

const BETRKV_CATEGORIES = Object.keys(BETRKV_LABELS);

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export default function UtilityBillingWizard() {
  const [activeTab, setActiveTab] = useState("config");
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const { toast } = useToast();

  const { data: propertiesRes } = useProperties();
  const properties = propertiesRes?.data ?? [];
  const generateStatement = useGenerateUtilityStatement();
  const updateTransaction = useUpdateTransaction();
  const statement = generateStatement.data?.data ?? null;
  const { data: disputesRes } = useUtilityDisputes("OFFEN");
  const disputes = disputesRes?.data ?? [];
  const updateDisputeStatus = useUpdateDisputeStatus();
  const finalizeStatement = useFinalizeStatement();
  const downloadDocument = useDownloadDocument();
  const { data: deadlinesRes } = useStatementDeadlines();
  const deadlines = deadlinesRes?.data ?? [];
  const setDistributionKeys = useSetDistributionKeys();
  const [finalizedItems, setFinalizedItems] = useState<FinalizedStatementItem[] | null>(null);

  const regenerate = () => {
    if (propertyId) generateStatement.mutate({ propertyId, year });
  };

  const handleGenerate = () => {
    if (!propertyId) {
      toast({ title: "Bitte zuerst eine Immobilie auswählen", variant: "destructive" });
      return;
    }
    setFinalizedItems(null);
    generateStatement.mutate(
      { propertyId, year },
      {
        onSuccess: () => setActiveTab("validation"),
        onError: (err: unknown) =>
          toast({ title: "Berechnung fehlgeschlagen", description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleTagUpdate = (tx: UtilityStatementTransaction, field: "betrkvCategory" | "co2TaxAmount", value: string) => {
    if (field === "co2TaxAmount" && (Number(value) || 0) === (tx.co2TaxAmount ?? 0)) return;
    const data = field === "co2TaxAmount" ? { co2TaxAmount: Number(value) || 0 } : { betrkvCategory: value };
    updateTransaction.mutate({ id: tx.id, data }, { onSuccess: regenerate });
  };

  const handleAllocatableToggle = (txId: number, allocatable: boolean) => {
    updateTransaction.mutate({ id: txId, data: { allocatable } }, { onSuccess: regenerate });
  };

  const handleKeyChange = (category: string, key: string) => {
    if (!propertyId || !statement) return;
    const costConfiguration = { ...statement.distributionKeys, [category]: key };
    setDistributionKeys.mutate({ propertyId, costConfiguration }, { onSuccess: regenerate });
  };

  const handleFinalize = () => {
    if (!propertyId) return;
    finalizeStatement.mutate(
      { propertyId, year },
      {
        onSuccess: (res) => {
          setFinalizedItems(res.data.items);
          toast({ title: "Abrechnungen erstellt", description: `${res.data.generatedCount} Abrechnungen im Mieter-Portal hinterlegt.` });
        },
        onError: (err: unknown) =>
          toast({ title: "Erstellung fehlgeschlagen", description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleDownload = (item: FinalizedStatementItem) => {
    if (!item.documentId) return;
    downloadDocument.mutate({
      docId: item.documentId,
      docName: `Nebenkostenabrechnung_${year}_${item.tenantName.replace(/\s+/g, "_")}.pdf`,
    });
  };

  const warningCount = statement?.transactions.filter((t) => t.maintenanceWarning).length ?? 0;
  const unallocated = statement?.unallocatedTransactions ?? [];

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nebenkosten-Assistent</h1>
          <p className="text-muted-foreground mt-1">
            Geführter Prozess zur rechtssicheren Erstellung der Betriebskostenabrechnung.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            1. Konfiguration
          </TabsTrigger>
          <TabsTrigger value="validation" className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            2. Kosten prüfen
            {warningCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {warningCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="generation" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            3. Generierung
          </TabsTrigger>
          <TabsTrigger value="disputes" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            4. Widersprüche
            {disputes.length > 0 && (
              <Badge variant="outline" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] border-amber-500 text-amber-600">
                {disputes.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Konfiguration ─── */}
        <TabsContent value="config">
          <div className="space-y-4">
            {deadlines.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-900">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <CalendarClock className="w-5 h-5" />
                    Offene Abrechnungsfristen (§ 556 Abs. 3 BGB)
                  </CardTitle>
                  <CardDescription>
                    Die Betriebskostenabrechnung muss dem Mieter binnen 12 Monaten nach Ende des Abrechnungszeitraums zugehen —
                    danach sind Nachforderungen ausgeschlossen.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {deadlines.map((d) => (
                    <div
                      key={`${d.propertyId}-${d.year}`}
                      className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                        d.overdue
                          ? "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800"
                          : d.daysRemaining <= 60
                          ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div>
                        <span className="font-medium">{d.propertyName}</span>
                        <span className="text-muted-foreground ml-2">Abrechnung {d.year}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          Frist: {new Date(d.deadline).toLocaleDateString("de-DE")}
                        </span>
                        {d.overdue ? (
                          <Badge variant="destructive">Frist überschritten</Badge>
                        ) : (
                          <Badge variant="outline" className={d.daysRemaining <= 60 ? "border-amber-500 text-amber-600" : ""}>
                            noch {d.daysRemaining} Tage
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setPropertyId(d.propertyId);
                            setYear(d.year);
                          }}
                        >
                          Jetzt abrechnen
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Immobilie & Abrechnungsjahr</CardTitle>
                <CardDescription>
                  Wählen Sie die Immobilie und das Abrechnungsjahr, für das die Nebenkosten berechnet werden sollen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Select value={propertyId ? String(propertyId) : undefined} onValueChange={(v) => setPropertyId(Number(v))}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Immobilie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((offset) => {
                        const y = new Date().getFullYear() - 1 - offset;
                        return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleGenerate} disabled={generateStatement.isPending}>
                    {generateStatement.isPending ? "Berechne..." : "Kosten berechnen"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {statement && (
              <>
                <Card className="border-green-200 dark:border-green-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Leaf className="w-5 h-5" />
                      CO₂-Kostenaufteilung (Stufenmodell)
                    </CardTitle>
                    <CardDescription>
                      Automatische Berechnung gem. CO2KostAufG basierend auf dem Energieausweis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Energieklasse</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">{statement.co2.energyClass ?? "–"}</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">CO₂ kg/m²/a</p>
                        <p className="text-2xl font-bold">{statement.co2.co2Emissions ?? "–"}</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Vermieter-Anteil</p>
                        <p className="text-lg font-bold text-red-600">{statement.co2.landlordPercentage}% = {formatEur(statement.co2.landlordShare)}</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Mieter-Anteil</p>
                        <p className="text-lg font-bold text-blue-600">{formatEur(statement.co2.tenantShare)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {statement.heating && (
                  <Card className={statement.heating.consumptionBased ? "border-blue-200 dark:border-blue-900" : "border-amber-200 dark:border-amber-900"}>
                    <CardHeader className="pb-3">
                      <CardTitle className={`flex items-center gap-2 ${statement.heating.consumptionBased ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"}`}>
                        <Flame className="w-5 h-5" />
                        Heizkostenverteilung (HeizkostenV)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p>
                        Heiz-/Warmwasserkosten: <strong>{formatEur(statement.heating.totalCosts)}</strong>
                      </p>
                      {statement.heating.warmWater && (
                        <p className="text-blue-800 dark:text-blue-300">
                          Davon Warmwasser (§ 9 HeizkostenV, getrennt erfasst): <strong>{formatEur(statement.heating.warmWater.totalCosts)}</strong>
                          {" — "}
                          {statement.heating.warmWater.consumptionBased
                            ? "verbrauchsabhängig über Warmwasserzähler"
                            : "mangels Warmwasserzähler nach Wohnfläche verteilt"}.
                        </p>
                      )}
                      {statement.heating.estimated && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-amber-900 dark:text-amber-200">
                          <p className="font-semibold">ℹ Verbrauchsschätzung (§ 9b HeizkostenV)</p>
                          <p className="mt-1">{statement.heating.estimationNotice}</p>
                        </div>
                      )}
                      {statement.heating.consumptionBased ? (
                        <p className="text-blue-800 dark:text-blue-300">
                          Verteilung: <strong>{statement.heating.consumptionSharePercent} % nach gemessenem Verbrauch</strong> (Wärme-/Gaszähler),{" "}
                          {100 - (statement.heating.consumptionSharePercent ?? 70)} % als Grundkosten nach Wohnfläche — konform zu § 7 HeizkostenV.
                          {statement.heating.ownerShare > 0 && (
                            <> Auf Leerstand entfallende Grundkosten: {formatEur(statement.heating.ownerShare)} (Eigentümer).</>
                          )}
                        </p>
                      ) : (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-amber-900 dark:text-amber-200">
                          <p className="font-semibold">⚠ Keine Verbrauchsdaten — Verteilung nach Wohnfläche</p>
                          <p className="mt-1">{statement.heating.warning}</p>
                          <p className="mt-1 text-xs">
                            Tipp: Legen Sie pro Einheit einen Wärme- oder Gaszähler mit mindestens zwei Ablesungen im Abrechnungsjahr an.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {statement.vacancy && (
                  <Card className="border-amber-200 dark:border-amber-900">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Building2 className="w-5 h-5" />
                        Leerstand erkannt
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm">
                        <p>
                          <strong>{statement.vacancy.affectedUnits.join(", ")}</strong> war insgesamt <strong>{statement.vacancy.vacancyDays} Tage</strong> im Abrechnungszeitraum unvermietet.
                        </p>
                        <p className="mt-2">
                          Die anteiligen Fixkosten von <strong>{formatEur(statement.vacancy.amount)}</strong> (flächengewichtet) werden automatisch dem Eigentümer zugeordnet und <em>nicht</em> auf die übrigen Mieter umgelegt.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {statement.vorwegabzug && (
                  <Card className="border-indigo-200 dark:border-indigo-900">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                        <Building2 className="w-5 h-5" />
                        Vorwegabzug Gewerbe (§ 556a BGB)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p>
                        Gewerbeeinheiten (<strong>{statement.vorwegabzug.commercialUnits.join(", ")}</strong>) tragen{" "}
                        <strong>{formatEur(statement.vorwegabzug.commercialCosts)}</strong> ({statement.vorwegabzug.sharePercent} % der Gesamtkosten).
                        Dieser Anteil wird vorweg abgezogen — Wohnraummieter tragen nur den Wohnanteil.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end mt-6">
                  <Button onClick={() => setActiveTab("validation")}>
                    Weiter zur Kosten-Prüfung
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ─── Tab 2: Kosten prüfen ─── */}
        <TabsContent value="validation">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Umlagefähige Kosten</CardTitle>
                <CardDescription>
                  Diese Buchungen fließen in die Abrechnung ein. Ordnen Sie jeder Position eine BetrKV-Kategorie zu
                  und erfassen Sie ggf. den enthaltenen CO₂-Steueranteil.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!statement || statement.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {statement ? "Keine umlagefähigen Buchungen für dieses Jahr." : "Bitte zuerst in Schritt 1 die Kosten berechnen."}
                  </p>
                ) : (
                  statement.transactions.map((tx) => (
                    <div key={tx.id} className="space-y-0">
                      <div className={`flex justify-between items-center p-3 rounded-lg border ${tx.maintenanceWarning ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                        <div className="flex items-center gap-3 flex-1">
                          <div>
                            <span className="font-medium">{tx.description}</span>
                            <div className="flex gap-2 mt-1 items-center">
                              <Select value={tx.betrkvCategory ?? undefined} onValueChange={(v) => handleTagUpdate(tx, "betrkvCategory", v)}>
                                <SelectTrigger className="h-7 text-xs w-[220px]">
                                  <SelectValue placeholder="BetrKV-Kategorie" />
                                </SelectTrigger>
                                <SelectContent>
                                  {BETRKV_CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>{mapBetrkvCategory(c)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="CO₂-Steuer €"
                                defaultValue={tx.co2TaxAmount ?? ""}
                                onBlur={(e) => handleTagUpdate(tx, "co2TaxAmount", e.target.value)}
                                className="h-7 w-28 text-xs rounded border border-input px-2"
                              />
                              {tx.betrkvCategory && (
                                <Select
                                  value={statement?.distributionKeys?.[tx.betrkvCategory] ?? "WOHNFLAECHE"}
                                  onValueChange={(v) => handleKeyChange(tx.betrkvCategory!, v)}
                                >
                                  <SelectTrigger className="h-7 text-xs w-[150px]" title="Verteilerschlüssel">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(DISTRIBUTION_KEY_LABELS).map(([k, label]) => (
                                      <SelectItem key={k} value={k}>{label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {tx.co2TaxAmount != null && tx.co2TaxAmount > 0 && (
                                <Badge className="text-xs bg-green-100 text-green-800 border-green-300">
                                  <Leaf className="w-3 h-3 mr-1" />
                                  CO₂: {formatEur(tx.co2TaxAmount)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-right">{formatEur(Math.abs(tx.amount))}</div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            title="Aus der Abrechnung entfernen (nicht umlagefähig)"
                            onClick={() => handleAllocatableToggle(tx.id, false)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {tx.maintenanceWarning && (
                        <div className="flex items-start gap-3 p-3 mx-2 -mt-1 bg-amber-100 dark:bg-amber-950/40 border border-t-0 border-amber-300 dark:border-amber-800 rounded-b-lg text-sm text-amber-900 dark:text-amber-200">
                          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                          <div>
                            <p className="font-semibold">⚠ KI-Warnung: Nicht-umlagefähige Reparaturkosten erkannt</p>
                            <p className="mt-1">{tx.maintenanceWarning}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {statement && unallocated.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Weitere Ausgaben dieses Jahres (nicht umlagefähig markiert)</CardTitle>
                  <CardDescription>
                    Prüfen Sie, ob Positionen fehlen — mit einem Klick übernehmen Sie sie in die Abrechnung.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {unallocated.map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm">
                      <div>
                        <span className="font-medium">{tx.description}</span>
                        {tx.category && <span className="text-muted-foreground ml-2">({tx.category})</span>}
                        <span className="text-muted-foreground ml-2">{new Date(tx.date).toLocaleDateString("de-DE")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatEur(Math.abs(tx.amount))}</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAllocatableToggle(tx.id, true)}>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Umlagefähig
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setActiveTab("config")}>
                Zurück
              </Button>
              <Button onClick={() => setActiveTab("generation")}>
                Weiter zur Generierung
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ─── Tab 3: Generierung ─── */}
        <TabsContent value="generation">
          <Card>
            <CardHeader>
              <CardTitle>Massen-Generierung</CardTitle>
              <CardDescription>
                Übersicht der berechneten Beträge pro Mieter. Mit "Abrechnungen erstellen" werden die PDF-Abrechnungen
                erzeugt und im Mieter-Portal hinterlegt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!statement || statement.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bitte zuerst in Schritt 1 die Kosten berechnen.</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="text-left p-3 font-medium">Mieter</th>
                        <th className="text-left p-3 font-medium">Einheit</th>
                        <th className="text-right p-3 font-medium">Kostenanteil</th>
                        <th className="text-right p-3 font-medium">Vorauszahlungen</th>
                        {(statement?.totalLaborCosts ?? 0) > 0 && (
                          <th className="text-right p-3 font-medium" title="§ 35a EStG absetzbare Lohnkosten">§ 35a</th>
                        )}
                        <th className="text-right p-3 font-medium">Saldo</th>
                        {finalizedItems && <th className="text-right p-3 font-medium">PDF</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(finalizedItems ?? statement.items).map((item) => (
                        <tr key={item.contractId} className="border-t">
                          <td className="p-3">{item.tenantName}</td>
                          <td className="p-3">{item.unitNumber}</td>
                          <td className="p-3 text-right font-medium">{formatEur(item.amount)}</td>
                          <td className="p-3 text-right">{formatEur(item.totalPrepaid)}</td>
                          {(statement?.totalLaborCosts ?? 0) > 0 && (
                            <td className="p-3 text-right text-muted-foreground">{formatEur(item.laborCostShare)}</td>
                          )}
                          <td className={`p-3 text-right font-medium ${item.isRefund ? "text-green-600" : "text-red-600"}`}>
                            {item.isRefund ? "+" : "−"}{formatEur(Math.abs(item.balance))}
                          </td>
                          {finalizedItems && (
                            <td className="p-3 text-right">
                              {"documentId" in item && item.documentId ? (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDownload(item as FinalizedStatementItem)}>
                                  <Download className="w-3.5 h-3.5 mr-1" />
                                  PDF
                                </Button>
                              ) : (
                                "–"
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {finalizedItems && (
                <div className="border border-green-200 dark:border-green-900 rounded-md p-4 bg-green-50 dark:bg-green-950/30 text-sm text-green-800 dark:text-green-300">
                  {finalizedItems.length} Abrechnungen erstellt und im Mieter-Portal hinterlegt.
                </div>
              )}

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setActiveTab("validation")}>
                  Zurück
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={!statement || statement.items.length === 0 || finalizeStatement.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {finalizeStatement.isPending ? "Erstelle..." : "Abrechnungen erstellen & im Mieter-Portal bereitstellen"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 4: Widersprüche ─── */}
        <TabsContent value="disputes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Offene Abrechnungs-Widersprüche
              </CardTitle>
              <CardDescription>
                Über das Mieter-Portal eingereichte Einwendungen gegen die Abrechnung. Bitte prüfen und beantworten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {disputes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
                  <p>Keine offenen Widersprüche. Alles erledigt!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div key={d.id} className="border rounded-lg p-4 bg-white dark:bg-slate-800 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            {d.contract.tenant.name}
                            {d.year != null && <span className="text-muted-foreground font-normal"> — Abrechnung {d.year}</span>}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{d.reason}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="border-amber-500 text-amber-600">{mapDisputeStatus(d.status)}</Badge>
                          {d.amount != null && <p className="text-sm font-bold mt-1">{formatEur(d.amount)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          Eingereicht am {new Date(d.createdAt).toLocaleDateString("de-DE")}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateDisputeStatus.mutate({ id: d.id, status: "IN_BEARBEITUNG" })}
                          >
                            In Bearbeitung
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateDisputeStatus.mutate({ id: d.id, status: "ABGELEHNT" })}
                          >
                            Ablehnen
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => updateDisputeStatus.mutate({ id: d.id, status: "GELOEST" })}
                          >
                            Als gelöst markieren
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
