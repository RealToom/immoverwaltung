# ImmoHub — Go-to-Market Spec

## Ziel

ImmoHub (ehemals intern "Immoverwaltung") soll innerhalb von 6 Wochen erste zahlende Kunden gewinnen. Die Basis sind persönliche Kontakte des Gründers in der Immobilienbranche, ergänzt durch eine professionelle öffentliche Präsenz.

## Marke

**Produktname:** ImmoHub
**Domain:** immohub.de (zu registrieren)
**Positionierung:** "Die einfache Immobilienverwaltung für kleine und mittlere Hausverwaltungen — alles in einem: Mieter, Verträge, Finanzen, DATEV-Export."

**Zielgruppe:** Kleine und mittlere Hausverwaltungen mit 5–200 Einheiten, 1–10 Mitarbeiter. Brauchen DATEV-Export, Mahnwesen, Nebenkostenabrechnung — wollen keine teure Enterprise-Software.

## Pricing

| Plan | Preis | Zielgruppe |
|------|-------|-----------|
| Trial | 14 Tage kostenlos | Alle Neukunden |
| Pro | 49 €/Monat | Kleine Hausverwaltungen |
| Business | 99 €/Monat | Mittlere Hausverwaltungen |

## Domain-Strategie

**Phase 1 (Launch):** Die App bleibt auf `hasverl.xyz`. Die Landing Page wird dort unter `/` eingebunden. `immohub.de` leitet per 301-Redirect auf `hasverl.xyz` um (konfiguriert beim Domain-Registrar, kein Nginx-Aufwand).

**Phase 2 (nach ersten Kunden):** Migration auf `immohub.de` als primäre Domain — separater Aufwand, nicht Teil dieses Plans.

## Technische Deliverables

### 1. Landing Page (`hasverl.xyz/`)

Öffentliche Marketing-Seite als eigene Route `/` (wenn nicht eingeloggt). Abschnitte:

- **Hero:** Headline + Subline + zwei CTAs: "Kostenlos testen" → `/register` und "Demo anschauen" → Demo-Account-Login
- **Features:** 6 Kernfeatures mit Icon + kurzer Beschreibung
  - Mieter & Verträge
  - Finanzen & DATEV-Export
  - Nebenkostenabrechnung
  - KI-Belegscan
  - PSD2-Bankanbindung
  - Mahnwesen
- **Pricing:** Drei Spalten (Trial / Pro / Business) mit Feature-Liste
- **CTA-Banner:** "Jetzt 14 Tage kostenlos testen"
- **Footer:** Impressum, Datenschutz, Kontakt

Technisch: neue React-Seite `LandingPage.tsx`, öffentliche Route in `App.tsx`. Kein Auth erforderlich. Responsive (Mobile-first). Unauthenticated-Redirect auf `/` statt auf `/login` (anpassen in `App.tsx`).

### 2. Self-Service-Registrierung

Der CTA "Kostenlos testen" führt auf `/register`. Der bestehende Register-Endpunkt (`POST /api/auth/register`) legt automatisch eine neue Company + Admin-User an und startet den 14-Tage-Trial.

Felder: Firmenname, Vorname, Nachname, E-Mail, Passwort. Nach Registrierung: automatische Weiterleitung auf Dashboard + Willkommens-Mail wird ausgelöst.

**Entscheidung:** Kein manueller Tenant-Anlage-Flow für Inbound-Traffic — Self-Service muss funktionieren damit der Landing-Page-CTA einen echten Funnel erzeugt.

### 3. UI-Umbenennung auf ImmoHub

Alle Stellen im Frontend wo der alte Name oder "Immoverwaltung" steht:
- Browser-Tab (`<title>`)
- Login-Screen / Register-Screen
- E-Mail-Vorlagen (Willkommens-Mail, Passwort-Reset)
- `manifest.json` (PWA-Name)
- Meta-Tags

### 4. Impressum & Datenschutz

