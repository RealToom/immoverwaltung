# Tenant Portal 2FA mit Gerät-Merken — Design Spec

**Datum:** 2026-04-06
**Status:** Approved

---

## Übersicht

Optionale E-Mail-basierte Zwei-Faktor-Authentifizierung für das Mieter-Portal (TenantUser), ergänzt um eine "Gerät merken für 30 Tage"-Funktion über ein HttpOnly-Cookie.

---

## Scope

- **Betrifft:** Nur das Mieter-Portal (`TenantUser`). Das Admin-System (`User`) bleibt unverändert.
- **2FA-Methode:** 6-stelliger E-Mail-Code, 10 Minuten gültig.
- **Remember Device:** 30 Tage, HttpOnly-Cookie mit gehashtem Token in neuer DB-Tabelle.
- **Pflicht:** Nein — Mieter aktiviert/deaktiviert 2FA selbst in den Einstellungen.
- **Fallback:** Kein Backup-Code. Mieter kontaktiert Verwalter → Admin-Reset.

---

## Datenbankänderungen

### Neue Felder auf `TenantUser`

```prisma
twoFactorEnabled       Boolean   @default(false) @map("two_factor_enabled")
twoFactorCode          String?   @map("two_factor_code")          // SHA-256-Hash
twoFactorCodeExpiresAt DateTime? @map("two_factor_code_expires_at")
```

### Neues Modell `TrustedDevice`

```prisma
model TrustedDevice {
  id            Int       @id @default(autoincrement())
  tenantUserId  Int       @map("tenant_user_id")
  companyId     Int       @map("company_id")
  tokenHash     String    @unique @map("token_hash")  // SHA-256 des Device-Tokens
  expiresAt     DateTime  @map("expires_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  tenantUser    TenantUser @relation(fields: [tenantUserId], references: [id], onDelete: Cascade)
  company       Company    @relation(fields: [companyId], references: [id])

  @@map("trusted_devices")
}
```

`onDelete: Cascade` stellt sicher, dass TrustedDevices automatisch gelöscht werden wenn ein TenantUser gelöscht wird.

---

## API-Endpunkte

### Auth-Flow

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| POST | `/api/tenant/:slug/auth/login` | public | Login — unverändert, neu: 2FA-Branch |
| POST | `/api/tenant/:slug/auth/verify-2fa` | mfaToken (Bearer) | Code einreichen + optional Gerät merken |

### Self-Service (Mieter)

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | `/api/tenant/:slug/portal/me/2fa/status` | requireTenantAuth | 2FA-Status abfragen |
| POST | `/api/tenant/:slug/portal/me/2fa/enable` | requireTenantAuth | Code per E-Mail anfordern |
| POST | `/api/tenant/:slug/portal/me/2fa/confirm` | requireTenantAuth | Code bestätigen → 2FA aktiv |
| DELETE | `/api/tenant/:slug/portal/me/2fa` | requireTenantAuth | 2FA deaktivieren (Passwort erforderlich) |

### Admin-Reset

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| DELETE | `/api/tenant/:slug/admin/tenants/:tenantUserId/2fa` | ADMIN/VERWALTER | 2FA eines Mieters zurücksetzen |

---

## Login-Flow (Detail)

```
POST /login
  ↓ E-Mail + Passwort korrekt?
  ↓ Nein → 401
  ↓ Ja
  ↓ twoFactorEnabled = false?
    → Tokens direkt zurück (unverändert)
  ↓ twoFactorEnabled = true
  ↓ Cookie `tenant_device_token` vorhanden?
    → SHA-256(cookie) gegen TrustedDevice prüfen (companyId + tenantUserId + expiresAt > now)
    → Gültig → Tokens direkt zurück
    → Ungültig/abgelaufen → TrustedDevice löschen, weiter
  ↓ 6-stelligen Code generieren (crypto.randomInt(100000, 999999))
  ↓ SHA-256(code) in TenantUser speichern, expiresAt = now + 10 min
  ↓ Code per E-Mail senden
  ↓ mfaToken-JWT zurück (Typ: tenant_mfa_pending, 10 min, Payload: { tenantUserId, companyId })
  Response: { requiresTwoFactor: true, mfaToken }

POST /verify-2fa  { code, rememberDevice? }  + Authorization: Bearer <mfaToken>
  ↓ mfaToken verifizieren (Typ tenant_mfa_pending, nicht abgelaufen)
  ↓ SHA-256(code) == twoFactorCode && expiresAt > now?
    → Nein → 400 "Code ungültig oder abgelaufen"
  ↓ twoFactorCode + twoFactorCodeExpiresAt auf null setzen
  ↓ rememberDevice = true?
    → deviceToken = randomUUID()
    → TrustedDevice { tenantUserId, companyId, tokenHash: SHA-256(deviceToken), expiresAt: now+30d } speichern
    → Cookie setzen: tenant_device_token=deviceToken, HttpOnly, Secure, SameSite=Strict, maxAge=30d
  ↓ accessToken + refreshToken zurück (normaler Login-Abschluss)
```

