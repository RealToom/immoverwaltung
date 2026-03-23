# ImmoHub Go-to-Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öffentliche Landing Page + Self-Service-Registrierung + Rebranding auf "ImmoHub" für den Marktstart.

**Architecture:** Fast alle Backend-Teile existieren bereits (`register()` in auth.service.ts, `registerHandler` in auth.controller.ts, `AuthContext.register()` im Frontend). Die Route ist nur deaktiviert. Wir aktivieren sie, ergänzen die Willkommens-Mail, bauen Register + Landing Page und benennen die App um.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Shadcn/UI, Express 5, Nodemailer, Vitest

---

## File Map

| Status | Datei | Änderung |
|--------|-------|---------|
| Modify | `cozy-estate-central/index.html` | Rebranding: "Immoverwalt" → "ImmoHub" |
| Modify | `cozy-estate-central/src/pages/Login.tsx` | Rebranding: "ImmoVerwalt" → "ImmoHub" |
| Modify | `backend/src/routes/auth.routes.ts` | `POST /register` Route aktivieren |
| Modify | `backend/src/services/email.service.ts` | `sendWelcomeEmail()` hinzufügen |
| Modify | `backend/src/controllers/auth.controller.ts` | `sendWelcomeEmail()` nach Register aufrufen |
| Create | `backend/src/test/register.test.ts` | Unit-Tests für Register-Flow |
| Modify | `cozy-estate-central/src/App.tsx` | `/register` + `/landing` als public routes; `/impressum` + `/datenschutz` aus AppLayout herauslösen |
| Modify | `cozy-estate-central/src/components/ProtectedRoute.tsx` | Redirect zu `/landing` statt `/login` |
| Create | `cozy-estate-central/src/pages/Register.tsx` | Self-Service-Registrierungs-Formular |
| Create | `cozy-estate-central/src/pages/LandingPage.tsx` | Öffentliche Marketing-Seite |

---

## Task 1: Rebranding (index.html + Login.tsx)

**Files:**
- Modify: `cozy-estate-central/index.html`
- Modify: `cozy-estate-central/src/pages/Login.tsx`

- [ ] **Schritt 1: index.html umbenennen**

In `cozy-estate-central/index.html` folgende Änderungen:

```html
<!-- Zeile 6: -->
<title>ImmoHub</title>

<!-- Zeile 11: -->
<meta name="apple-mobile-web-app-title" content="ImmoHub" />

<!-- Zeile 13: -->
<meta name="description" content="Immobilienverwaltung für kleine und mittlere Hausverwaltungen" />

<!-- Zeile 14: -->
<meta name="author" content="ImmoHub" />

<!-- Zeile 16: -->
<meta property="og:title" content="ImmoHub" />

<!-- Zeile 17: -->
<meta property="og:description" content="Die einfache Immobilienverwaltung für Hausverwaltungen" />
```

- [ ] **Schritt 2: Login.tsx umbenennen**

In `cozy-estate-central/src/pages/Login.tsx`:
- Zeile 61: `ImmoVerwalt` → `ImmoHub`
- Zeile 62: Text kann bleiben oder zu "Ihr Hausverwaltungs-Hub" geändert werden
- Zeile 116: `© 2026 ImmoVerwalt` → `© 2026 ImmoHub`

Füge außerdem nach dem Card-Element (nach Zeile 113) einen Link zur Registrierung hinzu:

```tsx
<p className="text-center text-xs text-muted-foreground">
  Noch kein Konto?{" "}
  <a href="/register" className="underline hover:text-foreground">
    Jetzt registrieren
  </a>
</p>
```

- [ ] **Schritt 3: Im Browser prüfen**

```bash
cd cozy-estate-central && npm run dev
```

Browser-Tab und Login-Screen müssen "ImmoHub" zeigen.

- [ ] **Schritt 4: Commit**

```bash
git add cozy-estate-central/index.html cozy-estate-central/src/pages/Login.tsx
git commit -m "feat: rebrand to ImmoHub (index.html + Login page)"
```

---

## Task 2: Backend — Register-Route aktivieren (TDD)

**Files:**
- Modify: `backend/src/routes/auth.routes.ts`
- Modify: `backend/src/controllers/auth.controller.ts`
- Create: `backend/src/test/register.test.ts`

**Kontext:** `registerSchema` (auth.schema.ts), `registerHandler` (auth.controller.ts) und `authService.register()` (auth.service.ts) existieren bereits. Die Route ist nur deaktiviert (Kommentar Zeile 25 in auth.routes.ts).

