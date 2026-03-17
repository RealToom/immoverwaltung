# 2FA / TOTP — Design Spec

## Goal

Verpflichtende Zwei-Faktor-Authentifizierung via TOTP (Time-Based One-Time Password) für alle Nutzer. Beim ersten Login nach Einführung werden Nutzer durch einen Setup-Wizard geführt. Superadmin kann 2FA pro Nutzer für Testzwecke deaktivieren.

## Login-Flow

```
POST /api/auth/login (email + password)
  │
  ├─ totpBypassedByAdmin = true   →  Access Token + Refresh Token (normaler Login)
  │
  ├─ totpEnabled = false           →  HTTP 200 { requiresMfaSetup: true, setupToken }
  │                                   Frontend: weiterleitung zu /2fa/setup
  │
  └─ totpEnabled = true            →  HTTP 200 { requiresMfa: true, mfaToken }
                                       Frontend: weiterleitung zu /2fa/verify
                                       POST /api/auth/verify-2fa { mfaToken, code }
                                       → Access Token + Refresh Token
```

`mfaToken` und `setupToken` sind kurzlebige JWTs (5 Minuten), signiert mit `JWT_ACCESS_SECRET`, Payload: `{ userId, type: "mfa_pending" | "mfa_setup" }`. Sie gewähren keinen Zugang zur App — nur zur 2FA-Verifikation bzw. zum Setup.

Nutzer kommen nicht in die App, bis der Setup-Wizard abgeschlossen ist (kein "Später erinnern").

## Datenbankmodell — User-Erweiterung

Neue Felder auf dem `User`-Modell:

| Feld | Typ | DB-Spalte | Beschreibung |
|------|-----|-----------|--------------|
| `totpSecret` | `String?` | `totp_secret` | Base32-TOTP-Secret, AES-256-verschlüsselt mit `ENCRYPTION_KEY` |
| `totpEnabled` | `Boolean` | `totp_enabled` | `@default(false)` |
| `totpBypassedByAdmin` | `Boolean` | `totp_bypassed_by_admin` | `@default(false)` — Superadmin-Override |
| `totpBackupCodes` | `String[]` | `totp_backup_codes` | Array bcrypt-gehashter Backup-Codes |

Migration: bestehende Nutzer erhalten alle Felder als Default-Werte (`false`, `[]`) — kein Backfill nötig.

## Backend — Neue Dateien

| Datei | Verantwortung |
|-------|---------------|
| `src/services/totp.service.ts` | `generateSecret()`, `generateQrCodeUri()`, `verifyCode(secret, code)`, `generateBackupCodes()`, `hashBackupCode(code)`, `verifyBackupCode(code, hashes[])` |
| `src/controllers/twoFactor.controller.ts` | Handler für alle 2FA-Endpunkte |
| `src/routes/twoFactor.routes.ts` | 2FA-Routen (mix aus public+protected) |
| `src/test/totp.service.test.ts` | Unit tests für TOTP-Logik |

## Backend — Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `backend/prisma/schema.prisma` | 4 neue Felder auf `User` |
| `src/lib/jwt.ts` | Neue Funktionen `signMfaToken(userId, type)` und `verifyMfaToken(token)` mit eigenem Interface `MfaTokenPayload { userId, type }` — getrennt von `TokenPayload`, da kein `companyId`/`role` vorhanden |
| `src/services/auth.service.ts` | `login()`: 3 Antwort-Fälle (bypass / setup required / mfa required) |
| `src/controllers/auth.controller.ts` | `login`-Handler: Response-Mapping für 3 Fälle |
| `src/controllers/superadmin.controller.ts` | Neuer Handler `setTwoFactorBypass` + `listCompanyUsers` |
| `src/routes/superadmin.routes.ts` | `GET /companies/:id/users` + `PATCH /companies/:id/users/:userId/2fa-bypass` (`:id` konsistent mit bestehender Konvention) |
| `src/routes/auth.routes.ts` | Neue 2FA-Routen registrieren |

## API Endpoints

