# Tenant Portal 2FA Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den fehlenden 2FA-Flow im Mieter-Portal Frontend implementieren: Login-Seite erkennt den `mfaToken`-Response und zeigt ein Code-Eingabe-Formular, Profile-Seite erlaubt 2FA aktivieren/deaktivieren.

**Architecture:** Inline-Ansatz — kein neuer Route. Login.tsx wechselt zwischen Passwort-Formular und Code-Formular per State. AuthContext.login() gibt bei 2FA-Anforderung `{ requiresTwoFactor: true, mfaToken }` zurück statt void. Profile.tsx bekommt eine neue 2FA-Sektion mit Enable/Disable-Flow. Das `mfaToken` wird per `Authorization: Bearer` Header an `POST /auth/verify-2fa` gesendet (nicht im Body).

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn/UI, React Router v6

---

## File Map

| Aktion | Datei | Verantwortlichkeit |
|--------|-------|-------------------|
| Modify | `tenant-portal/src/contexts/AuthContext.tsx` | `login()` gibt `MfaChallenge \| undefined` zurück |
| Modify | `tenant-portal/src/lib/api.ts` | `verify2fa()` Hilfsfunktion hinzufügen |
| Modify | `tenant-portal/src/pages/Login.tsx` | Inline 2FA Code-Eingabe-Formular |
| Modify | `tenant-portal/src/pages/Profile.tsx` | 2FA Sektion (Status, Enable, Disable) |

---

## Task 1: AuthContext — login() gibt MfaChallenge zurück

**Files:**
- Modify: `tenant-portal/src/contexts/AuthContext.tsx`

Backend-Response bei aktiviertem 2FA:
```json
{ "data": { "requiresTwoFactor": true, "mfaToken": "<jwt>" } }
```
Bei normalem Login:
```json
{ "data": { "accessToken": "<jwt>" } }
```

- [ ] **Step 1: Interface für Login-Response anpassen**

In `tenant-portal/src/contexts/AuthContext.tsx` folgende neue Typen **vor** `AuthContextValue` einfügen:

```typescript
export interface MfaChallenge {
  requiresTwoFactor: true;
  mfaToken: string;
}

type LoginResponse =
  | { requiresTwoFactor: true; mfaToken: string }
  | { accessToken: string };
```

- [ ] **Step 2: `login()` Signatur in AuthContextValue ändern**

Altes Interface:
```typescript
interface AuthContextValue {
  user: TenantUserMe | null;
  loading: boolean;
  login: (slug: string, email: string, password: string) => Promise<void>;
  logout: (slug: string) => Promise<void>;
  refetchUser: (slug: string) => Promise<void>;
}
```

Neues Interface (nur `login` ändert sich):
```typescript
interface AuthContextValue {
  user: TenantUserMe | null;
  loading: boolean;
  login: (slug: string, email: string, password: string) => Promise<MfaChallenge | undefined>;
  logout: (slug: string) => Promise<void>;
  refetchUser: (slug: string) => Promise<void>;
}
```

Auch den Default-Wert im `createContext`-Aufruf anpassen:
```typescript
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => undefined,
  logout: async () => {},
  refetchUser: async () => {},
});
```

- [ ] **Step 3: `login()` Implementierung anpassen**

Den bestehenden `login` useCallback ersetzen:

```typescript
const login = useCallback(async (slug: string, email: string, password: string): Promise<MfaChallenge | undefined> => {
  const res = await tenantApi<{ data: LoginResponse }>(slug, "/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if ("requiresTwoFactor" in res.data) {
    return { requiresTwoFactor: true, mfaToken: res.data.mfaToken };
  }
  setToken(res.data.accessToken);
  const meRes = await tenantApi<{ data: TenantUserMe }>(slug, "/me");
  setUser(meRes.data);
  return undefined;
}, []);
```

- [ ] **Step 4: TypeScript prüfen**

```bash
cd tenant-portal && npx tsc --noEmit 2>&1 | head -30
```

Expected: Keine Fehler (oder nur Fehler aus Login.tsx weil dort `login()` noch nicht angepasst ist).

- [ ] **Step 5: Commit**

```bash
cd tenant-portal && git add src/contexts/AuthContext.tsx
git commit -m "feat(tenant-portal): login() returns MfaChallenge when 2FA required"
```

