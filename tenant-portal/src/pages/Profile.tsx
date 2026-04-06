import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Mail, Phone, Home } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function Profile() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout(slug!);
    navigate(`/${slug}/login`);
  }

  const initials = user?.tenant.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  const firstUnit = user?.tenant.units[0];
  const activeContract = user?.tenant.contracts[0];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-semibold">Profil</h1>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Avatar + Name */}
        <div className="bg-white border rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mb-3">
            {initials}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{user?.tenant.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
        </div>

        {/* Mietdaten */}
        <div className="bg-white border rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Mietdaten
          </h3>
          <div className="space-y-3">
            {firstUnit && (
              <div className="flex items-start gap-3">
                <Home className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {firstUnit.property.street}, {firstUnit.property.zip} {firstUnit.property.city}
                  </p>
                  <p className="text-xs text-gray-500">Einheit {firstUnit.number}</p>
                </div>
              </div>
            )}
            {activeContract && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Miete: {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(activeContract.monthlyRent)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Einzug: {format(new Date(user!.tenant.moveIn), "dd. MMMM yyyy", { locale: de })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kontaktdaten */}
        <div className="bg-white border rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Kontakt
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <p className="text-sm text-gray-900">{user?.email}</p>
            </div>
            {user?.tenant.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <p className="text-sm text-gray-900">{user.tenant.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Abmelden */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 py-3.5 rounded-2xl font-semibold disabled:opacity-50"
        >
          <LogOut className="w-5 h-5" />
          {loggingOut ? "Wird abgemeldet…" : "Abmelden"}
        </button>
      </div>
    </div>
  );
}