| Method | Path | Auth | Beschreibung |
|--------|------|------|--------------|
| `POST` | `/api/auth/login` | public | Geändert: gibt ggf. `requiresMfa`/`requiresMfaSetup` + Token zurück |
| `POST` | `/api/auth/2fa/setup` | setupToken (Header: `X-MFA-Token`) | Generiert TOTP-Secret, gibt QR-Code-URI + Secret zurück |
| `POST` | `/api/auth/2fa/verify-setup` | setupToken | Bestätigt OTP-Code, aktiviert 2FA, gibt Backup-Codes + normale Tokens aus |
| `POST` | `/api/auth/verify-2fa` | mfaToken (Header: `X-MFA-Token`) | Verifiziert OTP oder Backup-Code, gibt normale Tokens aus |
| `POST` | `/api/auth/2fa/regenerate-backup-codes` | requireAuth | Body: `{ code }` (aktueller TOTP-Code zur Bestätigung). Generiert neue Backup-Codes, invalidiert alle alten. |
| `GET` | `/api/superadmin/companies/:id/users` | requireSuperAdmin | Gibt Nutzerliste der Firma zurück (ohne `passwordHash`, `totpSecret`, `totpBackupCodes`) |
| `PATCH` | `/api/superadmin/companies/:id/users/:userId/2fa-bypass` | requireSuperAdmin | Body: `{ bypass: boolean }` — setzt `totpBypassedByAdmin` |

### `X-MFA-Token` Middleware

Neues `requireMfaToken(type: "mfa_pending" | "mfa_setup")` Middleware:
- Liest `X-MFA-Token` aus Header
- Verifiziert via `verifyMfaToken(token)` aus `src/lib/jwt.ts` (eigene Funktion, **nicht** `verifyAccessToken`)
- Prüft `payload.type === type`
- Setzt `req.userId` — kein `req.companyId` (noch nicht eingeloggt)
- Abgelaufen, ungültig oder falscher Typ → 401 `TOKEN_EXPIRED`

## TOTP Service — Funktionen

### `generateSecret()`
- Erzeugt 20 Bytes zufälligen Schlüssel via `crypto.randomBytes`
- Enkodiert als Base32 (via `otpauth`-Bibliothek)
- Gibt Base32-String zurück

### `generateQrCodeUri(secret, email, issuer)`
- Baut `otpauth://totp/...`-URI
- Gibt als Data-URL (Base64 PNG) via `qrcode.toDataURL()` zurück
- `issuer = "ImmoVerwalt"`

### `verifyCode(encryptedSecret, code)`
- Entschlüsselt Secret mit `ENCRYPTION_KEY`
- Prüft 6-stelligen Code mit 1-Schritt-Window (`±30s`) via `otpauth`
- Gibt `boolean` zurück

### `generateBackupCodes()`
- Erzeugt 8 Codes im Format `XXXX-XXXX` (zufällige Großbuchstaben+Ziffern)
- Gibt `{ plain: string[], hashed: string[] }` zurück
- `hashed` mit `bcrypt.hash` (cost 10 — schnell, da Backup-Codes lang genug sind)

### `verifyBackupCode(plain, hashes)`
- Vergleicht `plain` gegen alle `hashes` via `bcrypt.compare`
- Gibt Index des gefundenen Codes zurück (oder -1)
- Caller entfernt verwendeten Code aus Array

## `verify-setup` Handler — Logik

```
1. requireMfaToken("mfa_setup") → req.userId
2. User laden
3. verifyCode(user.totpSecret, body.code) → false → 401 INVALID_OTP
4. generateBackupCodes() → { plain, hashed }
5. User updaten: totpEnabled=true, totpBackupCodes=hashed
6. Refresh Token ausstellen + in RefreshToken-Tabelle speichern (analog auth.service.ts login())
7. Access Token ausstellen
8. 200 { data: { backupCodes: plain, accessToken } }
   Backup-Codes werden nur einmalig zurückgegeben
```

## `verify-2fa` Handler — Logik

Request-Body wird per Zod validiert mit Union-Schema:
- TOTP: `z.string().length(6).regex(/^\d{6}$/)`
- Backup-Code: `z.string().length(9).regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)`

```
1. requireMfaToken("mfa_pending") → req.userId
2. User laden
3. body.code.length === 6 → verifyCode(user.totpSecret, body.code)
   body.code.length === 9 → verifyBackupCode(body.code, user.totpBackupCodes)
     → gefunden: User updaten (Code aus Array entfernen), weiter
     → nicht gefunden: 401 INVALID_OTP
4. Refresh Token ausstellen + in RefreshToken-Tabelle speichern
5. Access Token ausstellen
6. 200 { data: { accessToken } }
```

## Secret-Verschlüsselung

TOTP-Secret wird mit **AES-256-GCM** verschlüsselt — die bestehenden Hilfsfunktionen `encryptString(secret)` und `decryptString(encrypted)` aus `src/lib/crypto.ts` wiederverwenden. Keine eigene Verschlüsselung implementieren. Falls `ENCRYPTION_KEY` leer ist (Dev ohne Key), Secret unverschlüsselt speichern mit pino-Warnung.