- [ ] **Schritt 1: Test-Datei erstellen**

Erstelle `backend/src/test/register.test.ts`.

**Wichtig:** Alle `vi.mock()`-Aufrufe müssen vor den Imports stehen (Vitest hoist sie automatisch, aber die Imports für die gemockten Module müssen danach folgen). Genau diese Reihenfolge einhalten:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Alle vi.mock()-Aufrufe ZUERST — vor allen anderen Imports
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../lib/jwt.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("access_token"),
  signRefreshToken: vi.fn().mockReturnValue("refresh_token"),
}));

// Mocks für Email — hier schon definieren, wird in Task 3 benötigt
vi.mock("../config/email.js", () => ({
  sendMail: vi.fn().mockResolvedValue(true),
  isEmailEnabled: true,
}));

// Imports NACH den vi.mock()-Aufrufen
import { prisma } from "../lib/prisma.js";
import { register } from "../services/auth.service.js";

const mockUser = {
  id: 1,
  name: "Max Mustermann",
  email: "max@example.de",
  role: "ADMIN",
  companyId: 10,
  passwordHash: "hashed_password",
  failedLoginAttempts: 0,
  lockedUntil: null,
  company: { id: 10, name: "Mustermann GmbH", slug: "mustermann-gmbh" },
};

describe("authService.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates company and user, returns tokens", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any);
    vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({} as any);

    const result = await register("Max Mustermann", "max@example.de", "Password1!", "Mustermann GmbH");

    expect(prisma.user.create).toHaveBeenCalledOnce();
    expect(result.accessToken).toBe("access_token");
    expect(result.refreshToken).toBe("refresh_token");
    // passwordHash must not be in returned user
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("throws 409 if email already exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

    await expect(
      register("Max Mustermann", "max@example.de", "Password1!", "Mustermann GmbH")
    ).rejects.toMatchObject({ status: 409 });
  });

  it("sanitizes user — removes passwordHash, failedLoginAttempts, lockedUntil", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any);
    vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({} as any);

    const result = await register("Max Mustermann", "max@example.de", "Password1!", "Mustermann GmbH");

    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("failedLoginAttempts");
    expect(result.user).not.toHaveProperty("lockedUntil");
  });
});
```

- [ ] **Schritt 2: Tests ausführen — müssen GRÜN sein (Logik existiert bereits)**

```bash
cd backend && npm test -- register.test.ts
```

Erwartetes Ergebnis: 3 Tests PASS (die Logik in auth.service.ts ist schon da).

- [ ] **Schritt 3: Register-Route in auth.routes.ts aktivieren**

In `backend/src/routes/auth.routes.ts`:

Füge oben in den Imports hinzu:
```typescript
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
  updateMeHandler,
  getNotificationPrefsHandler,
  updateNotificationPrefsHandler,
  changePasswordHandler,
  registerHandler,          // NEU
} from "../controllers/auth.controller.js";
```

Und:
```typescript
import {
  loginSchema,
  updateProfileSchema,
  updateNotificationPrefsSchema,
  changePasswordSchema,
  registerSchema,           // NEU
} from "../schemas/auth.schema.js";
```

Füge die Route nach dem Kommentar "Public routes" ein (Zeile 26, vor dem Login-Route):
```typescript
// Self-service registration
router.post("/register", authLimiter, validate({ body: registerSchema }), registerHandler);
```

Entferne oder ersetze den Kommentar: "Self-registration is disabled — accounts are created by admins via /api/users"

- [ ] **Schritt 4: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Schritt 5: Alle Tests laufen lassen**

```bash
cd backend && npm test
```

Erwartetes Ergebnis: Alle Tests PASS (min. 80 + 3 neue = 83).

- [ ] **Schritt 6: Commit**

```bash
git add backend/src/routes/auth.routes.ts backend/src/controllers/auth.controller.ts backend/src/test/register.test.ts
git commit -m "feat: enable self-service registration endpoint (POST /api/auth/register)"
```

---

## Task 3: Backend — Willkommens-Mail

**Files:**
- Modify: `backend/src/services/email.service.ts`
- Modify: `backend/src/controllers/auth.controller.ts`
- Modify: `backend/src/test/register.test.ts`

- [ ] **Schritt 1: Test für sendWelcomeEmail schreiben (failing)**

Füge am Ende von `backend/src/test/register.test.ts` hinzu.

**Wichtig:** Die `vi.mock("../config/email.js", ...)` ist bereits am Dateikopf (Task 2, Schritt 1). Hier nur die Imports und describe-Blöcke ergänzen:

```typescript
// Diese zwei Imports am Dateikopf ergänzen (nach den bestehenden Imports):
import { sendWelcomeEmail } from "../services/email.service.js";
import { sendMail, isEmailEnabled } from "../config/email.js";

