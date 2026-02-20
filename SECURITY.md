# Sicherheitsanalyse - Immoverwaltung Backend

> **Erstellt:** 2026-02-11
> **Letzte Aktualisierung:** 2026-02-20

---

## Bereits behoben

| # | Problem | Fix | Datei |
|---|---------|-----|-------|
| 1 | Keine Security-Headers (XSS, Clickjacking, MIME-Sniffing) | `helmet` Middleware installiert und aktiviert | `app.ts` |
| 2 | Kein Body-Size-Limit bei `express.json()` | `express.json({ limit: "1mb" })` gesetzt | `app.ts` |
| 3 | Keine Max-Laenge auf String-Feldern in Zod-Schemas | `.max()` auf allen String-Feldern in allen Schemas | `schemas/*.schema.ts` |
| 4 | Refresh-Token-Cookie ohne `Secure`-Flag | `Secure`-Flag wird in Production gesetzt | `auth.controller.ts` |
| 5 | Error-Handler loggt Stack-Trace in Production | In Production wird nur `err.message` geloggt | `errorHandler.ts` |
| 6 | Passwort-Minimum nur 6 Zeichen | Auf 8 Zeichen erhoeht | `auth.schema.ts` |
| H1 | Kein Rate-Limiting auf Auth-Endpunkten | `authLimiter` (10 req/15min/IP) auf Login/Register/Refresh | `rateLimiter.ts`, `auth.routes.ts` |
| H2 | Refresh-Tokens nicht in DB gespeichert | `RefreshToken` Model, Rotation + Revocation bei Logout | `schema.prisma`, `auth.service.ts` |
| H3 | Keine RBAC | `requireRole()` Middleware auf allen Schreib-Endpunkten | `requireRole.ts`, alle `routes/*.ts` |
| M1 | Kein Account-Lockout | 10 Versuche → 30 Min Sperre (`failedLoginAttempts` + `lockedUntil`) | `schema.prisma`, `auth.service.ts` |
| M2 | Keine Passwort-Komplexitaet | Regex: mind. 1 Gross/Klein + 1 Ziffer | `auth.schema.ts` |
| M3 | CORS hardcodiert auf localhost | `CORS_ORIGINS` Env-Var (Wildcard in Production verboten) | `config/cors.ts` |
| M4 | `as never` Type-Casting in Services | Typisierte Interfaces | mehrere Services |
| M5 | Kein Request-Logging | Pino + pino-http (JSON structured logging) | `app.ts`, `lib/logger.ts` |
| S1 | Kein Rate-Limit auf sensitiven Admin-Aktionen | `adminActionLimiter` (5 req/15min) auf reset-password + unlock | `rateLimiter.ts`, `user.routes.ts` |
| S2 | CORS Wildcard in Production erlaubt | Fehler beim Start wenn `CORS_ORIGINS=*` in Production | `config/cors.ts` |
| S3 | Passwoerter mit `Math.random()` generiert (nicht kryptografisch sicher) | `crypto.randomBytes()` aus Node.js crypto-Modul | `user.service.ts` |
| S4 | Bcrypt-Cost hardcodiert auf 10 (veraltet) | Konfigurierbar via `BCRYPT_COST` (Default 12), Validierung 10-15 | `config/env.ts`, `auth.service.ts`, `user.service.ts` |
| S5 | Datei-Extension vom Client uebernommen (Double-Extension-Angriff) | Extension immer aus MIME-Whitelist ableiten (`MIME_TO_EXT`) | `middleware/upload.ts` |
| S6 | Fehlende Security-Headers bei Datei-Downloads | `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `X-Frame-Options: DENY` | `controllers/document.controller.ts` |
| S7 | Audit-Log via `console.log()` (kein strukturiertes Logging) | Pino-Logger mit `audit: true` Feld | `controllers/document.controller.ts` |
| S8 | Dateinamen nicht sanitiert (Path-Traversal, Header-Injection) | Sonderzeichen entfernen, auf 255 Zeichen begrenzen | `controllers/document.controller.ts` |
| S9 | `ANTHROPIC_API_KEY` ohne Startup-Validierung | Pruefung beim Start + Fehlermeldung wenn nicht gesetzt | `config/env.ts`, `controllers/receipt.controller.ts` |
| S10 | `ENCRYPTION_KEY` optional ohne Warnung | Startup: Fehler in Production, Warnung in Development | `index.ts` |
| S11 | Temporaere Scan-Dateien bei Fehler lautlos nicht geloescht | `unlink`-Fehler werden geloggt | `controllers/receipt.controller.ts` |
| S12 | Transaktionsbetrag ohne Cent-Praezision | `.multipleOf(0.01)` in Zod-Schema | `schemas/finance.schema.ts` |
| N5 | Health-Endpoint gibt Timestamp preis | Timestamp entfernt aus `/health` Response | `app.ts` |
| N1a | Keine HSTS-Header | `helmet({ hsts: { maxAge: 31536000, includeSubDomains, preload } })` | `app.ts` |
| N1b | Kein Referrer-Policy-Header | `helmet({ referrerPolicy: { policy: "no-referrer" } })` | `app.ts` |

---

## Offene Sicherheitsluecken (nach Prioritaet)

### NIEDRIG

#### N1: Kein HTTPS-Enforcement am Reverse-Proxy
- **Betrifft:** Deployment-Konfiguration
- **Risiko:** Wenn kein nginx/Caddy vorgeschaltet ist, werden Daten unverschluesselt uebertragen. HSTS-Header sind gesetzt, aber erfordern HTTPS am Proxy.
- **Loesung:** nginx mit certbot oder Caddy mit automatischem Let's Encrypt. DEPLOYMENT.md beschreibt den Aufbau.
- **Aufwand:** Deployment-abhaengig

#### N2: Keine CSRF-Protection
- **Betrifft:** `POST /auth/refresh`
- **Risiko:** Refresh-Token ist httpOnly Cookie mit `SameSite=Lax`. API-Endpunkte selbst sind durch Bearer-Token geschuetzt und damit nicht CSRF-angreifbar. Nur der Refresh-Endpunkt ist theoretisch betroffen.
- **Loesung:** `SameSite=Strict` setzen (verhindert auch legitime Cross-Origin-Flows), oder CSRF-Token implementieren.
- **Aufwand:** Mittel (2-4 Stunden)

#### N3: npm audit Schwachstellen
- **Betrifft:** `node_modules/`
- **Loesung:** Regelmaessig `npm audit` ausfuehren und Patches einspielen.
- **Aufwand:** Laufend

#### N4: Keine Magic-Bytes-Validierung bei Datei-Uploads
- **Betrifft:** `middleware/upload.ts`
- **Risiko:** MIME-Typ wird aus dem Content-Type-Header des Multipart-Requests gelesen (Client-seitig). Angreifer kann MIME-Typ faelschen. Dateien werden aber mit UUID + sicherer Endung gespeichert und nie ausgefuehrt.
- **Loesung:** `file-type` npm-Paket zur Pruefung der Magic Bytes (Datei-Signatur) installieren.
- **Aufwand:** Gering (1-2 Stunden)

#### N6: Audit-Logs nicht in DB persistiert
- **Betrifft:** `controllers/document.controller.ts`
- **Risiko:** Audit-Logs gehen beim Container-Neustart verloren (DSGVO Art. 5 - Nachweisbarkeit).
- **Loesung:** `AuditLog` Prisma-Model anlegen, Logs in DB speichern + Retention-Policy (90 Tage).
- **Aufwand:** Mittel (3-4 Stunden)

---

## RBAC Rollen-Matrix

| Rolle | GET | POST/PATCH | DELETE | Admin-Aktionen |
|-------|-----|------------|--------|----------------|
| ADMIN | Ja | Ja | Ja | Ja (rate-limited) |
| VERWALTER | Ja | Ja | Ja | Nein |
| BUCHHALTER | Ja | Contracts + Finance | Nein | Nein |
| READONLY | Ja | Nein | Nein | Nein |

---

## Notizen

- **2026-02-20:** Security-Hardening Runde 2 abgeschlossen (S1-S12, N5, N1a, N1b behoben).
- Alle HOCH- und MITTEL-Prioritaet Items sind behoben.
- Prisma bietet Schutz gegen SQL-Injection durch parametrisierte Queries.
- Multi-Tenancy-Isolation via `companyId` + `tenantGuard` korrekt implementiert.
- Refresh-Token-Rotation: Token-Reuse loescht alle Tokens des Users (Sicherheitsmassnahme).
- `ENCRYPTION_KEY` in Production pflicht, in Development optional (Warnung).
- Bcrypt-Cost konfigurierbar: Default 12 (OWASP-Empfehlung 2026+).
