import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { AlertCircle, FileText, MessageSquare, TrendingUp, BarChart3, Camera, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

function formatEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

export default function Dashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useBranding();

  const activeContract = user?.tenant.contracts[0];
  const firstUnit = user?.tenant.units[0];

  const quickActions = [
    {
      label: "Schaden melden",
      icon: <AlertCircle className="w-6 h-6" />,
      onClick: () => navigate(`/${slug}/tickets/new`),
      color: "bg-red-50 text-red-600",
    },
    {
      label: "Dokument hochladen",
      icon: <FileText className="w-6 h-6" />,
      onClick: () => navigate(`/${slug}/documents/upload`),
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Nachrichten",
      icon: <MessageSquare className="w-6 h-6" />,
      onClick: () => navigate(`/${slug}/messages`),
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Finanzen",
      icon: <TrendingUp className="w-6 h-6" />,
      onClick: () => navigate(`/${slug}/finances`),
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Energie & Wasser",
      icon: <BarChart3 className="w-6 h-6" />,
      onClick: () => navigate(`/${slug}/utility`),
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Zählerstand melden",
      icon: <Camera className="w-6 h-6" />,
      onClick: () => navigate(`/${slug}/meter-reading`),
      color: "bg-teal-50 text-teal-600",
    },
    {
      label: "Abrechnung prüfen",
      icon: <ShieldAlert className="w-6 h-6" />,
      onClick: () => navigate(`/${slug}/billing-dispute`),
      color: "bg-amber-50 text-amber-600",
    },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 17) return "Guten Tag";
    return "Guten Abend";
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-8">
        <p className="text-sm opacity-80">{greeting()},</p>
        <h1 className="text-2xl font-bold mt-0.5">{user?.tenant.name ?? "…"}</h1>
        {firstUnit && (
          <p className="text-sm opacity-75 mt-1">
            {firstUnit.property.street}, {firstUnit.property.zip} {firstUnit.property.city} · Einheit {firstUnit.number}
          </p>
        )}
      </div>

      <div className="px-4 -mt-4 space-y-4 flex-1">
        {/* Next Rent Hero Card */}
        {activeContract && (
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
              Nächste Miete
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {formatEur(activeContract.monthlyRent)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              fällig am 1.{" "}
              {format(new Date(), "MMMM yyyy", { locale: de })}
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Schnellzugriff
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="bg-white border rounded-2xl p-4 flex flex-col items-center gap-2 text-center hover:shadow-sm transition-shadow"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${action.color}`}>
                  {action.icon}
                </div>
                <span className="text-xs font-medium text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Company info */}
        <div className="bg-white border rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-400">Verwaltet von</p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">
            {branding?.name ?? "Ihrer Hausverwaltung"}
          </p>
        </div>
      </div>
    </div>
  );
}