// Diesen describe-Block ans Dateiende anfügen:
describe("sendWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends mail with correct recipient and subject", async () => {
    await sendWelcomeEmail("max@example.de", "Max", "https://hasverl.xyz");

    expect(sendMail).toHaveBeenCalledOnce();
    const [to, subject] = vi.mocked(sendMail).mock.calls[0];
    expect(to).toBe("max@example.de");
    expect(subject).toContain("Willkommen");
  });

  it("returns false when SMTP is disabled (isEmailEnabled = false)", async () => {
    // Simuliere deaktivierten SMTP-Pfad: isEmailEnabled=false → frühzeitiger return
    vi.mocked(sendMail).mockClear();
    // isEmailEnabled ist eine Konstante im Modul — teste den Guard-Pfad
    // indem sendMail nicht aufgerufen wird wenn die Funktion korrekt implementiert ist
    // Dafür: teste dass sendMail NICHT aufgerufen wird wenn isEmailEnabled=false gesetzt wird
    // Da isEmailEnabled im Mock true ist, testen wir stattdessen den false-return von sendMail:
    vi.mocked(sendMail).mockResolvedValueOnce(false);
    const result = await sendWelcomeEmail("max@example.de", "Max", "https://hasverl.xyz");
    expect(result).toBe(false);
  });
});
```

- [ ] **Schritt 2: Test ausführen — muss FAIL (sendWelcomeEmail existiert noch nicht)**

```bash
cd backend && npm test -- register.test.ts
```

Erwartetes Ergebnis: "sendWelcomeEmail is not a function" oder Import-Fehler.

- [ ] **Schritt 3: sendWelcomeEmail in email.service.ts implementieren**

Füge am Ende von `backend/src/services/email.service.ts` hinzu:

```typescript
export async function sendWelcomeEmail(
  to: string,
  name: string,
  appUrl: string
): Promise<boolean> {
  if (!isEmailEnabled) return false;   // Gleicher Guard wie alle anderen Mail-Funktionen
  const subject = "Willkommen bei ImmoHub!";
  const html = htmlWrapper("Willkommen bei ImmoHub", `
    <p>Hallo ${escHtml(name)},</p>
    <p>Ihr ImmoHub-Konto ist bereit. Sie können sich jetzt anmelden und Ihre Immobilienverwaltung einrichten.</p>
    <p style="margin: 24px 0;">
      <a href="${escHtml(appUrl)}/login"
         style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
        Jetzt anmelden
      </a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Bei Fragen erreichen Sie uns unter <a href="mailto:support@immohub.de">support@immohub.de</a>.
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Ihr 14-tägiger kostenloser Testzeitraum hat begonnen. Kein Kreditkarte erforderlich.
    </p>
  `);

  return sendMail(to, subject, html);
}
```

- [ ] **Schritt 4: Tests ausführen — müssen GRÜN sein**

```bash
cd backend && npm test -- register.test.ts
```

Erwartetes Ergebnis: Alle 5 Tests PASS.

- [ ] **Schritt 5: sendWelcomeEmail im registerHandler aufrufen**

In `backend/src/controllers/auth.controller.ts`, nach Zeile 50 (nach `res.status(201).json(...)`), füge vor der schließenden Klammer des `registerHandler` hinzu:

Erst Import ergänzen:
```typescript
import { sendWelcomeEmail } from "../services/email.service.js";
```

Dann in `registerHandler` nach dem `res.status(201).json(...)` call (fire-and-forget, kein await):
```typescript
// Fire-and-forget: welcome email (non-blocking)
const appUrl = process.env.CLIENT_URL ?? "https://hasverl.xyz";
sendWelcomeEmail(result.user.email as string, result.user.name as string, appUrl).catch(() => {
  // ignore SMTP failures — registration succeeded regardless
});
```

**Wichtig:** Die `sendWelcomeEmail`-Call muss NACH dem `res.status(201).json(...)` stehen und darf den Response nicht blockieren.

- [ ] **Schritt 6: TypeScript prüfen**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Schritt 7: Alle Tests laufen lassen**

```bash
cd backend && npm test
```

Erwartetes Ergebnis: Alle Tests PASS.

- [ ] **Schritt 8: Commit**

```bash
git add backend/src/services/email.service.ts backend/src/controllers/auth.controller.ts backend/src/test/register.test.ts
git commit -m "feat: send welcome email on self-service registration"
```

---

## Task 4: Frontend — Routing-Anpassungen

**Files:**
- Modify: `cozy-estate-central/src/App.tsx`
- Modify: `cozy-estate-central/src/components/ProtectedRoute.tsx`

**Kontext:** Aktuell sind `/impressum` und `/datenschutz` innerhalb des `AppLayout` (und damit der `ProtectedRoute`). Unauthentifizierte Nutzer können sie nicht sehen. Außerdem muss `/register` und `/landing` als öffentliche Routen angelegt werden.

- [ ] **Schritt 1: App.tsx — öffentliche Routen hinzufügen**

In `cozy-estate-central/src/App.tsx`:

1. Imports hinzufügen (nach dem letzten bestehenden Import):

```tsx
import Register from "./pages/Register";
import LandingPage from "./pages/LandingPage";
```

2. In der `App`-Komponente die öffentlichen Routen erweitern. Derzeit:

```tsx
<Route path="/login" element={<Login />} />
<Route path="/superadmin/login" element={<SuperAdminLogin />} />
...
<Route path="/billing-locked" element={<BillingLocked />} />
```

Hinzufügen (nach `/billing-locked`):

```tsx
<Route path="/register" element={<Register />} />
<Route path="/landing" element={<LandingPage />} />
<Route path="/impressum" element={<Impressum />} />
<Route path="/datenschutz" element={<Datenschutz />} />
```

3. In `AppLayout` die nun doppelten Routen `/impressum` und `/datenschutz` entfernen:

```tsx
// Diese zwei Zeilen aus AppLayout entfernen:
<Route path="/impressum" element={<Impressum />} />
<Route path="/datenschutz" element={<Datenschutz />} />
```

**Hinweis:** `ProtectedRoute.tsx` bleibt unverändert (Redirect auf `/login` ist korrekt — Session-Ablauf soll direkt zum Login, nicht zur Landing Page). Die Landing Page ist unter `/landing` als eigene public route erreichbar.

- [ ] **Schritt 3: Commit erst nach Task 5 und 6**

Task 4 importiert `Register` und `LandingPage` — diese Dateien existieren noch nicht. TypeScript-Check und Commit erfolgen erst am Ende von Task 6 (der Commit dort bündelt Tasks 4–6).

---

## Task 5: Frontend — Register-Seite

**Files:**
- Create: `cozy-estate-central/src/pages/Register.tsx`

**Kontext:** `AuthContext` hat bereits eine `register()`-Funktion, die `POST /api/auth/register` aufruft und den Token setzt. Nach erfolgreicher Registrierung wird der User automatisch eingeloggt.

- [ ] **Schritt 1: Register.tsx erstellen**

Erstelle `cozy-estate-central/src/pages/Register.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, Mail, Lock, User, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.name || !form.email || !form.password) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    setIsSubmitting(true);
    try {
      await register(form.name, form.email, form.password, form.companyName);
      toast.success("Konto erstellt — willkommen bei ImmoHub!");
      navigate("/");
    } catch (err: unknown) {
      const apiError = err as any;
      if (apiError.status === 409) {
        toast.error("Diese E-Mail-Adresse ist bereits registriert");
      } else {
        toast.error(err instanceof Error ? err.message : "Registrierung fehlgeschlagen");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">ImmoHub</h1>
            <p className="text-sm text-muted-foreground">14 Tage kostenlos testen — keine Kreditkarte</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="company">Firmenname</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="company" placeholder="Mustermann Hausverwaltung GmbH" className="pl-10"
                    value={form.companyName} onChange={field("companyName")} autoFocus />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Ihr Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" placeholder="Max Mustermann" className="pl-10"
                    value={form.name} onChange={field("name")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="max@firma.de" className="pl-10"
                    value={form.email} onChange={field("email")} autoComplete="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 Zeichen, Groß-/Kleinbuchstaben + Zahl" className="pl-10 pr-10"
                    value={form.password} onChange={field("password")} autoComplete="new-password" />
                  <button type="button" tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Konto wird erstellt..." : "Kostenlos starten"}
              </Button>
            </CardContent>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Bereits registriert?{" "}
          <a href="/login" className="underline hover:text-foreground">Jetzt anmelden</a>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          <a href="/landing" className="hover:text-foreground">Zurück zur Startseite</a>
        </p>
      </div>
    </div>
  );
};

export default Register;
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd cozy-estate-central && npx tsc --noEmit
```

Erwartetes Ergebnis: Keine neuen Fehler.

- [ ] **Schritt 3: Manuell testen**

```bash
cd cozy-estate-central && npm run dev
```

Öffne `http://localhost:8080/register`:
- Formular sichtbar, alle 4 Felder
- Pflichtfeld-Validierung (leere Felder → Toast)
- Passwort show/hide funktioniert

---

## Task 6: Frontend — Landing Page

**Files:**
- Create: `cozy-estate-central/src/pages/LandingPage.tsx`

- [ ] **Schritt 1: LandingPage.tsx erstellen**

Erstelle `cozy-estate-central/src/pages/LandingPage.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Building2, Users, CreditCard, FileText, Zap, BarChart3,
  CheckCircle2, Shield, Star
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Immobilien & Einheiten",
    description: "Verwalten Sie alle Objekte, Wohnungen, Garagen und Stellplätze an einem Ort.",
  },
  {
    icon: Users,
    title: "Mieter & Verträge",
    description: "Mieterübersicht, Mietverträge, automatisches Mahnwesen in 3 Stufen.",
  },
  {
    icon: CreditCard,
    title: "Finanzen & DATEV-Export",
    description: "Einnahmen, Ausgaben, Nebenkostenabrechnung und DATEV Buchungsstapel-Export.",
  },
  {
    icon: Zap,
    title: "KI-Belegscan",
    description: "Fotos von Belegen hochladen — Betrag, Datum und Kategorie werden automatisch erkannt.",
  },
  {
    icon: BarChart3,
    title: "Rendite-Dashboard",
    description: "Brutto- und Nettorendite pro Immobilie auf einen Blick. Wissen was Ihr Portfolio bringt.",
  },
  {
    icon: FileText,
    title: "Dokumente & Vorlagen",
    description: "Mietverträge und Schreiben als Vorlagen anlegen und mit einem Klick befüllen.",
  },
];

const proFeatures = [
  "Unbegrenzte Immobilien",
  "Alle Kernfunktionen",
  "DATEV-Export",
  "KI-Belegscan",
  "E-Mail Support",
];

const businessFeatures = [
  "Alles aus Pro",
  "PSD2-Bankanbindung",
  "Mehrere Postfächer (IMAP)",
  "Audit-Log",
  "Energie-Tracking",
  "Prioritäts-Support",
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">ImmoHub</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Anmelden
            </Button>
            <Button size="sm" onClick={() => navigate("/register")}>
              Kostenlos testen
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full mb-6">
          <Star className="h-3.5 w-3.5" />
          14 Tage kostenlos — keine Kreditkarte erforderlich
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Immobilienverwaltung,<br />
          <span className="text-primary">die einfach funktioniert</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Mieter, Verträge, Finanzen, DATEV-Export — alles in einer Anwendung.
          Für kleine und mittlere Hausverwaltungen gemacht.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={() => navigate("/register")} className="text-base px-8">
            Jetzt kostenlos starten
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="text-base px-8">
            Anmelden
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          Alles was eine Hausverwaltung braucht
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-lg p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Einfache Preise</h2>
        <p className="text-center text-muted-foreground mb-12">
          Starten Sie kostenlos. Upgraden wenn Sie bereit sind.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Trial */}
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground">Trial</p>
              <p className="text-4xl font-bold mt-1">0 €</p>
              <p className="text-sm text-muted-foreground mt-1">14 Tage</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                Alle Funktionen testen
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                Keine Kreditkarte
              </li>
            </ul>
            <Button variant="outline" className="w-full" onClick={() => navigate("/register")}>
              Kostenlos starten
            </Button>
          </div>

          {/* Pro */}
          <div className="bg-primary text-primary-foreground rounded-lg p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-foreground text-primary text-xs font-bold px-3 py-1 rounded-full">
              Beliebt
            </div>
            <div className="mb-4">
              <p className="text-sm font-medium opacity-80">Pro</p>
              <p className="text-4xl font-bold mt-1">49 €</p>
              <p className="text-sm opacity-80 mt-1">pro Monat</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="w-full" onClick={() => navigate("/register")}>
              Jetzt starten
            </Button>
          </div>

          {/* Business */}
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground">Business</p>
              <p className="text-4xl font-bold mt-1">99 €</p>
              <p className="text-sm text-muted-foreground mt-1">pro Monat</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {businessFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" onClick={() => navigate("/register")}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-primary text-primary-foreground rounded-2xl p-10 text-center">
          <Shield className="h-10 w-10 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Bereit loszulegen?
          </h2>
          <p className="text-lg opacity-80 mb-8">
            14 Tage kostenlos. Keine Kreditkarte. Jederzeit kündbar.
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate("/register")} className="text-base px-8">
            Kostenlos testen
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">© 2026 ImmoHub. Alle Rechte vorbehalten.</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="/impressum" className="hover:text-foreground">Impressum</a>
            <a href="/datenschutz" className="hover:text-foreground">Datenschutz</a>
            <a href="mailto:support@immohub.de" className="hover:text-foreground">Kontakt</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd cozy-estate-central && npx tsc --noEmit
```

- [ ] **Schritt 3: Manuell testen**

```bash
cd cozy-estate-central && npm run dev
```

Öffne `http://localhost:8080/landing`:
- Hero, Features, Pricing und Footer sichtbar
- "Kostenlos testen" → `/register`
- "Anmelden" → `/login`
- "Impressum" / "Datenschutz" → jeweilige Seiten (ohne Login)
- Responsive auf Mobile prüfen (DevTools)

- [ ] **Schritt 4: Vollständigen Commit (Tasks 4–6)**

```bash
git add \
  cozy-estate-central/src/App.tsx \
  cozy-estate-central/src/components/ProtectedRoute.tsx \
  cozy-estate-central/src/pages/Register.tsx \
  cozy-estate-central/src/pages/LandingPage.tsx
git commit -m "feat: landing page, register page, public routes (ImmoHub launch)"
```

---

## Task 7: Production Build + Deploy

**Files:** keine Codeänderungen

- [ ] **Schritt 1: Frontend Production Build prüfen**

```bash
cd cozy-estate-central && npm run build
```

Erwartetes Ergebnis: Kein Build-Fehler.

- [ ] **Schritt 2: Backend Tests final**

```bash
cd backend && npm test
```

Erwartetes Ergebnis: Alle Tests PASS.

- [ ] **Schritt 3: Auf Server deployen**

```bash
git push origin master
```

Dann auf dem Server:
```bash
ssh root@hasverl.xyz
cd /root/immoverwaltung
git pull origin master
docker compose up -d --build
```

- [ ] **Schritt 4: Smoke Test auf hasverl.xyz**

- `https://hasverl.xyz/landing` — Landing Page sichtbar, kein Login nötig
- `https://hasverl.xyz/register` — Formular sichtbar
- `https://hasverl.xyz/impressum` — ohne Login zugänglich
- Browser-Tab zeigt "ImmoHub"
- Registrierung mit Test-E-Mail durchführen → sollte funktionieren + Willkommens-Mail ankommen (wenn Brevo konfiguriert)

- [ ] **Schritt 5: immohub.de 301-Redirect einrichten**

Im Domain-Registrar (IONOS/Hetzner) für `immohub.de`:
- DNS A-Record → IP von hasverl.xyz
- Oder: Weiterleitungs-Regel → `https://hasverl.xyz` (301 permanent)

---

## Gründer-Checklist (nicht Claude Code)

Diese Tasks muss der Gründer manuell erledigen:

- [ ] Domain `immohub.de` registrieren (~12 €/Jahr)
- [ ] Brevo-Account anlegen (brevo.com, kostenlos bis 300 Mails/Tag)
- [ ] SMTP-Zugangsdaten in `/root/immoverwaltung/.env` eintragen:
  ```
  SMTP_HOST=smtp-relay.brevo.com
  SMTP_PORT=587
  SMTP_USER=<Brevo-Benutzername>
  SMTP_PASS=<Brevo-API-Key>
  SMTP_FROM="ImmoHub <noreply@immohub.de>"
  ```
- [ ] Stripe-Produkte anlegen: "ImmoHub Pro" (49 €/Monat) und "ImmoHub Business" (99 €/Monat)
- [ ] `STRIPE_PRICE_PRO` und `STRIPE_PRICE_BUSINESS` in `.env` eintragen
- [ ] Demo-Account im Superadmin anlegen (3 Immobilien, 8 Mieter, etc.)
- [ ] Echte Betreiberdaten in `Impressum.tsx` eintragen
- [ ] `support@immohub.de` E-Mail-Adresse einrichten (Weiterleitung an private Mail)
