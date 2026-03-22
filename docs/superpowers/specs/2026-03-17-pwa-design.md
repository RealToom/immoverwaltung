# Design: Progressive Web App (PWA)

**Datum:** 2026-03-17
**Status:** Approved

## Zusammenfassung

Das Frontend (`cozy-estate-central`) wird als installierbare PWA konfiguriert. Nutzer können die App auf Android, iOS und Desktop wie eine native App installieren. Offline-Datenspeicherung ist nicht vorgesehen — nur die App-Shell wird gecacht. Ziel: installierbar + Fullscreen + App-Icon.

## Ansatz

`vite-plugin-pwa@^0.21.0` — generiert Web App Manifest und Service Worker automatisch aus der Vite-Konfiguration. Kompatibel mit dem Projekt's Vite 5.4.x.

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `cozy-estate-central/package.json` | `vite-plugin-pwa@^0.21.0` als devDependency |
| `cozy-estate-central/vite.config.ts` | Plugin einbinden + Manifest konfigurieren |
| `cozy-estate-central/index.html` | Theme-Color + Apple-Meta-Tags (favicon.ico behalten) |
| `cozy-estate-central/public/icons/` | App-Icons erstellen (einmalig, Ergebnis in Git committen) |
| `cozy-estate-central/scripts/generate-icons.js` | Einmaliges Skript: SVG → PNG mit `sharp` |

## vite.config.ts Konfiguration

```typescript
import { VitePWA } from "vite-plugin-pwa";

// In plugins array:
VitePWA({
  registerType: "autoUpdate",
  workbox: {
    navigateFallback: null,
    runtimeCaching: [],
  },
  manifest: {
    name: "Immoverwaltung",
    short_name: "Immo",
    description: "Webbasierte Immobilienverwaltung",
    theme_color: "#0f172a",
    background_color: "#0f172a",
    display: "standalone",
    orientation: "portrait",
    scope: "/",
    start_url: "/",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
})
```

**Hinweis zu `navigateFallback: null` + `runtimeCaching: []`:** Der Service Worker cacht statische Assets (JS/CSS), aber keine Navigation-Responses. Geht der Nutzer offline, schlägt das Laden fehl — es gibt keine künstliche Offline-Seite. Das ist akzeptabel für Option A (nur installierbar, kein Offline-Anspruch).

## Icons

Kein bestehendes Logo — einfaches Haus-Icon als SVG, weißes Symbol auf `#0f172a` Hintergrund.

**Zu erstellende Dateien in `public/icons/`:**

| Datei | Größe | Verwendung |
|-------|-------|-----------|
| `icon-32.png` | 32×32 | Favicon-Fallback |
| `icon-180.png` | 180×180 | Apple Touch Icon |
| `icon-192.png` | 192×192 | PWA manifest (any) |
| `icon-192-maskable.png` | 192×192 | PWA manifest (maskable, mit Padding) |
| `icon-512.png` | 512×512 | PWA manifest (any) |
| `icon-512-maskable.png` | 512×512 | PWA manifest (maskable, mit Padding) |

**Vorgehen:** `scripts/generate-icons.js` einmalig ausführen (`node scripts/generate-icons.js`), generierte PNGs in Git committen. Das Skript nutzt `sharp` (devDependency) und liest `public/icons/icon.svg` als Quelle. Maskable-Icons haben ~20% Padding (Safe Zone für adaptive Icons).

## index.html Ergänzungen

```html
<!-- bestehende Zeile BEHALTEN: -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />

<!-- neu hinzufügen: -->
<meta name="theme-color" content="#0f172a" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Immo" />
<link rel="apple-touch-icon" href="/icons/icon-180.png" />
```

`<link rel="manifest">` wird automatisch von `vite-plugin-pwa` in den Build injiziert — nicht manuell hinzufügen.

## HTTPS-Anforderung

PWA-Installierbarkeit erfordert HTTPS. Produktion (`hasverl.xyz`) hat bereits Let's Encrypt — kein Handlungsbedarf. Lokal funktioniert `localhost` als sicherer Ursprung für Tests.

## Was sich NICHT ändert

- Keine UI-Änderungen, keine neuen Seiten
- Kein API-Caching, keine Offline-Datenfunktionen
- Backend unverändert
- Routing, Auth, alle bestehenden Features unverändert
