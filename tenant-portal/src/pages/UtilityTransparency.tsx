import { useParams } from "react-router-dom";
import { CreditCard, ListChecks, FileText, Download } from "lucide-react";
import { useTenantUtility, useTenantReceipts, downloadReceipt } from "@/hooks/api/useTenantUtility";

function formatEur(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export default function UtilityTransparency() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useTenantUtility(slug!);
  const { data: receiptsData } = useTenantReceipts(slug!, data?.year);
  const receipts = receiptsData?.receipts ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-semibold">Verbrauchstransparenz</h1>
        <p className="text-sm text-gray-500 mt-1">
          Deine Nebenkosten {data ? `für ${data.year}` : ""} im Überblick.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {isLoading ? (
          <div className="bg-white border rounded-2xl p-6 animate-pulse h-32" />
        ) : !data ? (
          <div className="bg-white border rounded-2xl p-6 text-center text-gray-500 text-sm">
            Noch keine Abrechnungsdaten für dein Vertragsjahr verfügbar.
          </div>
        ) : (
          <>
            <div className={`bg-white border rounded-2xl p-4 ${data.balance < 0 ? "border-red-200" : "border-green-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {data.balance < 0 ? "Nachzahlung" : "Guthaben"}
                  </p>
                  <p className={`text-3xl font-bold ${data.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatEur(Math.abs(data.balance))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Kostenanteil: {formatEur(data.totalCosts)} — Vorauszahlungen: {formatEur(data.totalPrepaid)}
                  </p>
                  {data.settlementStatus && data.settlementStatus !== "OFFEN" && (
                    <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {data.settlementStatus === "VERRECHNET" ? "Verrechnet" : "Bezahlt"}
                      {data.settledAt ? ` am ${new Date(data.settledAt).toLocaleDateString("de-DE")}` : ""}
                    </span>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${data.balance < 0 ? "bg-red-100" : "bg-green-100"}`}>
                  <CreditCard className={`w-6 h-6 ${data.balance < 0 ? "text-red-600" : "text-green-600"}`} />
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-4">
              <h2 className="flex items-center gap-2 font-semibold mb-1">
                <ListChecks className="w-5 h-5" />
                Kostenaufstellung nach Kategorie
              </h2>
              <p className="text-sm text-gray-500 mb-3">Anteil der einzelnen Betriebskostenarten an deiner Abrechnung.</p>
              {data.categories.length === 0 ? (
                <p className="text-sm text-gray-500">Keine kategorisierten Kosten vorhanden.</p>
              ) : (
                <div className="space-y-2">
                  {data.categories.map((c, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                      <span>{c.label ?? c.category}</span>
                      <span className="font-medium">{formatEur(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {receipts.length > 0 && (
              <div className="bg-white border rounded-2xl p-4">
                <h2 className="flex items-center gap-2 font-semibold mb-1">
                  <FileText className="w-5 h-5" />
                  Belegeinsicht (§ 259 BGB)
                </h2>
                <p className="text-sm text-gray-500 mb-3">
                  Die Rechnungen und Belege zu deiner Abrechnung — du kannst sie hier einsehen und herunterladen.
                </p>
                <div className="space-y-2">
                  {receipts.map((r) => (
                    <div key={r.transactionId} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{r.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(r.date).toLocaleDateString("de-DE")} — {formatEur(Math.abs(r.amount))}
                        </p>
                      </div>
                      {r.document && (
                        <button
                          onClick={() => downloadReceipt(slug!, r.document!.id, r.document!.name)}
                          className="flex items-center gap-1 text-blue-600 shrink-0 ml-3"
                        >
                          <Download className="w-4 h-4" />
                          Beleg
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