---

## Task 2: api.ts — verify2fa() Hilfsfunktion

**Files:**
- Modify: `tenant-portal/src/lib/api.ts`

Das Backend erwartet bei `POST /auth/verify-2fa`:
- Header: `Authorization: Bearer <mfaToken>`
- Body: `{ code: string, rememberDevice?: boolean }`
- Response: `{ data: { accessToken: string } }` + `Set-Cookie: tenant_refresh_token` + optional `Set-Cookie: tenant_device_token`

Die bestehende `tenantApi()` Funktion schickt automatisch den `_accessToken` als Bearer Header — aber für verify-2fa brauchen wir den `mfaToken` dort statt des Access Tokens. Daher neue Funktion.

- [ ] **Step 1: verify2fa() Funktion am Ende von api.ts hinzufügen**

```typescript
/** Schließt den 2FA-Login ab. mfaToken wird als Authorization-Header gesendet. */
export async function verify2fa(
  slug: string,
  mfaToken: string,
  code: string,
  rememberDevice: boolean
): Promise<{ accessToken: string }> {
  const res = await fetch(`/api/tenant/${slug}/auth/verify-2fa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mfaToken}`,
    },
    credentials: "include",
    body: JSON.stringify({ code, rememberDevice }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data as { accessToken: string };
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd tenant-portal && npx tsc --noEmit 2>&1 | head -20
```

Expected: Keine Fehler in api.ts.

- [ ] **Step 3: Commit**

```bash
cd tenant-portal && git add src/lib/api.ts
git commit -m "feat(tenant-portal): add verify2fa() API helper"
```

---

## Task 3: Login.tsx — Inline 2FA Code-Eingabe

**Files:**
- Modify: `tenant-portal/src/pages/Login.tsx`

Flow:
1. Benutzer gibt E-Mail + Passwort ein → Submit
2. Login-Response enthält `mfaToken` → `mfaToken` State setzen, Formular wechselt zu Code-Eingabe
3. Benutzer gibt 6-stelligen Code ein + optional "Gerät merken" Checkbox → Submit
4. verify2fa() aufrufen → bei Erfolg `/me` laden + zu Dashboard navigieren

- [ ] **Step 1: Imports erweitern**

Oben in `Login.tsx` folgende Imports anpassen:

```typescript
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { verify2fa, setToken } from "@/lib/api";
import { tenantApi } from "@/lib/api";
```

- [ ] **Step 2: State-Variablen erweitern**

Nach den bestehenden State-Variablen (`email`, `password`, `error`, `loading`) folgende hinzufügen:

```typescript
const [mfaToken, setMfaToken] = useState<string | null>(null);
const [code, setCode] = useState("");
const [rememberDevice, setRememberDevice] = useState(false);
```

- [ ] **Step 3: handleSubmit für 2FA-Response anpassen**

Den bestehenden `handleSubmit` ersetzen:

```typescript
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
```

- [ ] **Step 4: handleVerify2fa Funktion hinzufügen**

Direkt nach `handleSubmit`:

```typescript
async function handleVerify2fa(e: React.FormEvent) {
  e.preventDefault();
  if (!mfaToken) return;
  setError(null);
  setLoading(true);

  try {
    const { accessToken } = await verify2fa(slug!, mfaToken, code, rememberDevice);
    setToken(accessToken);
    // AuthContext user laden
    const { refetchUser } = useAuth(); // already destructured above — see Step 5
    await refetchUser(slug!);
    navigate(`/${slug}/dashboard`);
  } catch {
    setError("Ungültiger Code. Bitte prüfen Sie Ihre E-Mail und versuchen Sie es erneut.");
  } finally {
    setLoading(false);
  }
}
```

**Hinweis:** `refetchUser` muss aus `useAuth()` destructured werden (Step 5).

- [ ] **Step 5: useAuth Destructuring um refetchUser ergänzen**

Zeile mit `const { login } = useAuth();` ersetzen:

```typescript
const { login, refetchUser } = useAuth();
```

Außerdem `handleVerify2fa` bereinigen — `useAuth()` nicht innerhalb der Funktion aufrufen, sondern die bereits destrukturierte Variable nutzen:

