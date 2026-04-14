import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { verify2fa, setToken } from "@/lib/api";

export default function Login() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { login, refetchUser } = useAuth();
  const { branding } = useBranding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const mfa = await login(slug!, email, password);
      if (mfa?.requiresTwoFactor) {
        setMfaToken(mfa.mfaToken);
      } else {
        navigate(`/${slug}/dashboard`);
      }
    } catch {
      setError("E-Mail oder Passwort falsch. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setLoading(true);

    try {
      const { accessToken } = await verify2fa(slug!, mfaToken, code, rememberDevice);
      setToken(accessToken);
      await refetchUser(slug!);
      navigate(`/${slug}/dashboard`);
    } catch {
      setError("Ungültiger Code. Bitte prüfen Sie Ihre E-Mail und versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">
                {branding?.name?.charAt(0) ?? "M"}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{branding?.name ?? "Mieter-Portal"}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mfaToken ? "Zwei-Faktor-Authentifizierung" : "Melden Sie sich an"}
          </p>
        </div>

        {mfaToken ? (
          /* ── 2FA Code-Formular ── */
          <form onSubmit={handleVerify2fa} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Wir haben Ihnen einen 6-stelligen Code per E-Mail gesendet. Bitte geben Sie ihn hier ein.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="123456"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">Dieses Gerät 30 Tage merken</span>
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {loading ? "Wird geprüft…" : "Code bestätigen"}
            </button>

            <button
              type="button"
              onClick={() => { setMfaToken(null); setCode(""); setError(null); }}
              className="w-full text-sm text-gray-500 py-2"
            >
              Zurück zur Anmeldung
            </button>
          </form>
        ) : (
          /* ── Login-Formular ── */
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="ihre@email.de"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {loading ? "Wird angemeldet…" : "Anmelden"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