---

## 2FA-Aktivierung (Self-Service)

```
POST /me/2fa/enable
  → Neuen Code generieren + per E-Mail senden
  → { codeSent: true }

POST /me/2fa/confirm  { code }
  → Code prüfen (gleiche Logik wie verify-2fa)
  → twoFactorEnabled = true
  → Code-Felder leeren
  → { success: true }

DELETE /me/2fa  { password }
  → Passwort des Mieters erneut prüfen (bcrypt.compare)
  → twoFactorEnabled = false
  → twoFactorCode + twoFactorCodeExpiresAt = null
  → Alle TrustedDevices dieses TenantUsers löschen
  → Cookie tenant_device_token löschen (Set-Cookie mit maxAge=0)
  → { success: true }
```

---

## Admin-Reset

```
DELETE /admin/tenants/:tenantUserId/2fa
  → Rolle: ADMIN oder VERWALTER, companyId-Isolation prüfen
  → twoFactorEnabled = false
  → twoFactorCode + twoFactorCodeExpiresAt = null
  → Alle TrustedDevices löschen
  → { success: true }
```

---

## Sicherheitsdetails

| Aspekt | Entscheidung |
|--------|-------------|
| Code-Format | 6 Ziffern, `crypto.randomInt(100000, 999999)` |
| Code-Speicherung | SHA-256-Hash (kein bcrypt — kurze Lebensdauer + Rate-Limit reichen) |
| Code-Ablauf | 10 Minuten |
| Device-Token | `randomUUID()` (128-bit Entropie) |
| Device-Token-Speicherung | SHA-256-Hash in `tokenHash` |
| Cookie | `tenant_device_token`, HttpOnly, Secure, SameSite=Strict |
| Cookie-Ablauf | 30 Tage |
| mfaToken | JWT, Typ `tenant_mfa_pending`, 10 min, separates Secret `JWT_TENANT_MFA_SECRET` |
| Rate-Limiting | `authLimiter` (10/15min) auf `/verify-2fa`, `/enable`, `/confirm` |
| Code nach Verwendung | Sofort auf null gesetzt (Einmalcode) |
| Abgelaufene TrustedDevices | Werden beim Login-Check gelöscht (lazy cleanup) |

---

## Neue Dateien

| Datei | Zweck |
|-------|-------|
| `backend/src/services/tenantTwoFactor.service.ts` | Gesamte 2FA-Logik (Code-Gen, Verify, Device-Trust, Reset) |
| `backend/src/controllers/tenantTwoFactor.controller.ts` | HTTP-Handler für alle 2FA-Endpunkte |
| `backend/src/schemas/tenantTwoFactor.schema.ts` | Zod-Schemas für alle Requests |
| `backend/src/test/tenantTwoFactor.service.test.ts` | Unit-Tests für den Service |

## Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `backend/prisma/schema.prisma` | TrustedDevice-Modell + TenantUser-Felder |
| `backend/src/services/tenantAuth.service.ts` | Login-Flow: 2FA-Branch + Device-Check |
| `backend/src/routes/tenantAuth.routes.ts` | Neuer `/verify-2fa` Endpunkt |
| `backend/src/routes/tenantPortal.routes.ts` | Self-Service-Endpunkte |
| `backend/src/routes/tenantAdmin.routes.ts` | Admin-Reset-Endpunkt |
| `backend/src/lib/tenantJwt.ts` | `signTenantMfaToken` + `verifyTenantMfaToken` |
| `backend/src/config/env.ts` | `JWT_TENANT_MFA_SECRET` Umgebungsvariable |

---

## Nicht im Scope

- Frontend-Implementierung (separates Feature)
- Admin-2FA (bleibt TOTP, unverändert)
- SMS-2FA
- Backup-Codes für Mieter
- Konfigurierbare Device-Trust-Dauer (fix: 30 Tage)
