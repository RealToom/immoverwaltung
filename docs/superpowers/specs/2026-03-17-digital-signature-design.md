# Digitale Unterschrift — Design Spec

## Goal

Ermöglicht Hausverwaltern, einen Mietvertrag direkt aus der App via **Yousign** zur digitalen Unterschrift an Mieter zu senden. Der Vertrag wird aus einer DocumentTemplate als PDF gerendert, bei Yousign hochgeladen und nach Unterzeichnung automatisch per Webhook archiviert.

## Business Model

**Platform-Modell:** Ein Yousign-Account für die gesamte Plattform. API-Key liegt in `.env` — kein per-Tenant-Setup nötig. Kosten werden über das Pro/Business-Abo abgebildet.

## Flow

```
Verwalter klickt "Zur Unterschrift senden"
  → wählt DocumentTemplate
  → Backend rendert Template → PDF (pdfkit)
  → PDF wird zu Yousign hochgeladen (POST /documents)
  → Signature Request mit Mieter-E-Mail erstellt (POST /signature_requests)
  → Request aktiviert (POST /signature_requests/:id/activate)
  → Contract: signatureStatus = AUSSTEHEND, signatureRequestId gespeichert
  → Mieter erhält E-Mail von Yousign mit Signatur-Link
  → Mieter unterschreibt im Browser
  → Yousign sendet Webhook an /api/webhooks/yousign
  → Backend: signatureStatus = ABGESCHLOSSEN, Contract.status = AKTIV
       signedDocumentUrl gespeichert
```

## Database

### Contract Model — neue Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `signatureRequestId` | `String?` | Yousign Signature Request ID |
| `signatureStatus` | `SignatureStatus?` | Aktueller Unterschrift-Status |
| `signedDocumentId` | `String?` | Yousign Document ID des signierten PDFs (aus Webhook) |
| `signedDocumentUrl` | `String?` | Direkter Download-URL zum signierten PDF (aus Webhook-Payload) |

DB Column Maps (`@map`): `signature_request_id`, `signature_status`, `signed_document_id`, `signed_document_url`

> **Download-Endpoint:** `/api/contracts/:id/signature/document` proxied das PDF vom Yousign-API mittels `signedDocumentId`. Die `signedDocumentId` wird aus dem `signature_request.done`-Webhook-Event gespeichert (`event.data.object.documents[0].id`).

### Neues Enum

```prisma
enum SignatureStatus {
  AUSSTEHEND
  ABGESCHLOSSEN
  ABGELEHNT
  ABGELAUFEN
}
```

### Migration

Alle bestehenden Contracts: alle vier Felder bleiben `NULL` (nullable, kein Backfill nötig).

## Backend — Neue Dateien

| Datei | Verantwortung |
|-------|---------------|
| `src/services/yousign.service.ts` | Yousign API Wrapper: `uploadDocument`, `createSignatureRequest`, `activateRequest`, `getSignedDocument` |
| `src/controllers/signature.controller.ts` | Handler: `sendForSignature`, `getSignatureStatus`, `downloadSignedDocument` |
| `src/routes/signature.routes.ts` | Protected routes (requireAuth + tenantGuard + subscriptionGuard) |
| `src/routes/yousign-webhook.routes.ts` | Webhook Handler (raw body, vor express.json() in app.ts) |
| `src/test/yousign.service.test.ts` | Unit tests mit gemocktem Yousign SDK |

## Backend — Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `backend/prisma/schema.prisma` | Enum + 4 Felder auf Contract |
| `src/config/env.ts` | `YOUSIGN_API_KEY`, `YOUSIGN_BASE_URL`, `YOUSIGN_WEBHOOK_SECRET` |
| `src/app.ts` | Yousign-Webhook vor `express.json()` registrieren |
| `src/routes/index.ts` | `signatureRouter` registrieren |

## API Endpoints

| Method | Path | Auth | Beschreibung |
|--------|------|------|--------------|
| `POST` | `/api/contracts/:id/signature` | requireAuth + tenantGuard + subscriptionGuard | Body: `{ templateId, signerName?, signerEmail? }` — sendet Vertrag zur Unterschrift |
| `GET` | `/api/contracts/:id/signature` | requireAuth + tenantGuard | Gibt aktuellen `signatureStatus` zurück |
| `GET` | `/api/contracts/:id/signature/document` | requireAuth + tenantGuard | Lädt signiertes PDF herunter (proxied von Yousign) |
| `POST` | `/api/webhooks/yousign` | public (Yousign HMAC) | Webhook: status updates |

## Yousign Service — Funktionen

### `uploadDocument(pdfBuffer, filename)`
- `POST https://api.yousign.app/v3/documents` (multipart/form-data)
- Gibt `document_id` zurück

### `createSignatureRequest(documentId, signer, contractId)`
- `POST /v3/signature_requests`
- Body:
  ```json
  {
    "name": "Mietvertrag",
    "documents": [{ "document_id": "<id>" }],
    "signers": [{
      "info": { "email": "...", "first_name": "...", "last_name": "..." },
      "signature_level": "electronic_signature",
      "fields": [{
        "type": "signature",
        "document_id": "<id>",
        "page": 1,
        "x": 150,
        "y": 700,
        "width": 200,
        "height": 50
      }]
    }],
    "external_id": "<contractId>"
  }
  ```