Zwei statische Seiten, rechtlich notwendig für Deutschland:
- `/impressum` — Name, Adresse, Kontakt des Betreibers
- `/datenschutz` — DSGVO-konforme Datenschutzerklärung (Vorlage in `VERARBEITUNGSVERZEICHNIS.md` vorhanden)

Beide Seiten sind public routes ohne Auth.

### 5. Brevo SMTP einrichten + Willkommens-Mail

- Gründer trägt SMTP-Zugangsdaten in `/root/immoverwaltung/.env` ein (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
- Support-Kontakt festlegen: `support@immohub.de` (Weiterleitung an private Mail)
- Willkommens-Mail beim Self-Service-Register: "Willkommen bei ImmoHub", Login-URL, Support-E-Mail

### 6. Stripe-Produkte konfigurieren

- Zwei Produkte in Stripe Dashboard anlegen: "ImmoHub Pro" (49 €/Monat) und "ImmoHub Business" (99 €/Monat)
- Price-IDs in `/root/immoverwaltung/.env` eintragen: `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`

### 7. Demo-Account mit Beispieldaten

- Tenant "Demo Hausverwaltung GmbH" im Superadmin anlegen, `manualOverride=true` setzen
- Befüllung mit: 3 Immobilien, 8 Mieter, aktive Verträge, Finanztransaktionen, 1 offene Mahnung
- Login-Daten werden dem Gründer separat mitgeteilt (nicht im Spec gespeichert)
- Demo-Account bleibt dauerhaft aktiv (kein Trial-Ablauf durch manualOverride)

## 6-Wochen-Zeitplan

### Woche 1–2: Technische Basis (Code-Tasks)

| Task | Art |
|------|-----|
| Landing Page (`LandingPage.tsx`) | Claude Code |
| UI auf "ImmoHub" umbenennen | Claude Code |
| Impressum + Datenschutz Seiten | Claude Code |
| Self-Service-Register-Flow prüfen/testen | Claude Code |
| Domain `immohub.de` registrieren + 301-Redirect | Gründer |
| Brevo-Account anlegen, SMTP-Daten eintragen | Gründer |
| Stripe-Produkte anlegen, Price-IDs eintragen | Gründer |
| Demo-Account im Superadmin befüllen | Gründer |
| Support-E-Mail `support@immohub.de` einrichten | Gründer |

### Woche 3: Kontakte aktivieren

- Persönliche Nachricht an jeden Immobilien-Kontakt (individuell, kein Newsletter)
- Angebot: 14-Tage-Trial + kurzer Demo-Call
- Ziel: 5–10 aktive Trials
- Demo-Account-Login als Vorschau für Interessenten ohne Registrierung

### Woche 4–5: Trials zu Kunden machen

- Nach 3–4 Tagen Trial proaktiv nachfragen: "Alles in Ordnung? Fragen?"
- "Aktiver Trial" = mindestens 1 Immobilie oder 1 Mieter angelegt
- Bei positivem Feedback: auf Bezahl-Plan ansprechen → Stripe Checkout via `/settings → Abonnement`
- 1–2 konkrete Feedback-Punkte sofort umsetzen

### Woche 6: Erste Wachstumswelle

- Zufriedene Kunden aktiv um Weiterempfehlung bitten
- LinkedIn-Post: "ImmoHub ist live" (authentische Story, kein Sales-Text)
- Grundlage für nächste Outreach-Welle legen

## Out of Scope (nach Launch)

Features bereits gebaut, werden erst nach ersten Kunden aktiv vermarktet:
- 2FA / TOTP
- Digitale Unterschrift (Yousign)
- Energie-Tracking
- Migration auf `immohub.de` als primäre Domain

## Erfolgskriterien

| Milestone | Wann | Messung |
|-----------|------|---------|
| Landing Page live | Woche 2 | URL erreichbar |
| UI umbenannt | Woche 2 | "ImmoHub" in Browser-Tab |
| 5+ aktive Trials | Woche 3 | Superadmin: 5+ Companies mit Trial-Status + mind. 1 Objekt angelegt |
| 2+ zahlende Kunden | Woche 6 | Stripe Dashboard: 2+ aktive Subscriptions |
