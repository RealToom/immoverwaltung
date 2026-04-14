import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { tenantApi } from "@/lib/api";
import { LogOut, Mail, Phone, Home, Shield, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function Profile() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState<boolean | null>(null);
  const [twoFaView, setTwoFaView] = useState<"idle" | "confirming" | "disabling">("idle");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaPassword, setTwoFaPassword] = useState("");
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout(slug!);
    navigate(`/${slug}/login`);
  }

  async function handleEnable2fa() {
    setTwoFaError(null);
    setTwoFaLoading(true);
    try {
      await tenantApi(slug!, "/me/2fa/enable", { method: "POST" });
      setTwoFaView("confirming");
    } catch {
      setTwoFaError("Code konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function handleConfirm2fa(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaError(null);
    setTwoFaLoading(true);
    try {
      await tenantApi(slug!, "/me/2fa/confirm", {
        method: "POST",
        body: { code: twoFaCode },
      });
      setTwoFaEnabled(true);
      setTwoFaView("idle");
      setTwoFaCode("");
    } catch {
      setTwoFaError("Ungültiger oder abgelaufener Code.");
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function handleDisable2fa(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaError(null);
    setTwoFaLoading(true);
    try {
      await tenantApi(slug!, "/me/2fa", {
        method: "DELETE",
        body: { password: twoFaPassword },
      });
      setTwoFaEnabled(false);
      setTwoFaView("idle");
      setTwoFaPassword("");
    } catch {
      setTwoFaError("Falsches Passwort.");
    } finally {
      setTwoFaLoading(false);
    }
  }

  const initials = user?.tenant.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  const firstUnit = user?.tenant.units[0];
  const activeContract = user?.tenant.contracts[0];

  useEffect(() => {
    tenantApi<{ data: { enabled: boolean } }>(slug!, "/me/2fa/status")
      .then((res) => setTwoFaEnabled(res.data.enabled))
      .catch(() => setTwoFaEnabled(false));
  }, [slug]);

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

        {/* 2FA */}
        {twoFaEnabled !== null && (
          <div className="bg-white border rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Zwei-Faktor-Authentifizierung
            </h3>

            {twoFaView === "idle" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {twoFaEnabled ? (
                    <ShieldCheck className="w-5 h-5 text-green-500" />
                  ) : (
                    <Shield className="w-5 h-5 text-gray-400" />
                  )}
                  <p className="text-sm text-gray-700">
                    {twoFaEnabled ? "Aktiv — Ihr Konto ist zusätzlich geschützt." : "Nicht aktiv"}
                  </p>
                </div>
                {twoFaError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {twoFaError}
                  </p>
                )}
                {twoFaEnabled ? (
                  <button
                    onClick={() => { setTwoFaView("disabling"); setTwoFaError(null); }}
                    className="w-full border border-red-200 text-red-600 text-sm py-2.5 rounded-xl font-medium"
                  >
                    2FA deaktivieren
                  </button>
                ) : (
                  <button
                    onClick={handleEnable2fa}
                    disabled={twoFaLoading}
                    className="w-full bg-primary text-primary-foreground text-sm py-2.5 rounded-xl font-medium disabled:opacity-50"
                  >
                    {twoFaLoading ? "Code wird gesendet…" : "2FA aktivieren"}
                  </button>
                )}
              </div>
            )}

            {twoFaView === "confirming" && (
              <form onSubmit={handleConfirm2fa} className="space-y-3">
                <p className="text-sm text-gray-600">
                  Wir haben Ihnen einen Code per E-Mail gesendet. Geben Sie ihn ein, um 2FA zu aktivieren.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="123456"
                />
                {twoFaError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {twoFaError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={twoFaLoading || twoFaCode.length !== 6}
                  className="w-full bg-primary text-primary-foreground text-sm py-2.5 rounded-xl font-medium disabled:opacity-50"
                >
                  {twoFaLoading ? "Wird aktiviert…" : "Bestätigen"}
                </button>
                <button
                  type="button"
                  onClick={() => { setTwoFaView("idle"); setTwoFaCode(""); setTwoFaError(null); }}
                  className="w-full text-sm text-gray-500 py-2"
                >
                  Abbrechen
                </button>
              </form>
            )}

            {twoFaView === "disabling" && (
              <form onSubmit={handleDisable2fa} className="space-y-3">
                <p className="text-sm text-gray-600">
                  Geben Sie Ihr Passwort ein, um die Zwei-Faktor-Authentifizierung zu deaktivieren.
                </p>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={twoFaPassword}
                  onChange={(e) => setTwoFaPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ihr Passwort"
                />
                {twoFaError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {twoFaError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={twoFaLoading || !twoFaPassword}
                  className="w-full border border-red-200 text-red-600 text-sm py-2.5 rounded-xl font-medium disabled:opacity-50"
                >
                  {twoFaLoading ? "Wird deaktiviert…" : "2FA deaktivieren"}
                </button>
                <button
                  type="button"
                  onClick={() => { setTwoFaView("idle"); setTwoFaPassword(""); setTwoFaError(null); }}
                  className="w-full text-sm text-gray-500 py-2"
                >
                  Abbrechen
                </button>
              </form>
            )}
          </div>
        )}

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
