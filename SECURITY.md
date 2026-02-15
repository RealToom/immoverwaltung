# Sicherheitsanalyse - Immoverwaltung Backend

> **Erstellt:** 2026-02-11
> **Letzte Aktualisierung:** 2026-02-12

---

## Bereits behoben

| # | Problem | Fix | Datei |
|---|---------|-----|-------|
| 1 | Keine Security-Headers (XSS, Clickjacking, MIME-Sniffing) | `helmet` Middleware installiert und aktiviert | `app.ts` |
| 2 | Kein Body-Size-Limit bei `express.json()` - ermooglicht DoS durch uebergrosse Payloads | `express.json({ limit: "1mb" })` gesetzt | `app.ts` |
| 3 | Keine Max-Laenge auf String-Feldern in Zod-Schemas - ermooglicht DoS durch extrem lange Strings | `.max()` auf allen String-Feldern in allen Schemas | `schemas/*.schema.ts` |
| 4 | Refresh-Token-Cookie ohne `Secure`-Flag - Cookie wird ueber HTTP gesendet | `Secure`-Flag wird in Production gesetzt | `auth.controller.ts` |
| 5 | Error-Handler loggt vollstaendigen Stack-Trace auch in Production | In Production wird nur `err.message` geloggt | `errorHandler.ts` |
| 6 | Passwort-Minimum nur 6 Zeichen | Auf 8 Zeichen erhoeht | `auth.schema.ts` |
| H1 | Kein Rate-Limiting auf Auth-Endpunkten | `express-rate-limit` auf Login/Register/Refresh (max 10 pro IP pro 15 Min) | `middleware/rateLimiter.ts`, `auth.routes.ts` |
| H2 | Refresh-Tokens nicht in DB gespeichert / nicht widerrufbar | `RefreshToken` Model in Prisma, Token-Rotation bei Refresh, Revocation bei Logout | `schema.prisma`, `auth.service.ts`, `auth.controller.ts` |
| H3 | Keine Rollen-basierte Zugriffskontrolle (RBAC) | `requireRole()` Middleware, Schreib-Operationen nach Rollen-Matrix geschuetzt | `middleware/requireRole.ts`, alle `routes/*.ts` |
| M1 | Kein Account-Lockout nach fehlgeschlagenen Login-Versuchen | `failedLoginAttempts` + `lockedUntil` auf User-Model, 10 Versuche -> 30 Min Sperre | `schema.prisma`, `auth.service.ts` |
| M2 | Keine Passwort-Komplexitaetsanforderungen | Regex: mind. 1 Gross-/Kleinbuchstabe + 1 Ziffer | `auth.schema.ts` |
| M3 | CORS-Origins sind hardcodiert fuer localhost | `CORS_ORIGINS` Umgebungsvariable (komma-separiert, Fallback auf localhost) | `config/cors.ts` |
| M4 | `as never` Type-Casting in Services | Typisierte Interfaces statt `Record<string, unknown>`, `Prisma.WhereInput` statt `Record` | `contract.service.ts`, `maintenance.service.ts` |
| M5 | Kein Request-Logging / Audit-Trail | `morgan` Logger (combined in Production, dev in Development) | `app.ts` |

---

## Offene Sicherheitsluecken (nach Prioritaet)

### NIEDRIG

#### N1: Kein HTTPS-Enforcement
- **Betrifft:** `index.ts`, Deployment
- **Risiko:** In Production werden Daten unverschluesselt uebertragen, wenn kein Reverse-Proxy (nginx, Caddy) vorgeschaltet ist.
- **Loesung:** In Production einen Reverse-Proxy mit SSL-Terminierung verwenden (Caddy mit automatischem Let's Encrypt, oder nginx + certbot). Alternativ: `express-enforces-ssl` Middleware.
- **Aufwand:** Deployment-abhaengig

#### N2: Keine CSRF-Protection
- **Betrifft:** Alle state-aendernden Endpunkte (POST, PATCH, DELETE)
- **Risiko:** Cross-Site-Request-Forgery moeglich, da Refresh-Token als Cookie gesendet wird. `SameSite=Lax` bietet teilweisen Schutz (blockiert POST von fremden Seiten), aber nicht bei Browser-Bugs oder alten Browsern.
- **Loesung:** CSRF-Token in API-Client implementieren oder auf `SameSite=Strict` wechseln (erfordert Frontend-Anpassung). Alternative: Auf Bearer-only Token (kein Cookie) umstellen.
- **Aufwand:** Mittel (2-4 Stunden)

#### N3: npm audit Schwachstellen
- **Betrifft:** `node_modules/`
- **Risiko:** Abhaengigkeiten mit bekannten Schwachstellen (aktuell 0 vulnerabilities nach helmet-Installation).
- **Loesung:** Regelmaessig `npm audit` ausfuehren und Patches einspielen. In CI/CD Pipeline integrieren.
- **Aufwand:** Laufend

#### N4: Keine Input-Sanitization gegen Prisma-Injection
- **Betrifft:** Alle `search`-Parameter in List-Endpunkten
- **Risiko:** Gering, da Prisma parametrisierte Queries nutzt. Aber `contains`-Operatoren mit User-Input koennten bei bestimmten DB-Konfigurationen problematisch sein.
- **Loesung:** Sonderzeichen in Search-Strings escapen (z.B. `%`, `_` fuer LIKE-Queries). Prisma macht dies teilweise automatisch.
- **Aufwand:** Gering (1 Stunde)

#### N5: Health-Endpoint gibt Timestamp preis
- **Betrifft:** `app.ts` -> `GET /health`
- **Risiko:** Minimal. Gibt Server-Zeitzone und genauen Timestamp preis, was fuer Timing-Angriffe genutzt werden koennte.
- **Loesung:** Nur `{ status: "ok" }` zurueckgeben, oder Health-Endpoint hinter Auth stellen.
- **Aufwand:** Minimal

---

## RBAC Rollen-Matrix

| Rolle | GET | POST/PATCH | DELETE |
|-------|-----|------------|--------|
| ADMIN | Ja | Ja | Ja |
| VERWALTER | Ja | Ja | Ja |
| BUCHHALTER | Ja | Contracts + Finance | Nein |
| READONLY | Ja | Nein | Nein |

---

## Notizen

- Alle HOCH- und MITTEL-Prioritaet Items wurden am 2026-02-12 behoben.
- Die Anwendung ist aktuell nur fuer lokale Entwicklung gedacht. Vor dem Production-Deployment muessen mindestens N1 (HTTPS) behoben werden.
- Prisma bietet von Haus aus guten Schutz gegen SQL-Injection durch parametrisierte Queries.
- Die Multi-Tenancy-Isolation ueber `companyId` + `tenantGuard` Middleware funktioniert korrekt - jede DB-Query filtert nach der Firma des eingeloggten Users.
- Refresh-Token-Rotation: Bei jedem Refresh wird der alte Token geloescht und ein neuer erstellt. Token-Reuse (alter Token nach Rotation) loescht alle Tokens des Users als Sicherheitsmassnahme.
