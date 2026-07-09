import { useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldAlert, CreditCard } from "lucide-react";
import { useTenantUtility } from "@/hooks/api/useTenantUtility";
import { useCreateDispute } from "@/hooks/api/useTenantDisputes";

const BETRKV_CATEGORIES = [
  "Grundsteuer", "Wasserversorgung", "Entwässerung", "Aufzug",
  "Straßenreinigung & Müll", "Gebäudereinigung", "Gartenpflege",
  "Beleuchtung", "Schornsteinreinigung", "Versicherungen", "Hauswart",
  "Gemeinschaftsantenne", "Waschraum", "Sonstige Kosten",
];

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export default function BillingDisputeForm() {
  const { slug } = useParams<{ slug: string }>();
  const { data: utility } = useTenantUtility(slug!);
  const createDispute = useCreateDispute(slug!);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedCategories.length === 0 || !reason.trim()) {
      setError("Bitte wähle mindestens eine Kostenart und gib eine Begründung ein.");
      return;
    }
    const fullReason = `Kostenart(en): ${selectedCategories.join(", ")}. Begründung: ${reason.trim()}`;
    try {
      await createDispute.mutateAsync({
        reason: fullReason,
        amount: utility ? Math.abs(utility.balance) : undefined,
      });
      setSubmitted(true);
    } catch {
      setError("Einreichung fehlgeschlagen. Bitte erneut versuchen.");
    }
  };

  const balance = utility?.balance ?? 0;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 space-y-4 py-16 px-6">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-center">Widerspruch eingereicht</h2>
        <p className="text-gray-500 text-center max-w-sm text-sm">
          Dein Widerspruch wurde erfolgreich an die Hausverwaltung übermittelt.
          Du zahlst den strittigen Betrag vorerst <strong>unter Vorbehalt</strong>.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 max-w-sm w-full">
          <p className="font-semibold">Dein Widerspruch umfasst:</p>
          <ul className="mt-2 space-y-1">
            {selectedCategories.map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-semibold">Nebenkostenabrechnung {utility?.year ?? ""}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Wenn du mit deiner Abrechnung nicht einverstanden bist, kannst du hier Widerspruch einlegen.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <div className={`bg-white border rounded-2xl p-4 ${balance < 0 ? "border-red-200" : "border-green-200"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {balance < 0 ? "Nachzahlung" : "Guthaben"}
              </p>
              <p className={`text-3xl font-bold ${balance < 0 ? "text-red-600" : "text-green-600"}`}>
                {formatEur(Math.abs(balance))}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${balance < 0 ? "bg-red-100" : "bg-green-100"}`}>
              <CreditCard className={`w-6 h-6 ${balance < 0 ? "text-red-600" : "text-green-600"}`} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} id="dispute-form" className="bg-white border border-amber-200 rounded-2xl p-4 space-y-4">
          <h2 className="flex items-center gap-2 font-semibold text-amber-700">
            <ShieldAlert className="w-5 h-5" />
            Widerspruch – Zahlung unter Vorbehalt
          </h2>
          <p className="text-sm text-gray-500">
            Wähle die Kostenart(en), die du beanstandest, und begründe deinen Widerspruch. Die Hausverwaltung wird benachrichtigt.
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-semibold">Betroffene Kostenart(en) auswählen:</label>
            <div className="grid grid-cols-2 gap-2">
              {BETRKV_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`text-left text-xs p-2 rounded-lg border transition-colors ${
                    selectedCategories.includes(cat)
                      ? "bg-amber-100 border-amber-400 text-amber-900 font-medium"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {selectedCategories.includes(cat) && "✓ "}{cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="reason" className="block text-sm font-semibold">Begründung</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z.B. Die Gartenpflegekosten sind im Vergleich zum Vorjahr um 40% gestiegen. Bitte um Nachweis der Einzelpositionen."
              rows={4}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-gray-500">
              Tipp: Je konkreter deine Begründung, desto schneller kann die Verwaltung antworten.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={selectedCategories.length === 0 || !reason.trim() || createDispute.isPending}
            className="w-full bg-amber-600 text-white py-3.5 rounded-2xl font-semibold disabled:opacity-50"
          >
            {createDispute.isPending ? "Wird gesendet…" : "Widerspruch verbindlich einreichen"}
          </button>
        </form>
      </div>
    </div>
  );
}
