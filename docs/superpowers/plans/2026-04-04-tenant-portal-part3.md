# Tenant Portal — Implementierungsplan Teil 3: Frontend Setup + Core Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tenant-portal/` Vite/React/PWA-Projekt aufsetzen, Auth-Flow implementieren, Branding-System, und die Core-Pages Login, AcceptInvite, Dashboard, Profil.

**Voraussetzung:** Teil 1 + Teil 2 abgeschlossen (Backend läuft auf Port 3001).

**Architecture:** Eigenständiges Vite-Projekt mit React 18 + TypeScript + Tailwind + Shadcn/UI + vite-plugin-pwa. URL-Schema `/:slug/*` — `slug` identifiziert die Hausverwaltung. Access Token im Memory, Refresh Token als httpOnly Cookie.

**Tech Stack:** Vite 5, React 18, TypeScript, Tailwind CSS 3, Shadcn/UI, TanStack Query v5, React Router v6, vite-plugin-pwa, date-fns

---

## Dateiübersicht Teil 3

| Aktion | Datei |
|--------|-------|
| Create | `tenant-portal/` (gesamtes Projekt) |
| Create | `tenant-portal/package.json` |
| Create | `tenant-portal/vite.config.ts` |
| Create | `tenant-portal/tsconfig.json` |
| Create | `tenant-portal/tailwind.config.ts` |
| Create | `tenant-portal/postcss.config.js` |
| Create | `tenant-portal/index.html` |
| Create | `tenant-portal/public/manifest.json` |
| Create | `tenant-portal/src/main.tsx` |
| Create | `tenant-portal/src/App.tsx` |
| Create | `tenant-portal/src/lib/api.ts` |
| Create | `tenant-portal/src/contexts/AuthContext.tsx` |
| Create | `tenant-portal/src/contexts/BrandingContext.tsx` |
| Create | `tenant-portal/src/hooks/useBranding.ts` |
| Create | `tenant-portal/src/components/ProtectedRoute.tsx` |
| Create | `tenant-portal/src/components/BottomNav.tsx` |
| Create | `tenant-portal/src/components/Layout.tsx` |
| Create | `tenant-portal/src/pages/Login.tsx` |
| Create | `tenant-portal/src/pages/AcceptInvite.tsx` |
| Create | `tenant-portal/src/pages/Dashboard.tsx` |
| Create | `tenant-portal/src/pages/Profile.tsx` |

---

## Task 15: Projekt initialisieren

**Files:**
- Create: `tenant-portal/package.json`
- Create: `tenant-portal/vite.config.ts`
- Create: `tenant-portal/tsconfig.json`
- Create: `tenant-portal/tailwind.config.ts`
- Create: `tenant-portal/postcss.config.js`
- Create: `tenant-portal/index.html`

- [ ] **Step 1: Vite-Projekt erstellen**

```bash
cd "C:/Users/tomsc/Documents/Sync/Privat/AI-Programming/immoverwaltung"
npm create vite@latest tenant-portal -- --template react-ts
cd tenant-portal
```

- [ ] **Step 2: Dependencies installieren**

```bash
cd tenant-portal
npm install @tanstack/react-query react-router-dom date-fns
npm install vite-plugin-pwa workbox-window
npm install -D tailwindcss postcss autoprefixer
npm install -D @types/node
npx tailwindcss init -p
```

- [ ] **Step 3: Shadcn/UI initialisieren**

```bash
cd tenant-portal
npx shadcn@latest init
```

Wenn gefragt:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

Dann folgende Komponenten hinzufügen:

```bash
npx shadcn@latest add button input label card badge toast sonner
```

- [ ] **Step 4: vite.config.ts erstellen**

Ersetze den Inhalt von `tenant-portal/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: false, // Wir nutzen public/manifest.json
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/tenant\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "tenant-api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 5: tsconfig.json anpassen**

Ersetze den Inhalt von `tenant-portal/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 6: tailwind.config.ts anpassen**