- Gibt `signature_request_id` zurück
- Hinweis: `fields` definiert die Signaturposition im PDF (Seite 1, unten links). Position kann bei Bedarf konfigurierbar gemacht werden.

### `activateRequest(signatureRequestId)`
- `POST /v3/signature_requests/:id/activate`
- Aktiviert den Request → Yousign sendet E-Mail an Signer

### `getSignedDocument(signatureRequestId, documentId)`
- `GET /v3/signature_requests/:id/documents/:docId/download`
- Gibt PDF-Buffer zurück

## `sendForSignature` Handler — Logik

```
1. Contract laden (companyId-Guard)
2. Prüfen: Contract.signatureStatus === AUSSTEHEND → 409 Conflict (bereits laufend)
   Hinweis: ABGELEHNT und ABGELAUFEN dürfen erneut gesendet werden (signatureRequestId wird überschrieben)
3. Template rendern (renderTemplate + Handlebars) → liefert gerenderten String
4. PDF erzeugen (pdfkit → Buffer): **Hinweis:** `createPdfResponse` aus `src/lib/pdf.ts` kann hier nicht wiederverwendet werden, da es direkt in eine Express-Response streamt. Stattdessen muss ein In-Memory-Buffer erzeugt werden: pdfkit-Dokument erstellen, Text einfügen, `.end()` aufrufen und Output-Stream via `Buffer.concat` oder `get-stream` zu einem `Buffer` sammeln.
5. Signer: signerEmail/signerName aus Body ODER aus Contract.tenant
6. uploadDocument → documentId
7. createSignatureRequest → signatureRequestId
8. activateRequest
9. Contract updaten: signatureStatus=AUSSTEHEND, signatureRequestId
10. 200 { data: { signatureRequestId, status: "AUSSTEHEND" } }
```

## Webhook Handler — Events

Registriert in `app.ts` vor `express.json()` mit `express.raw({ type: "application/json" })`.

HMAC-Signatur validieren (HMAC-SHA256 mit `YOUSIGN_WEBHOOK_SECRET`). **Implementierungshinweis:** Den genauen Header-Namen (`X-Yousign-Signature` vs. `X-Yousign-Signature-256`) beim ersten Test gegen die Sandbox-API verifizieren und ggf. anpassen.

| Event | Aktion |
|-------|--------|
| `signature_request.done` | `signatureStatus = ABGESCHLOSSEN`, `Contract.status = AKTIV`, `signedDocumentId` + `signedDocumentUrl` aus Event speichern. **Hinweis:** Das automatische Setzen von `Contract.status = AKTIV` ist eine bewusste Geschäftsentscheidung — der unterzeichnete Vertrag gilt als aktiviert. |
| `signature_request.declined` | `signatureStatus = ABGELEHNT` |
| `signature_request.expired` | `signatureStatus = ABGELAUFEN` |
| andere | 200, ignorieren |

## Environment Variables

```
YOUSIGN_API_KEY=...          # API Key vom Yousign Dashboard
YOUSIGN_BASE_URL=https://api.yousign.app/v3   # Sandbox: https://api-sandbox.yousign.app/v3
YOUSIGN_WEBHOOK_SECRET=...   # Webhook Secret für HMAC-Signatur-Validierung
```

## Yousign API Version

Yousign API v3 (aktuelle stabile Version, Stand März 2026). Keine SDK — direkter REST-Client mit `fetch` + HMAC-Signatur-Validierung via `crypto.createHmac`.

## Error Handling

- Yousign API nicht erreichbar → `AppError(502, "Signaturservice nicht verfügbar")`
- Ungültige Webhook-Signatur → 400, pino-Warnung
- Contract bereits `AUSSTEHEND` → 409 Conflict
- Template nicht gefunden → 404
- Yousign 4xx (z.B. ungültige E-Mail) → Fehlermeldung an Client weiterleiten
- Download-Endpoint: `Contract.signedDocumentId` ist `null` (Status noch nicht `ABGESCHLOSSEN`) → 409 Conflict mit Meldung "Dokument noch nicht verfügbar"

## Testing

- Unit tests für `yousign.service.ts` mit gemocktem `fetch`: uploadDocument, createSignatureRequest, activateRequest, getSignedDocument
- Unit test: Webhook HMAC-Validierung schlägt fehl → 400
- Unit test: `signature_request.done` → korrekte DB-Updates
- Unit test: `sendForSignature` mit bereits lautendem AUSSTEHEND-Status → 409

## Frontend — ⚠️ NICHT IMPLEMENTIERT

Das Frontend für die digitale Unterschrift wurde **noch nicht implementiert**. Offene Punkte:

- Button "Zur Unterschrift senden" auf der Contracts-Seite / Contract-Detail
- Template-Auswahl Dialog (welche Vorlage soll gerendert werden?)
- `SignatureStatus`-Badge auf dem Contract (AUSSTEHEND / ABGESCHLOSSEN / ABGELEHNT)
- Download-Button für signiertes PDF
- Error-Toast bei 409 (bereits laufende Anfrage)

Diese Komponenten sind in einem separaten Frontend-Task zu implementieren.