```typescript
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
```

- [ ] **Step 6: Return-JSX anpassen — 2FA-Formular einfügen**

Den gesamten `return`-Block ersetzen:

```typescript
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
```

- [ ] **Step 7: TypeScript prüfen**

```bash
cd tenant-portal && npx tsc --noEmit 2>&1 | head -30
```

Expected: Keine Fehler.

- [ ] **Step 8: Commit**

```bash
cd tenant-portal && git add src/pages/Login.tsx
git commit -m "feat(tenant-portal): inline 2FA code entry in Login page"
```

---

## Task 4: Profile.tsx — 2FA Sektion

**Files:**
- Modify: `tenant-portal/src/pages/Profile.tsx`

API-Endpunkte:
- `GET /me/2fa/status` → `{ data: { enabled: boolean } }`
- `POST /me/2fa/enable` → sendet Code per E-Mail, gibt `{ data: { codeSent: true } }` zurück
- `POST /me/2fa/confirm` → `{ body: { code: string } }` → aktiviert 2FA
- `DELETE /me/2fa` → `{ body: { password: string } }` → deaktiviert 2FA

UI-States:
- `idle` — zeigt Status + Enable/Disable Button
- `confirming` — nach Enable: Code-Eingabe
- `disabling` — Passwort-Eingabe zum Deaktivieren

- [ ] **Step 1: Imports erweitern**

Bestehende Imports in `Profile.tsx` ersetzen:

```typescript
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { tenantApi } from "@/lib/api";
import { LogOut, Mail, Phone, Home, Shield, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
```

- [ ] **Step 2: 2FA State-Variablen hinzufügen**

Nach `const [loggingOut, setLoggingOut] = useState(false);` einfügen:

```typescript
const [twoFaEnabled, setTwoFaEnabled] = useState<boolean | null>(null);
const [twoFaView, setTwoFaView] = useState<"idle" | "confirming" | "disabling">("idle");
const [twoFaCode, setTwoFaCode] = useState("");
const [twoFaPassword, setTwoFaPassword] = useState("");
const [twoFaError, setTwoFaError] = useState<string | null>(null);
const [twoFaLoading, setTwoFaLoading] = useState(false);
```

- [ ] **Step 3: 2FA-Status beim Laden abrufen**

Nach den bestehenden `const`-Deklarationen (z.B. `initials`, `firstUnit`, `activeContract`) einfügen:

```typescript
useEffect(() => {
  tenantApi<{ data: { enabled: boolean } }>(slug!, "/me/2fa/status")
    .then((res) => setTwoFaEnabled(res.data.enabled))
    .catch(() => setTwoFaEnabled(false));
}, [slug]);
```

- [ ] **Step 4: 2FA Handler-Funktionen hinzufügen**

Nach `handleLogout` einfügen:

```typescript
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
```

- [ ] **Step 5: 2FA Sektion in JSX einfügen**

In der `return`-Struktur, nach der Kontaktdaten-Sektion (`{/* Kontaktdaten */}`) und **vor** dem Abmelden-Button, folgendes einfügen:

```typescript
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
```

- [ ] **Step 6: TypeScript prüfen**

```bash
cd tenant-portal && npx tsc --noEmit 2>&1 | head -30
```

Expected: Keine Fehler.

- [ ] **Step 7: Commit**

```bash
cd tenant-portal && git add src/pages/Profile.tsx
git commit -m "feat(tenant-portal): 2FA enable/disable in Profil-Seite"
```

---

## Task 5: Full Build + Smoke Test

- [ ] **Step 1: Production Build**

```bash
cd tenant-portal && npm run build 2>&1 | tail -20
```

Expected: `✓ built in` — kein Fehler.

- [ ] **Step 2: Backend TypeScript prüfen (keine Regressionen)**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: Keine Fehler.

- [ ] **Step 3: Backend Tests**

```bash
cd backend && npm test 2>&1 | tail -15
```

Expected: Alle Tests grün.

- [ ] **Step 4: Final Commit (falls nötig)**

Falls nach den vorherigen Tasks noch unstaged Changes übrig sind:

```bash
git status
git add -p
git commit -m "chore(tenant-portal): 2FA frontend – final cleanup"
```
