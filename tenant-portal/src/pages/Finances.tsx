import { useParams } from "react-router-dom";
import { useTenantFinances } from "@/hooks/api/useTenantFinances";
import { format } from "date-fns";
import { de } from "date-fns/locale";

function formatEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

export default function Finances() {
  const { slug } = useParams<{ slug: string }>();
  const { data: finances, isLoading } = useTenantFinances(slug!);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-semibold">Finanzen</h1>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Monthly rent hero */}
        {finances && (
          <div className="bg-primary text-primary-foreground rounded-2xl p-5">
            <p className="text-sm opacity-80 font-medium">Monatliche Miete</p>
            <p className="text-4xl font-bold mt-1">{formatEur(finances.monthlyRent)}</p>
            <p className="text-sm opacity-70 mt-1">fällig am 1. jedes Monats</p>
          </div>
        )}

        {/* Transaction history */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Buchungshistorie
          </h2>
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white border rounded-2xl p-4 animate-pulse h-16 mb-2" />
            ))
          ) : !finances?.entries?.length ? (
            <div className="bg-white border rounded-2xl p-6 text-center text-gray-500 text-sm">
              Noch keine Buchungen vorhanden.
            </div>
          ) : (
            <div className="space-y-2">
              {finances.entries.map((entry) => (
                <div key={entry.id} className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    entry.type === "INCOME" ? "bg-green-50" : "bg-red-50"
                  }`}>
                    <span className={`text-lg font-bold ${
                      entry.type === "INCOME" ? "text-green-600" : "text-red-600"
                    }`}>
                      {entry.type === "INCOME" ? "+" : "−"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.description}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(entry.date), "dd. MMMM yyyy", { locale: de })} · {entry.category}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${
                    entry.type === "INCOME" ? "text-green-600" : "text-red-600"
                  }`}>
                    {entry.type === "INCOME" ? "+" : "−"}{formatEur(Math.abs(entry.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