Ersetze den Inhalt von `tenant-portal/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 7: index.html anpassen**

Ersetze den Inhalt von `tenant-portal/index.html`:

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#2563eb" id="theme-color-meta" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="/manifest.json" />
    <title>Mieter-Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: public/manifest.json erstellen**

Erstelle `tenant-portal/public/manifest.json`:

```json
{
  "name": "Mieter-Portal",
  "short_name": "Mieter",
  "description": "Ihr persönliches Mieter-Portal",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

Platzhalter-Icons erstellen (werden später ersetzt):

```bash
cd tenant-portal/public
# Erstelle ein einfaches blaues 192x192 PNG als Platzhalter
node -e "
const { createCanvas } = require('canvas');
" 2>/dev/null || echo "canvas nicht installiert — Icons manuell als blaue 192x192 und 512x512 PNGs in tenant-portal/public/ ablegen (z.B. mit Paint oder online converter)"
```

Falls `canvas` nicht verfügbar: Lege zwei einfache PNG-Dateien `icon-192.png` und `icon-512.png` manuell in `tenant-portal/public/` ab (blauer Hintergrund, „M" als Text). Die PWA funktioniert auch ohne Icons.

- [ ] **Step 9: npm run dev testen**

```bash
cd tenant-portal
npm run dev
```

Erwartete Ausgabe:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Browser öffnen: http://localhost:5173/ — Vite-Startseite soll erscheinen.

- [ ] **Step 10: Commit**

```bash
cd ..
git add tenant-portal/
git commit -m "feat(tenant-portal): Vite + React + TypeScript + Tailwind + PWA project scaffold"
```

---

## Task 16: API-Client

**Files:**
- Create: `tenant-portal/src/lib/api.ts`

- [ ] **Step 1: api.ts erstellen**

Erstelle `tenant-portal/src/lib/api.ts`:

```typescript
// Access Token wird im Memory gehalten (nicht localStorage — XSS-Schutz)
let _accessToken: string | null = null;

export function setToken(token: string): void {
  _accessToken = token;
}

export function clearToken(): void {
  _accessToken = null;
}

export function getToken(): string | null {
  return _accessToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/tenant/refresh", {
      method: "POST",
      credentials: "include", // sends httpOnly cookie
    });
    if (!res.ok) return null;
    const json = await res.json();
    const token = json?.data?.accessToken as string | undefined;
    if (token) {
      setToken(token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, params } = options;

  let url = path.startsWith("http") ? path : `/api${path}`;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let res = await fetch(url, fetchOptions);

  // Auto-refresh on 401
  if (res.status === 401 && _accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, { ...fetchOptions, headers });
    } else {
      clearToken();
      throw new ApiError(401, "Sitzung abgelaufen. Bitte erneut anmelden.");
    }
  }

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const message = (json as any)?.error?.message ?? `Fehler ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Slug-aware helper: prepends /tenant/:slug to path
export function tenantApi<T = unknown>(
  slug: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  return api<T>(`/tenant/${slug}${path}`, options);
}
```

- [ ] **Step 2: Commit**

```bash
git add tenant-portal/src/lib/api.ts
git commit -m "feat(tenant-portal): API client with auto-refresh"
```

---

## Task 17: Branding Context + Hook

**Files:**
- Create: `tenant-portal/src/contexts/BrandingContext.tsx`
- Create: `tenant-portal/src/hooks/useBranding.ts`

- [ ] **Step 1: BrandingContext.tsx erstellen**

Erstelle `tenant-portal/src/contexts/BrandingContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Branding {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
}

interface BrandingContextType {
  branding: Branding | null;
  isLoading: boolean;
  error: string | null;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: null,
  isLoading: true,
  error: null,
});

export function BrandingProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Branding }>(`/tenant/company/${slug}`)
      .then((res) => {
        const b = res.data;
        setBranding(b);

        // Apply primary color as CSS variable
        applyBrandingColor(b.primaryColor);

        // Update page title
        document.title = `${b.name} — Mieter-Portal`;

        // Update PWA theme-color meta
        const meta = document.getElementById("theme-color-meta");
        if (meta) meta.setAttribute("content", b.primaryColor);
      })
      .catch(() => setError("Firma nicht gefunden"))
      .finally(() => setIsLoading(false));
  }, [slug]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, error }}>
      {children}
    </BrandingContext.Provider>
  );
}