## Frontend — Neue Dateien

| Datei | Verantwortung |
|-------|---------------|
| `src/pages/TwoFactorSetup.tsx` | Setup-Wizard (3 Schritte), außerhalb ProtectedRoute |
| `src/pages/TwoFactorVerify.tsx` | OTP-Eingabe beim Login, außerhalb ProtectedRoute |
| `src/hooks/api/useAuth.ts` | `useVerify2FA`, `useSetup2FA`, `useVerifySetup`, `useRegenerateBackupCodes` |

## Frontend — Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/App.tsx` | Routes `/2fa/setup` und `/2fa/verify` als Top-Level-`<Route>`-Einträge im `App`-Component, auf gleicher Ebene wie `/login` und `/billing-locked` — **nicht** im `path="/*"` Catch-All der `ProtectedRoute` |
| `src/pages/Login.tsx` | Response-Handling: `requiresMfa` → navigate `/2fa/verify`, `requiresMfaSetup` → navigate `/2fa/setup` |
| `src/contexts/AuthContext.tsx` | `mfaToken`/`setupToken` temporär in State speichern (für nächste Seite) |
| `src/pages/Settings.tsx` | Sicherheits-Tab: 2FA-Status-Anzeige + "Backup-Codes neu generieren"-Button |
| `src/pages/SuperAdmin.tsx` | Pro Nutzer-Zeile: "2FA bypass"-Toggle (nur sichtbar für Superadmin) |

## Setup-Wizard (`TwoFactorSetup.tsx`)

3 Schritte:

1. **QR-Code** — QR-Code-Bild + Secret als Text ("Nicht scannen können? Code manuell eingeben"). Weiter-Button.
2. **Code bestätigen** — `InputOTP`-Komponente (6-stellig). Falscher Code → Fehlermeldung, kein Weiterkommen.
3. **Backup-Codes** — Liste der 8 Codes, Hinweis "Diese Codes werden nur einmal angezeigt. Jetzt sichern!". Checkbox "Ich habe die Codes gesichert" → Fertig-Button → weiter zur App.

`setupToken` kommt aus `AuthContext` (gesetzt nach Login-Response).

## Superadmin — 2FA Bypass

Im Superadmin-Panel: Pro Firma eine Liste der Nutzer (neuer Endpunkt `GET /api/superadmin/companies/:companyId/users`). Jede Zeile zeigt 2FA-Status + Toggle "Bypass aktivieren". `PATCH /api/superadmin/companies/:companyId/users/:userId/2fa-bypass` mit Body `{ bypass: true | false }`.

## npm Pakete

| Paket | Seite | Zweck |
|-------|-------|-------|
| `otpauth` | Backend | TOTP-Generierung + Verifikation |
| `qrcode` | Backend | QR-Code als Data-URL |
| `@types/qrcode` | Backend (dev) | TypeScript-Types |

Frontend: keine neuen Pakete — `input-otp` bereits installiert.

## Error Handling

- Falscher OTP-Code → 401 `{ error: "INVALID_OTP" }`
- Abgelaufener `mfaToken`/`setupToken` → 401 `{ error: "TOKEN_EXPIRED" }` → Frontend: zurück zu Login
- Backup-Code bereits verwendet → 401 `{ error: "INVALID_OTP" }` (kein Unterschied zum falschen Code, kein Hinweis welcher Code verbraucht wurde)
- `ENCRYPTION_KEY` nicht gesetzt → pino-Warnung, Secret unverschlüsselt (nur in Dev akzeptabel)
- Superadmin-Bypass-Endpunkt: User nicht zu companyId → 404

## Testing

- Unit test: `verifyCode` — gültiger Code → true
- Unit test: `verifyCode` — falscher Code → false
- Unit test: `verifyCode` — abgelaufener Code (außerhalb Window) → false
- Unit test: `verifyBackupCode` — gültiger Code → Index 0–7
- Unit test: `verifyBackupCode` — bereits verwendeter (entfernter) Code → -1
- Unit test: Login-Handler — `totpBypassedByAdmin=true` → normale Tokens
- Unit test: Login-Handler — `totpEnabled=false, bypass=false` → `requiresMfaSetup + setupToken`
- Unit test: Login-Handler — `totpEnabled=true, bypass=false` → `requiresMfa + mfaToken`
