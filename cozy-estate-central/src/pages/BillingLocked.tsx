import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, clearToken } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Building2, CheckCircle2 } from "lucide-react";

const PLANS = [
  {
    key: "PRO" as const,
    name: "Pro",
    price: "49 €",
    features: [
      "Bis zu 50 Einheiten",
      "Alle Grundfunktionen",
      "E-Mail Support",
      "Mieter-Portal",
    ],
  },
  {
    key: "BUSINESS" as const,
    name: "Business",
    price: "99 €",
    features: [
      "Unbegrenzte Einheiten",
      "Alle Pro-Funktionen",
      "Priorität-Support",
      "DATEV Export",
      "API-Zugang",
    ],
  },
];

function getReason(): string {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason");
  if (reason === "past_due") return "Zahlung fehlgeschlagen";
  if (reason === "canceled") return "Abo gekündigt";
  return "Trial abgelaufen";
}

export default function BillingLocked() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const reason = getReason();

  async function handleUpgrade(plan: "PRO" | "BUSINESS") {
    setLoading(plan);
    try {
      const res = await api<{ data: { url: string } }>("/billing/checkout", {
        method: "POST",
        body: { plan },
      });
      window.location.href = res.data.url;
    } catch {
      setLoading(null);
    }
  }

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-100 p-4">
              <AlertCircle className="h-10 w-10 text-amber-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Zugang gesperrt</h1>
          <p className="text-gray-500 text-lg">{reason} — Bitte wählen Sie einen Plan, um fortzufahren.</p>
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">ImmoVerwalt</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {PLANS.map((plan) => (
            <Card key={plan.key} className={plan.key === "BUSINESS" ? "border-blue-500 border-2" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.key === "BUSINESS" && (
                    <Badge className="bg-blue-600 text-white">Empfohlen</Badge>
                  )}
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {plan.price}<span className="text-base font-normal text-gray-500">/Monat</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.key === "BUSINESS" ? "default" : "outline"}
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={!!loading}
                >
                  {loading === plan.key ? "Wird geladen..." : `${plan.name} abonnieren`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Logout */}
        <div className="text-center">
          <Button variant="ghost" className="text-gray-400" onClick={handleLogout}>
            Abmelden
          </Button>
        </div>
      </div>
    </div>
  );
}
