import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { tenantApi, setToken } from "@/lib/api";
import { useBranding } from "@/contexts/BrandingContext";
import { CheckCircle } from "lucide-react";

export default function AcceptInvite() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const navigate = useNavigate();
  const { branding } = useBranding();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Passwort muss mindestens einen Großbuchstaben enthalten.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Passwort muss mindestens eine Zahl enthalten.");
      return;
    }
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    try {
      const res = await tenantApi<{ data: { accessToken: string } }>(slug!, "/auth/accept-invite", {
        method: "POST",
        body: { token, password },
      });
      setToken(res.data.accessToken);
      setDone(true);
      setTimeout(() => navigate(`/${slug}/dashboard`), 2000);
    } catch {
      setError("Einladungslink ungültig oder abgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Willkommen!</h2>
        <p className="text-gray-500">Ihr Konto ist aktiviert. Sie werden weitergeleitet…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-foreground">
              {branding?.name?.charAt(0) ?? "M"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Willkommen!</h1>
          <p className="text-sm text-gray-500 mt-1">Bitte setzen Sie Ihr Passwort</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Mindestens 8 Zeichen, 1 Großbuchstabe, 1 Zahl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Passwort wiederholen"
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
            {loading ? "Wird gespeichert…" : "Konto aktivieren"}
          </button>
        </form>
      </div>
    </div>
  );
}
