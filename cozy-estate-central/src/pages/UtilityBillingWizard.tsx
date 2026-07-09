import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronRight, Settings, FileText, Send, AlertTriangle, Leaf, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useProperties } from "@/hooks/api/useProperties";
import { useGenerateUtilityStatement, useUtilityDisputes, useUpdateDisputeStatus } from "@/hooks/api/useUtilityBilling";
import type { UtilityStatementTransaction } from "@/hooks/api/useUtilityBilling";
import { useUpdateTransaction } from "@/hooks/api/useFinance";

const BETRKV_CATEGORIES = [
  "GRUNDSTEUER", "WASSERVERSORGUNG", "ENTWAESSERUNG", "AUFZUG",
  "STRASSENREINIGUNG_MUELL", "GEBAEUDE_REINIGUNG", "GARTENPFLEGE",
  "BELEUCHTUNG", "SCHORNSTEINREINIGUNG", "VERSICHERUNGEN", "HAUSWART",
  "GEMEINSCHAFTS_ANTENNE", "WASCHRAUM", "SONSTIGE_KOSTEN",
];

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
  const { data: disputesRes } = useUtilityDisputes("OPEN");
  const disputes = disputesRes?.data ?? [];
  const updateDisputeStatus = useUpdateDisputeStatus();

  const handleGenerate = () => {
    if (!propertyId) {
      toast({ title: "Bitte zuerst eine Immobilie auswählen", variant: "destructive" });
      return;
    }
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
    const data = field === "co2TaxAmount" ? { co2TaxAmount: Number(value) || 0 } : { betrkvCategory: value };
    updateTransaction.mutate(
      { id: tx.id, data },
      {
        onSuccess: () => {
          if (propertyId) generateStatement.mutate({ propertyId, year });
        },
      }
    );
  };

  const warningCount = statement?.transactions.filter((t) => t.maintenanceWarning).length ?? 0;

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
            2. Validierung
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
                          Die anteiligen Fixkosten von <strong>{formatEur(statement.vacancy.amount)}</strong> werden automatisch dem Eigentümer zugeordnet und <em>nicht</em> auf die übrigen Mieter umgelegt.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end mt-6">
                  <Button onClick={() => setActiveTab("validation")}>
                    Weiter zur Kosten-Validierung
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ─── Tab 2: Validierung ─── */}
        <TabsContent value="validation">
          <Card>
            <CardHeader>
              <CardTitle>Validierung der Belege & Kosten</CardTitle>
              <CardDescription>
                Überprüfen Sie die vorklassifizierten Buchungen (KI/PSD2). Nur freigegebene Kosten fließen in die Abrechnung ein.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!statement || statement.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bitte zuerst in Schritt 1 die Kosten berechnen.</p>
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
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
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
                            {tx.co2TaxAmount != null && tx.co2TaxAmount > 0 && (
                              <Badge className="text-xs bg-green-100 text-green-800 border-green-300">
                                <Leaf className="w-3 h-3 mr-1" />
                                CO₂: {formatEur(tx.co2TaxAmount)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="font-bold text-right">{formatEur(tx.amount)}</div>
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

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setActiveTab("config")}>
                  Zurück
                </Button>
                <Button onClick={() => setActiveTab("generation")}>
                  Weiter zur Generierung
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Generierung ─── */}
        <TabsContent value="generation">
          <Card>
            <CardHeader>
              <CardTitle>Massen-Generierung</CardTitle>
              <CardDescription>
                Der Export der neuen, erweiterten Abrechnung (CO₂/Leerstand-bereinigt) als PDF ist noch nicht Teil dieses Assistenten — nutzen Sie bis dahin den bestehenden PDF-Export unter Finanzen &gt; Nebenkostenabrechnung.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statement && (
                <div className="border rounded-md p-4 bg-slate-50 dark:bg-slate-900 text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Berechnung abgeschlossen</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    {statement.items.length} Vertrag/Verträge und {statement.transactions.length} freigegebene Buchungen berücksichtigt.
                  </p>
                </div>
              )}
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setActiveTab("validation")}>
                  Zurück
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
                Mieter haben über das Mieter-Portal „Zahlung unter Vorbehalt" gewählt. Bitte prüfen und beantworten.
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
                          <p className="font-semibold">{d.contract.tenant.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">{d.reason}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="border-amber-500 text-amber-600">{d.status}</Badge>
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
