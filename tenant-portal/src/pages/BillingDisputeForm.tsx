import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, ShieldAlert, CreditCard } from "lucide-react";
import { toast } from "sonner";

const BETRKV_CATEGORIES = [
  "Grundsteuer",
  "Wasserversorgung",
  "Entwässerung",
  "Aufzug",
  "Straßenreinigung & Müll",
  "Gebäudereinigung",
  "Gartenpflege",
  "Beleuchtung",
  "Schornsteinreinigung",
  "Versicherungen",
  "Hauswart",
  "Gemeinschaftsantenne",
  "Waschraum",
  "Heizung (Grundkosten)",
  "Heizung (Verbrauchskosten)",
  "Sonstige Kosten",
];

interface Props {
  billingYear?: number;
  totalBalance?: number;
}

export default function BillingDisputeForm({ billingYear = 2024, totalBalance = -185.40 }: Props) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0 || !reason.trim()) {
      toast.error("Bitte wähle mindestens eine Kostenart und gib eine Begründung ein.");
      return;
    }
    setIsSubmitting(true);
    // Mock API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      toast.success("Widerspruch erfolgreich eingereicht");
    }, 1000);
  };

  function formatEur(n: number) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
  }

  if (submitted) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex flex-col items-center justify-center space-y-4 py-16">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-center">Widerspruch eingereicht</h2>
          <p className="text-muted-foreground text-center max-w-sm text-sm">
            Dein Widerspruch wurde erfolgreich an die Hausverwaltung übermittelt.
            Du zahlst den strittigen Betrag vorerst <strong>unter Vorbehalt</strong>.
            Die Verwaltung hat 12 Monate Zeit, dir eine Stellungnahme zu senden.
          </p>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 max-w-sm">
            <p className="font-semibold">Dein Widerspruch umfasst:</p>
            <ul className="mt-2 space-y-1">
              {selectedCategories.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Nebenkostenabrechnung {billingYear}</h1>
        <p className="text-sm text-muted-foreground">
          Deine Abrechnung ist bereit. Du kannst akzeptieren oder Widerspruch einlegen.
        </p>
      </div>

      {/* Ergebnis-Karte */}
      <Card className={totalBalance < 0 ? "border-red-200 dark:border-red-900" : "border-green-200 dark:border-green-900"}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {totalBalance < 0 ? "Nachzahlung" : "Guthaben"}
              </p>
              <p className={`text-3xl font-bold ${totalBalance < 0 ? "text-red-600" : "text-green-600"}`}>
                {formatEur(Math.abs(totalBalance))}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${totalBalance < 0 ? "bg-red-100" : "bg-green-100"}`}>
              <CreditCard className={`w-6 h-6 ${totalBalance < 0 ? "text-red-600" : "text-green-600"}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aktions-Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="bg-green-600 hover:bg-green-700 h-auto py-4 flex flex-col gap-1"
          onClick={() => toast.success("Abrechnung akzeptiert")}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs">Akzeptieren & Bezahlen</span>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="border-amber-400 text-amber-700 hover:bg-amber-50 h-auto py-4 flex flex-col gap-1"
          onClick={() => {
            const el = document.getElementById("dispute-form");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="text-xs">Widerspruch einlegen</span>
        </Button>
      </div>

      {/* Widerspruchs-Formular */}
      <Card id="dispute-form" className="border-amber-200 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            Widerspruch – Zahlung unter Vorbehalt
          </CardTitle>
          <CardDescription>
            Wähle die Kostenart(en), die du beanstandest, und begründe deinen Widerspruch. Die Hausverwaltung wird benachrichtigt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="font-semibold">Betroffene Kostenart(en) auswählen:</Label>
              <div className="grid grid-cols-2 gap-2">
                {BETRKV_CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`text-left text-xs p-2 rounded-lg border transition-colors ${
                      selectedCategories.includes(cat)
                        ? "bg-amber-100 border-amber-400 text-amber-900 font-medium dark:bg-amber-950 dark:text-amber-200"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {selectedCategories.includes(cat) && "✓ "}{cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="font-semibold">Begründung</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="z.B. Die Gartenpflegekosten sind im Vergleich zum Vorjahr um 40% gestiegen. Bitte um Nachweis der Einzelpositionen."
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                Tipp: Je konkreter deine Begründung, desto schneller kann die Verwaltung antworten.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700"
              disabled={selectedCategories.length === 0 || !reason.trim() || isSubmitting}
            >
              {isSubmitting ? "Wird gesendet..." : "Widerspruch verbindlich einreichen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