function applyBrandingColor(hex: string) {
  // Convert hex to HSL for Tailwind CSS variables
  const { h, s, l } = hexToHsl(hex);
  const root = document.documentElement;
  root.style.setProperty("--primary", `${h} ${s}% ${l}%`);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--ring", `${h} ${s}% ${l}%`);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function useBranding() {
  return useContext(BrandingContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add tenant-portal/src/contexts/BrandingContext.tsx
git commit -m "feat(tenant-portal): BrandingContext — loads company branding, applies CSS vars"
```

---

## Task 18: Auth Context

**Files:**
- Create: `tenant-portal/src/contexts/AuthContext.tsx`

- [ ] **Step 1: AuthContext.tsx erstellen**

Erstelle `tenant-portal/src/contexts/AuthContext.tsx`:

```typescript
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, setToken, clearToken, tenantApi, ApiError } from "@/lib/api";

interface TenantMe {
  id: number;
  email: string;
  tenant: {
    id: number;
    name: string;
    phone: string;
    units: Array<{
      id: number;
      number: string;
      floor: number;
      area: number;
      rent: number;
      type: string;
      property: { street: string; zip: string; city: string; name: string };
    }>;
    contracts: Array<{
      id: number;
      monthlyRent: number;
      status: string;
      startDate: string;
    }>;
  };
}

interface AuthContextType {
  user: TenantMe | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(slug: string, email: string, password: string): Promise<void>;
  logout(slug: string): Promise<void>;
  refetchUser(slug: string): Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refetchUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TenantMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to restore session via refresh token on mount
  useEffect(() => {
    api<{ data: { accessToken: string } }>("/tenant/refresh", {
      method: "POST",
    })
      .then(async (res) => {
        setToken(res.data.accessToken);
        // We don't know the slug here — user will be fetched after routing
      })
      .catch(() => {
        // No valid session — user stays null
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (slug: string, email: string, password: string) => {
      const res = await api<{ data: { accessToken: string } }>(
        `/tenant/${slug}/auth/login`,
        { method: "POST", body: { email, password } }
      );
      setToken(res.data.accessToken);
      const meRes = await tenantApi<{ data: TenantMe }>(slug, "/me");
      setUser(meRes.data);
    },
    []
  );

  const logout = useCallback(async (slug: string) => {
    try {
      await tenantApi(slug, "/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearToken();
    setUser(null);
  }, []);

  const refetchUser = useCallback(async (slug: string) => {
    try {
      const res = await tenantApi<{ data: TenantMe }>(slug, "/me");
      setUser(res.data);
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add tenant-portal/src/contexts/AuthContext.tsx
git commit -m "feat(tenant-portal): AuthContext — login, logout, session restore"
```

---

## Task 19: App Router + Layout-Komponenten

**Files:**
- Create: `tenant-portal/src/main.tsx`
- Create: `tenant-portal/src/App.tsx`
- Create: `tenant-portal/src/components/ProtectedRoute.tsx`
- Create: `tenant-portal/src/components/BottomNav.tsx`
- Create: `tenant-portal/src/components/Layout.tsx`

- [ ] **Step 1: main.tsx erstellen**

Ersetze `tenant-portal/src/main.tsx`:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 2: App.tsx erstellen**

Erstelle `tenant-portal/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import AcceptInvite from "@/pages/AcceptInvite";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Documents from "@/pages/Documents";
import SignDocument from "@/pages/SignDocument";
import UploadDocument from "@/pages/UploadDocument";
import Tickets from "@/pages/Tickets";
import NewTicket from "@/pages/NewTicket";
import Finances from "@/pages/Finances";
import Messages from "@/pages/Messages";

function CompanyRoutes() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <div>Ungültige URL</div>;

  return (
    <BrandingProvider slug={slug}>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="invite/:token" element={<AcceptInvite />} />
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/:id/sign" element={<SignDocument />} />
          <Route path="documents/upload" element={<UploadDocument />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/new" element={<NewTicket />} />
          <Route path="finances" element={<Finances />} />
          <Route path="messages" element={<Messages />} />
          <Route path="profile" element={<Profile />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </BrandingProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/:slug/*" element={<CompanyRoutes />} />
          <Route path="*" element={<div className="p-8 text-center text-gray-500">Seite nicht gefunden</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: ProtectedRoute.tsx erstellen**

Erstelle `tenant-portal/src/components/ProtectedRoute.tsx`:

```typescript
import { useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute() {
  const { user, isLoading, isAuthenticated, refetchUser } = useAuth();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    // If we have a token (from refresh) but no user yet, fetch user
    if (!isLoading && !user && slug) {
      refetchUser(slug);
    }
  }, [isLoading, user, slug, refetchUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${slug}/login`} replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 4: BottomNav.tsx erstellen**

Erstelle `tenant-portal/src/components/BottomNav.tsx`:

```typescript
import { NavLink, useParams } from "react-router-dom";
import { Home, FileText, AlertCircle, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "dashboard", icon: Home, label: "Start" },
  { to: "documents", icon: FileText, label: "Dokumente" },
  { to: "tickets", icon: AlertCircle, label: "Tickets" },
  { to: "messages", icon: MessageSquare, label: "Nachrichten" },
  { to: "profile", icon: User, label: "Profil" },
];

export function BottomNav() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe z-50">
      <div className="flex">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={`/${slug}/${to}`}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-gray-400"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn("w-5 h-5", isActive ? "stroke-primary" : "stroke-gray-400")}
                  strokeWidth={1.75}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Layout.tsx erstellen**

Erstelle `tenant-portal/src/components/Layout.tsx`:

```typescript
import { BottomNav } from "./BottomNav";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";

interface LayoutProps {
  title?: string;
  showBack?: boolean;
  children: React.ReactNode;
}

export function Layout({ title, children }: LayoutProps) {
  const { branding } = useBranding();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} className="h-7 object-contain" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white text-sm font-bold">
              {(branding?.name ?? "M")[0]}
            </div>
          )}
          <span className="text-sm font-semibold text-gray-800 truncate max-w-[160px]">
            {title ?? branding?.name ?? "Mieter-Portal"}
          </span>
        </div>
        {user && (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {user.tenant.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 6: lucide-react installieren**

```bash
cd tenant-portal
npm install lucide-react
```

- [ ] **Step 7: TypeScript prüfen**

```bash
cd tenant-portal
npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler (außer fehlende Pages — die kommen in Task 20-22)

- [ ] **Step 8: Commit**

```bash
cd ..
git add tenant-portal/src/
git commit -m "feat(tenant-portal): App router, Layout, BottomNav, ProtectedRoute"
```

---

## Task 20: Login + AcceptInvite Pages

**Files:**
- Create: `tenant-portal/src/pages/Login.tsx`
- Create: `tenant-portal/src/pages/AcceptInvite.tsx`

- [ ] **Step 1: Login.tsx erstellen**

Erstelle `tenant-portal/src/pages/Login.tsx`:

```typescript
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

export default function Login() {
  const { slug } = useParams<{ slug: string }>();
  const { login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    setLoading(true);
    try {
      await login(slug, email, password);
      navigate(`/${slug}/dashboard`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12 pb-8 max-w-md mx-auto">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.name} className="h-16 object-contain mb-3" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-lg shadow-primary/30">
            {(branding?.name ?? "M")[0]}
          </div>
        )}
        <h2 className="text-base font-semibold text-gray-800">
          {branding?.name ?? "Hausverwaltung"}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Mieter-Portal</p>
      </div>

      {/* Form */}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Willkommen zurück</h1>
      <p className="text-sm text-gray-500 mb-6">Melden Sie sich mit Ihrer E-Mail an</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="max.mustermann@email.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Anmelden..." : "Anmelden"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-gray-400">
        Probleme? Kontaktieren Sie Ihre Hausverwaltung.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: AcceptInvite.tsx erstellen**

Erstelle `tenant-portal/src/pages/AcceptInvite.tsx`:

```typescript
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { api, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

const steps = ["Einladung", "Passwort", "Fertig"];

export default function AcceptInvite() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const { branding } = useBranding();
  const { refetchUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = confirm, 2 = set password
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validatePassword() {
    if (password.length < 8) return "Mindestens 8 Zeichen";
    if (!/[A-Z]/.test(password)) return "Mindestens einen Großbuchstaben";
    if (!/[0-9]/.test(password)) return "Mindestens eine Zahl";
    if (password !== passwordConfirm) return "Passwörter stimmen nicht überein";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!slug || !token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ data: { accessToken: string } }>(
        `/tenant/${slug}/auth/accept-invite`,
        { method: "POST", body: { token, password } }
      );
      setToken(res.data.accessToken);
      await refetchUser(slug);
      navigate(`/${slug}/dashboard`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Fehler beim Aktivieren. Bitte versuchen Sie es erneut.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12 pb-8 max-w-md mx-auto">
      {/* Logo */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-lg shadow-primary/30">
          {(branding?.name ?? "M")[0]}
        </div>
        <h2 className="text-sm font-semibold text-gray-800">{branding?.name ?? "Hausverwaltung"}</h2>
        <p className="text-xs text-gray-400">Mieter-Portal</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-6">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-primary" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Konto einrichten</h1>
      <p className="text-sm text-gray-500 mb-6">
        Willkommen! Wählen Sie ein sicheres Passwort für Ihr Konto.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Neues Passwort</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mindestens 8 Zeichen"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (step < 2) setStep(2);
            }}
            required
          />
          <p className="text-xs text-gray-400">
            Mindestens 8 Zeichen, ein Großbuchstabe, eine Zahl
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Passwort bestätigen</Label>
          <Input
            id="confirm"
            type="password"
            placeholder="Passwort wiederholen"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Aktivieren..." : "Konto aktivieren"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add tenant-portal/src/pages/Login.tsx tenant-portal/src/pages/AcceptInvite.tsx
git commit -m "feat(tenant-portal): Login + AcceptInvite pages"
```

---

## Task 21: Dashboard Page

**Files:**
- Create: `tenant-portal/src/pages/Dashboard.tsx`
- Create: `tenant-portal/src/hooks/api/useTenantMe.ts`
- Create: `tenant-portal/src/hooks/api/useTenantFinances.ts`
- Create: `tenant-portal/src/hooks/api/useTenantTickets.ts`

- [ ] **Step 1: API Hooks erstellen**

Erstelle `tenant-portal/src/hooks/api/useTenantMe.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";
import { useParams } from "react-router-dom";

export function useTenantMe() {
  const { slug } = useParams<{ slug: string }>();
  return useQuery({
    queryKey: ["tenant-me", slug],
    queryFn: () => tenantApi<{ data: any }>(slug!, "/me").then((r) => r.data),
    enabled: !!slug,
  });
}
```

Erstelle `tenant-portal/src/hooks/api/useTenantFinances.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";
import { useParams } from "react-router-dom";

export function useTenantFinances() {
  const { slug } = useParams<{ slug: string }>();
  return useQuery({
    queryKey: ["tenant-finances", slug],
    queryFn: () =>
      tenantApi<{ data: { payments: any[]; nextPayment: any | null } }>(
        slug!,
        "/finances"
      ).then((r) => r.data),
    enabled: !!slug,
  });
}
```

Erstelle `tenant-portal/src/hooks/api/useTenantTickets.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";
import { useParams } from "react-router-dom";

export function useTenantTickets() {
  const { slug } = useParams<{ slug: string }>();
  return useQuery({
    queryKey: ["tenant-tickets", slug],
    queryFn: () =>
      tenantApi<{ data: any[] }>(slug!, "/tickets").then((r) => r.data),
    enabled: !!slug,
  });
}
```

- [ ] **Step 2: Dashboard.tsx erstellen**

Erstelle `tenant-portal/src/pages/Dashboard.tsx`:

```typescript
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useTenantMe } from "@/hooks/api/useTenantMe";
import { useTenantFinances } from "@/hooks/api/useTenantFinances";
import { useTenantTickets } from "@/hooks/api/useTenantTickets";
import { FileText, AlertCircle, Euro, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const statusColors: Record<string, string> = {
  OFFEN: "bg-red-100 text-red-700",
  IN_BEARBEITUNG: "bg-yellow-100 text-yellow-700",
  ERLEDIGT: "bg-green-100 text-green-700",
};

const paymentColors: Record<string, string> = {
  PUENKTLICH: "text-green-600",
  VERSPAETET: "text-red-600",
  AUSSTEHEND: "text-yellow-600",
};

export default function Dashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: me } = useTenantMe();
  const { data: finances } = useTenantFinances();
  const { data: tickets } = useTenantTickets();

  const activeUnit = me?.units?.[0];
  const address = activeUnit?.property
    ? `${activeUnit.property.street}, Wohnung ${activeUnit.number}`
    : "";

  const openTickets = tickets?.filter((t) =>
    ["OFFEN", "IN_BEARBEITUNG"].includes(t.status)
  ) ?? [];

  const nextPayment = finances?.nextPayment;
  const lastPayment = finances?.payments?.[0];

  const quickActions = [
    { icon: FileText, label: "Dokumente", to: "documents", color: "bg-blue-50" },
    { icon: AlertCircle, label: "Schaden melden", to: "tickets/new", color: "bg-yellow-50" },
    { icon: Euro, label: "Finanzen", to: "finances", color: "bg-green-50" },
    { icon: MessageSquare, label: "Nachrichten", to: "messages", color: "bg-purple-50" },
  ];

  return (
    <Layout>
      {/* Hero card */}
      <div className="mx-3 mt-3 rounded-xl bg-primary p-4 text-white shadow-md">
        <p className="text-sm opacity-85">Guten Tag,</p>
        <p className="text-xl font-bold mt-0.5">{me?.tenant?.name ?? "..."}</p>
        {address && <p className="text-xs opacity-75 mt-1">📍 {address}</p>}
        <div className="flex gap-3 mt-3">
          <div className="flex-1 bg-white/15 rounded-lg p-2">
            <p className="text-base font-bold">
              {nextPayment
                ? `${nextPayment.amountDue.toLocaleString("de-DE")} €`
                : me?.contracts?.[0]?.monthlyRent
                ? `${me.contracts[0].monthlyRent.toLocaleString("de-DE")} €`
                : "—"}
            </p>
            <p className="text-[10px] opacity-80 mt-0.5">Nächste Miete</p>
          </div>
          <div className="flex-1 bg-white/15 rounded-lg p-2">
            <p className="text-base font-bold">
              {nextPayment
                ? format(new Date(nextPayment.dueDate), "dd.MM.", { locale: de })
                : "—"}
            </p>
            <p className="text-[10px] opacity-80 mt-0.5">Fällig am</p>
          </div>
          <div className="flex-1 bg-white/15 rounded-lg p-2">
            <p className="text-base font-bold">{openTickets.length} offen</p>
            <p className="text-[10px] opacity-80 mt-0.5">Tickets</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 mx-3 mt-2">
        {quickActions.map(({ icon: Icon, label, to, color }) => (
          <button
            key={to}
            onClick={() => navigate(`/${slug}/${to}`)}
            className="bg-white rounded-xl p-3 flex flex-col items-start gap-2 shadow-sm text-left"
          >
            <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center`}>
              <Icon className="w-4 h-4 text-gray-600" strokeWidth={1.75} />
            </div>
            <span className="text-xs font-semibold text-gray-700">{label}</span>
          </button>
        ))}
      </div>

      {/* Open tickets */}
      {openTickets.length > 0 && (
        <>
          <div className="flex justify-between items-center px-3 pt-4 pb-1">
            <h2 className="text-base font-bold text-gray-800">Aktuelle Tickets</h2>
            <button
              onClick={() => navigate(`/${slug}/tickets`)}
              className="text-xs text-primary font-semibold"
            >
              Alle anzeigen
            </button>
          </div>
          <div className="mx-3 bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {openTickets.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.status === "OFFEN" ? "bg-red-500" : "bg-yellow-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(t.createdAt), "dd.MM.yyyy", { locale: de })}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[t.status] ?? "bg-gray-100 text-gray-500"}`}
                >
                  {t.status === "IN_BEARBEITUNG" ? "In Bearb." : t.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Last payment */}
      {lastPayment && (
        <>
          <div className="px-3 pt-4 pb-1">
            <h2 className="text-base font-bold text-gray-800">Letzte Zahlung</h2>
          </div>
          <div className="mx-3 mb-4 bg-white rounded-xl shadow-sm px-3 py-2.5 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center text-green-600 font-bold text-sm flex-shrink-0">
              ✓
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">
                Miete {format(new Date(lastPayment.month), "MMMM yyyy", { locale: de })}
              </p>
              <p className="text-xs text-gray-400">
                {format(new Date(lastPayment.dueDate), "dd.MM.yyyy", { locale: de })}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${paymentColors[lastPayment.status] ?? "text-gray-600"}`}>
                {lastPayment.amountDue.toLocaleString("de-DE")} €
              </p>
              <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                {lastPayment.status === "PUENKTLICH" ? "Bezahlt" : lastPayment.status}
              </span>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add tenant-portal/src/hooks/ tenant-portal/src/pages/Dashboard.tsx
git commit -m "feat(tenant-portal): Dashboard page + API hooks"
```

---

## Task 22: Profile Page

**Files:**
- Create: `tenant-portal/src/pages/Profile.tsx`

- [ ] **Step 1: Profile.tsx erstellen**

Erstelle `tenant-portal/src/pages/Profile.tsx`:

```typescript
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useTenantMe } from "@/hooks/api/useTenantMe";
import { useAuth } from "@/contexts/AuthContext";
import { tenantApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function Profile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: me, isLoading } = useTenantMe();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setPhone(me?.tenant?.phone ?? "");
    setEmail(me?.email ?? "");
    setEditing(true);
    setError(null);
  }

  async function saveEdit() {
    if (!slug) return;
    setSaving(true);
    setError(null);
    try {
      await tenantApi(slug, "/me", {
        method: "PATCH",
        body: { phone, email },
      });
      queryClient.invalidateQueries({ queryKey: ["tenant-me", slug] });
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout(slug!);
    navigate(`/${slug}/login`, { replace: true });
  }

  if (isLoading) {
    return (
      <Layout title="Profil">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const unit = me?.units?.[0];
  const contract = me?.contracts?.[0];

  return (
    <Layout title="Profil">
      {/* Profile header */}
      <div className="bg-primary px-4 pt-6 pb-5 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-2xl font-bold mb-2">
          {(me?.tenant?.name ?? "M").slice(0, 2).toUpperCase()}
        </div>
        <p className="text-white font-bold text-lg">{me?.tenant?.name}</p>
        <p className="text-white/75 text-xs mt-0.5">{me?.email}</p>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Mietdaten */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Mietdaten
          </p>
          {unit && (
            <>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500">Einheit</span>
                <span className="text-xs font-medium text-gray-800">
                  {unit.type === "WOHNUNG" ? "Wohnung" : unit.type} {unit.number}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500">Adresse</span>
                <span className="text-xs font-medium text-gray-800 text-right">
                  {unit.property.street}, {unit.property.zip} {unit.property.city}
                </span>
              </div>
            </>
          )}
          {contract && (
            <div className="flex justify-between py-2">
              <span className="text-xs text-gray-500">Miete seit</span>
              <span className="text-xs font-medium text-gray-800">
                {format(new Date(contract.startDate), "dd.MM.yyyy", { locale: de })}
              </span>
            </div>
          )}
        </div>

        {/* Kontaktdaten */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Kontaktdaten
            </p>
            {!editing && (
              <button
                onClick={startEdit}
                className="text-xs text-primary font-semibold"
              >
                Bearbeiten
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditing(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={saveEdit}
                  disabled={saving}
                >
                  {saving ? "Speichern..." : "Speichern"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500">E-Mail</span>
                <span className="text-xs font-medium text-gray-800">{me?.email}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-gray-500">Telefon</span>
                <span className="text-xs font-medium text-gray-800">
                  {me?.tenant?.phone || "—"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Abmelden */}
        <div className="pb-2">
          <Button
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50"
            onClick={handleLogout}
          >
            Abmelden
          </Button>
        </div>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add tenant-portal/src/pages/Profile.tsx
git commit -m "feat(tenant-portal): Profile page with edit + logout"
```

---

## Task 23: Smoke-Test im Browser

- [ ] **Step 1: Backend + Frontend starten**

Terminal 1:
```bash
cd backend
npm run dev
```

Terminal 2:
```bash
cd tenant-portal
npm run dev
```

- [ ] **Step 2: Login testen**

Browser öffnen: `http://localhost:5173/mustermann-hv/login`

Erwartetes Verhalten:
- Seite lädt mit Branding (Firmenname "Mustermann Hausverwaltung GmbH")
- Primärfarbe blau (#2563eb)
- Login-Formular sichtbar

Mit Test-Credentials aus Teil 1 anmelden (`test@mieter.de` / `Test123!`):
- Redirect auf `/mustermann-hv/dashboard`
- Dashboard zeigt Mieterdaten, Quick Actions, BottomNav

- [ ] **Step 3: Navigation testen**

- Auf "Profil" tippen → Profil-Seite
- Auf "Bearbeiten" tippen → Inline-Form erscheint
- Abbrechen → Form verschwindet

- [ ] **Step 4: PWA-Manifest prüfen**

Chrome DevTools → Application → Manifest:
- Name: "Mieter-Portal"
- Icons vorhanden (oder Fehler wegen fehlender PNG — normal für jetzt)
- `start_url: "/"`

- [ ] **Step 5: Abschließender Commit**

```bash
git add tenant-portal/
git commit -m "feat(tenant-portal): Teil 3 complete — Setup, Auth, Branding, Dashboard, Profile, Login, AcceptInvite"
```

---

## Teil 3 abgeschlossen

**Was gebaut wurde:**
- `tenant-portal/` Vite + React + TypeScript + Tailwind + Shadcn/UI + PWA
- API-Client mit Auto-Token-Refresh
- `BrandingContext` — lädt Company-Branding, setzt CSS-Variablen + `<title>`
- `AuthContext` — Login, Logout, Session-Restore via Refresh-Cookie
- App-Router mit `/:slug/*` Pattern
- `ProtectedRoute` — prüft Auth, zeigt Spinner beim Laden
- `Layout` + `BottomNav` mit SVG-Icons (Lucide)
- Pages: **Login**, **AcceptInvite**, **Dashboard**, **Profile**
- API Hooks: `useTenantMe`, `useTenantFinances`, `useTenantTickets`

**Weiter mit:** `2026-04-04-tenant-portal-part4.md` — Dokumente + Signatur, Upload, Tickets, Finanzen, Nachrichten + Admin-UI-Erweiterungen (Invite-Button in Tenants.tsx)
