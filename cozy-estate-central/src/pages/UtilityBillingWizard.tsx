import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronRight, Settings, FileText, Send, AlertTriangle, Leaf, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Mock data – in production this comes from the API
const MOCK_TRANSACTIONS = [
  {
    id: 1,
    description: "Stadtwerke Bielefeld",
    amount: -450.0,
    betrkvCategory: "WASSERVERSORGUNG",
    source: "Auto-Match",
    maintenanceWarning: null,
    co2TaxAmount: 0,
  },
  {
    id: 2,
    description: "Schornsteinfeger Müller",
    amount: -180.0,
    betrkvCategory: "SCHORNSTEINREINIGUNG",
    source: "KI-Scan",
    maintenanceWarning: null,
    co2TaxAmount: 0,
  },
  {
    id: 3,
    description: "Aufzug-Service GmbH",
    amount: -2340.0,
    betrkvCategory: "AUFZUG",
    source: "KI-Scan",
    maintenanceWarning: "Pos. 3: Austausch Steuerungsplatine (842 EUR) – nicht umlagefähig gem. §1 BetrKV",
    co2TaxAmount: 0,
  },
  {
    id: 4,
    description: "EnBW Gasrechnung",
    amount: -3200.0,
    betrkvCategory: "HEIZUNG",
    source: "Auto-Match",
    maintenanceWarning: null,
    co2TaxAmount: 245.60,
  },
];

const MOCK_CO2_INFO = {
  energyClass: "E",
  co2Emissions: 38.5,
  landlordPercentage: 60,
  landlordShare: 147.36,
  tenantShare: 98.24,
};

const MOCK_VACANCY = {
  hasVacancy: true,
  vacancyDays: 92,
  ownerCost: 1845.20,
  unit: "Einheit 3B",
};

const MOCK_DISPUTES = [
  {
    id: 1,
    tenant: "Müller, Hans",
    reason: "Gartenpflege: Kosten erscheinen zu hoch (Vergleich mit Vorjahr +40%)",
    status: "OPEN",
    amount: 185.40,
    createdAt: "2025-02-14",
  },
  {
    id: 2,
    tenant: "Schmidt, Petra",
    reason: "Aufzugskosten: Enthält vermutlich Reparaturanteil",
    status: "OPEN",
    amount: 420.00,
    createdAt: "2025-02-18",
  },
];

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export default function UtilityBillingWizard() {
  const [activeTab, setActiveTab] = useState("config");
  const { toast } = useToast();

  const handleNext = (nextTab: string) => {
    setActiveTab(nextTab);
  };

  const handleGenerate = () => {
    toast({
      title: "Nebenkostenabrechnung gestartet",
      description: "Die Abrechnungen werden im Hintergrund generiert und als PDF an die Mieter gesendet.",
    });
  };

  const warningCount = MOCK_TRANSACTIONS.filter((t) => t.maintenanceWarning).length;

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
            {MOCK_DISPUTES.length > 0 && (
              <Badge variant="outline" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] border-amber-500 text-amber-600">
                {MOCK_DISPUTES.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Konfiguration ─── */}
        <TabsContent value="config">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Umlageschlüssel & Stammdaten</CardTitle>
                <CardDescription>
                  Definieren Sie hier, nach welchem Schlüssel die gesetzlichen Kostenarten (BetrKV) umgelegt werden sollen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-md p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="font-medium">Grundsteuer</div>
                    <div>Wohnfläche (Standard)</div>
                    <div className="font-medium">Wasserversorgung</div>
                    <div>Verbrauch (Zähler)</div>
                    <div className="font-medium">Heizung (Grundkosten)</div>
                    <div>Wohnfläche 30% / Verbrauch 70%</div>
                    <div className="font-medium">Müllabfuhr</div>
                    <div>Personenanzahl</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CO2 Stufenmodell Info */}
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
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{MOCK_CO2_INFO.energyClass}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">CO₂ kg/m²/a</p>
                    <p className="text-2xl font-bold">{MOCK_CO2_INFO.co2Emissions}</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Vermieter-Anteil</p>
                    <p className="text-lg font-bold text-red-600">{MOCK_CO2_INFO.landlordPercentage}% = {formatEur(MOCK_CO2_INFO.landlordShare)}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Mieter-Anteil</p>
                    <p className="text-lg font-bold text-blue-600">{formatEur(MOCK_CO2_INFO.tenantShare)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leerstands-Warnung */}
            {MOCK_VACANCY.hasVacancy && (
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
                      <strong>{MOCK_VACANCY.unit}</strong> war <strong>{MOCK_VACANCY.vacancyDays} Tage</strong> im Abrechnungszeitraum unvermietet.
                    </p>
                    <p className="mt-2">
                      Die anteiligen Fixkosten von <strong>{formatEur(MOCK_VACANCY.ownerCost)}</strong> werden automatisch dem Eigentümer zugeordnet und <em>nicht</em> auf die übrigen Mieter umgelegt.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end mt-6">
              <Button onClick={() => handleNext("validation")}>
                Weiter zur Kosten-Validierung
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
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
              {MOCK_TRANSACTIONS.map((tx) => (
                <div key={tx.id} className="space-y-0">
                  <div className={`flex justify-between items-center p-3 rounded-lg border ${tx.maintenanceWarning ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div>
                        <span className="font-medium">{tx.description}</span>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{tx.betrkvCategory}</Badge>
                          <Badge variant="outline" className="text-xs">{tx.source}</Badge>
                          {tx.co2TaxAmount > 0 && (
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

                  {/* ── Reparatur-Warnung (KI-Filter) ── */}
                  {tx.maintenanceWarning && (
                    <div className="flex items-start gap-3 p-3 mx-2 -mt-1 bg-amber-100 dark:bg-amber-950/40 border border-t-0 border-amber-300 dark:border-amber-800 rounded-b-lg text-sm text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-semibold">⚠ KI-Warnung: Nicht-umlagefähige Reparaturkosten erkannt</p>
                        <p className="mt-1">{tx.maintenanceWarning}</p>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400">
                            Betrag aufteilen
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground">
                            Ignorieren
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => handleNext("config")}>
                  Zurück
                </Button>
                <Button onClick={() => handleNext("generation")}>
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
                Erstellen Sie die rechtssicheren PDF-Abrechnungen für alle Mieter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-md p-4 bg-slate-50 dark:bg-slate-900 text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Bereit zur Generierung</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  Es wurden 12 Einheiten und 145 freigegebene Buchungen gefunden. Die PDFs werden im Hintergrund via pdfkit generiert.
                </p>
                <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span>✓ CO₂-Aufteilung berechnet</span>
                  <span>✓ Leerstand berücksichtigt</span>
                  <span>✓ Reparaturen ausgeschlossen</span>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => handleNext("validation")}>
                  Zurück
                </Button>
                <Button onClick={handleGenerate} size="lg" className="bg-green-600 hover:bg-green-700">
                  <Send className="w-4 h-4 mr-2" />
                  PDFs Generieren & Archivieren
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
              {MOCK_DISPUTES.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
                  <p>Keine offenen Widersprüche. Alles erledigt!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {MOCK_DISPUTES.map((d) => (
                    <div key={d.id} className="border rounded-lg p-4 bg-white dark:bg-slate-800 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{d.tenant}</p>
                          <p className="text-sm text-muted-foreground mt-1">{d.reason}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="border-amber-500 text-amber-600">{d.status}</Badge>
                          <p className="text-sm font-bold mt-1">{formatEur(d.amount)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Eingereicht am {d.createdAt}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            Originalbeleg ansehen
                          </Button>
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">
                            Widerspruch bearbeiten
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
