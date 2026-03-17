# Design: Postfach KI-Zuordnung zu Mieter/Immobilie

**Datum:** 2026-03-17
**Status:** Approved
**Scope:** Automatische KI-Klassifizierung eingehender E-Mails zu Mieter und Immobilie, mit Bestätigungs-Banner und Dokument-Archivierung

---

## Kontext

Das Postfach (`Postfach.tsx`) ist ein vollständiger E-Mail-Client mit IMAP/SMTP-Integration. Der IMAP-Sync-Job (`imap-sync.service.ts`) analysiert bereits jede neue E-Mail per Claude Haiku:
- Terminvorschlag (`suggestedEventId`) → Bestätigungs-Banner im Frontend
- Anfragen-Erkennung (`isInquiry`)

Dieses Feature erweitert die KI-Analyse um automatische Zuordnung zu Mietern und Immobilien, ebenfalls mit Bestätigungs-Workflow und anschließender Dokument-Archivierung.

---

## Datenbankschema

Vier neue Felder auf `EmailMessage` (Migration erforderlich):

```prisma
suggestedTenantId   Int?  @map("suggested_tenant_id")
suggestedPropertyId Int?  @map("suggested_property_id")
tenantId            Int?  @map("tenant_id")
propertyId          Int?  @map("property_id")

// Explizite Relation-Namen erforderlich (Prisma: mehrere Relations zum gleichen Modell)
tenant            Tenant?   @relation("EmailMessageTenant",          fields: [tenantId],            references: [id], onDelete: SetNull)
suggestedTenant   Tenant?   @relation("EmailMessageSuggestedTenant", fields: [suggestedTenantId],   references: [id], onDelete: SetNull)
property          Property? @relation("EmailMessageProperty",        fields: [propertyId],          references: [id], onDelete: SetNull)
suggestedProperty Property? @relation("EmailMessageSuggestedProperty", fields: [suggestedPropertyId], references: [id], onDelete: SetNull)
```

Rückwärts-Relations müssen auf `Tenant` und `Property` ebenfalls mit denselben Namen ergänzt werden.

Zusätzliche Indexes in der Migration:
```prisma
@@index([companyId, suggestedTenantId])
@@index([companyId, tenantId])
```

`suggested*` = KI-Vorschlag ausstehend. `tenantId`/`propertyId` = bestätigt durch User.

---

## Backend

### 1. KI-Erweiterung in `imap-sync.service.ts`

**Vor** dem Haiku-Aufruf werden alle aktiven Mieter und Objekte der Firma geladen:

```ts
const tenants = await prisma.tenant.findMany({
  where: { companyId },
  select: { id: true, name: true, email: true }
})
const properties = await prisma.property.findMany({
  where: { companyId },
  select: { id: true, name: true }
})
```

Der bestehende Haiku-Prompt wird um einen dritten Analyse-Block erweitert. `max_tokens` wird von 300 auf 600 erhöht (sechs statt vier Felder, sonst Truncation-Risiko). Rückgabe:

```ts
interface AiAnalysisResult {
  hasAppointment: boolean
  appointmentTitle?: string
  appointmentDate?: string
  isInquiry: boolean
  suggestedTenantId: number | null    // neu
  suggestedPropertyId: number | null  // neu
}
```

**Whitelist-Validierung nach Haiku-Antwort** (Prompt-Injection-Schutz): Die von Haiku zurückgegebenen IDs werden gegen die vorher geladenen `tenants`- und `properties`-Arrays geprüft. Nur IDs die tatsächlich in der Liste vorhanden sind werden gespeichert — alle anderen werden auf `null` gesetzt. Dies verhindert, dass ein manipulierter E-Mail-Inhalt eine fremde ID einschleust.

```ts
const validTenantIds = new Set(tenants.map(t => t.id))
const validPropertyIds = new Set(properties.map(p => p.id))
const suggestedTenantId = validTenantIds.has(ai.suggestedTenantId ?? -1) ? ai.suggestedTenantId : null
const suggestedPropertyId = validPropertyIds.has(ai.suggestedPropertyId ?? -1) ? ai.suggestedPropertyId : null
```

Alles in einem einzigen API-Call, kein separater Request.

### 2. Service-Layer: `listMessages` und `getMessage` aktualisieren

`email-message.service.ts` nutzt explizite `select`-Blöcke. Beide Funktionen müssen die vier neuen Felder sowie die eingebetteten Relation-Objekte einschließen:

```ts
select: {
  // ...bestehende Felder...
  suggestedTenantId: true,
  suggestedPropertyId: true,
  tenantId: true,
  propertyId: true,
  suggestedTenant: { select: { id: true, name: true } },
  suggestedProperty: { select: { id: true, name: true } },
  tenant: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
}
```

### 3. Neuer Endpunkt: `POST /email-messages/:id/assign`

**Body:** `{ tenantId?: number, propertyId?: number }` — mindestens eines muss gesetzt sein. Validierung per Zod: `z.object({ tenantId: z.number().int().positive().optional(), propertyId: z.number().int().positive().optional() }).refine(d => d.tenantId != null || d.propertyId != null)`.
**Rollen:** ADMIN, VERWALTER, BUCHHALTER

Aktionen:
1. Setzt `tenantId` + `propertyId` auf dem `EmailMessage`-Record
2. Löscht `suggestedTenantId` + `suggestedPropertyId` (Vorschlag verbraucht)
3. Schreibt `bodyText` als `.txt`-Datei ins Upload-Verzeichnis. Pfadkonstruktion:
   ```ts
   const dir = path.join(env.UPLOAD_DIR, "email-documents", String(companyId))
   await fs.mkdir(dir, { recursive: true })
   const filePath = path.join(dir, `email-${emailMsgId}-${Date.now()}.txt`)
   await fs.writeFile(filePath, bodyText, "utf8")
   ```
4. `bodyText` ist nullable auf dem Modell — vor dem Schreiben prüfen: `const content = emailMsg.bodyText ?? ""`.

5. Ruft `createDocument()` aus `document.service.ts` auf (nicht direkt Prisma) — damit greift die bestehende Verschlüsselungslogik (DSGVO Art. 32) und Firmen-Eigentümerprüfung. `createDocument` hat die Signatur `createDocument(companyId: number, data: CreateDocumentData)` — `companyId` ist der erste Positionsparameter, **nicht** Teil des Data-Objekts:
   ```ts
   const bytes = Buffer.byteLength(content, "utf8")
   const fileSize = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
   // "email" ist ein neuer undokumentierter fileType-Wert (Spalte ist untypisiert String)
   await createDocument(companyId, {
     name: `E-Mail: ${subject}`,
     fileType: "email",
     fileSize,
     filePath,
     tenantId: tenantId ?? null,
     propertyId: propertyId ?? null,
   })
   ```

6. **Fehlerfall:** Schlägt `createDocument()` fehl, wird `filePath` per `fs.unlink()` im catch-Block gelöscht. Hinweis: Wenn `isEncryptionEnabled()` aktiv ist, erstellt `encryptFile()` intern eine verschlüsselte Kopie — die Cleanup-Verantwortung für diese liegt innerhalb von `createDocument()` selbst und muss dort sichergestellt sein (kein Scope dieser Spec).

### 4. Ablehnungs-Endpunkt: `PATCH /email-messages/:id`

`updateEmailMessageSchema` wird um optionale Felder erweitert:

```ts
suggestedTenantId:   z.null().optional(),
suggestedPropertyId: z.null().optional(),
```

Der [Ablehnen]-Button sendet `PATCH { suggestedTenantId: null, suggestedPropertyId: null }`. Damit nutzt die Ablehnung den bestehenden PATCH-Endpunkt — kein neuer Route-Handler nötig.

Die `updateMessage()`-Servicefunktion nutzt aktuell einen `as never`-Cast. Beim Hinzufügen der neuen Felder muss der Parameter-Typ explizit um `suggestedTenantId?: null` und `suggestedPropertyId?: null` erweitert werden — damit der Cast nicht still einen Typ-Fehler verdeckt.

---

## Frontend

### Interface-Erweiterung (`useEmailMessages.ts`)

```ts
export interface EmailMessage {
  // ... bestehende Felder ...
  suggestedTenantId: number | null
  suggestedPropertyId: number | null
  tenantId: number | null
  propertyId: number | null
  suggestedTenant?: { id: number; name: string }
  suggestedProperty?: { id: number; name: string }
  tenant?: { id: number; name: string }
  property?: { id: number; name: string }
}
```

Neuer Hook `useAssignEmail()` → `POST /email-messages/:id/assign`.

### Banner-Logik in `Postfach.tsx`

Die drei Fälle werden **in dieser Reihenfolge** geprüft (Fall C zuerst, um Überschneidungen zu vermeiden):

**Fall C — bereits zugeordnet** (zuerst prüfen: `detail.tenantId || detail.propertyId`):
- Kompakter Badge: `"Mieter: Müller · Hauptstraße 12"` mit Links zu `/tenants/:id` bzw. `/properties/:id`
- Kein Banner, kein Panel

**Fall A — KI-Vorschlag vorhanden** (`detail.suggestedTenantId || detail.suggestedPropertyId`):
- Lila Banner (gleiche Optik wie `suggestedEventId`-Banner)
- Text: `"KI-Vorschlag: Mieter [Name] · Objekt [Name]"`
- [Bestätigen] → `useAssignEmail` mit `{ tenantId: suggestedTenantId, propertyId: suggestedPropertyId }` → Toast "Zugeordnet und archiviert"
- [Ablehnen] → `useUpdateEmailMessage` mit `{ suggestedTenantId: null, suggestedPropertyId: null }` → Banner verschwindet

**Fall B — kein Treffer, noch nicht zugeordnet** (Fallback: weder C noch A):
- Kompaktes Panel mit zwei Dropdowns: Mieter (optional) + Objekt (optional)
- Befüllt per `useTenants()` + `useProperties()` (bereits existierende Hooks)
- [Speichern]-Button → `useAssignEmail` mit ausgewählten IDs

---

## Fehlerbehandlung

- Haiku-Fehler beim IMAP-Sync: `suggested*` bleiben `null`, E-Mail wird trotzdem gespeichert (bestehender `try/catch`-Wrapper). `max_tokens`-Erhöhung reduziert Truncation-Risiko.
- Assign-Endpunkt: 404 wenn E-Mail nicht zur Firma gehört; 400 wenn weder `tenantId` noch `propertyId` übergeben
- `createDocument()` schlägt fehl: `.txt`-Datei wird per `fs.unlink()` im catch-Block gelöscht, HTTP 500 an Client

---

## Testing

- Unit-Test: `analyzeEmailWithAi()` mit Mock-Antwort — prüft Parsing der neuen Felder und Whitelist-Validierung (ungültige ID wird auf null gesetzt)
- Unit-Test: `assign()`-Service — prüft Document-Erstellung + Feldaktualisierung + Datei-Cleanup bei Fehler
- Unit-Test: Ablehnungs-Pfad — PATCH mit `suggestedTenantId: null` löscht Vorschlag ohne sonstige Änderungen
- Integration-Test: `POST /email-messages/:id/assign` — 200 mit korrekten DB-Änderungen, Document-Record vorhanden
- Integration-Test: Assign mit ungültiger `tenantId` (anderer Firma) → 400 (durch `createDocument`-Ownership-Check)
- Frontend: manuelle Tests der drei Banner-Fälle gegen lokale API

---

## Abgrenzung (nicht in diesem Scope)

- Notifications-Feature (Browser Push, E-Mail-Digest) — separates Feature
- Bulk-Zuordnung mehrerer E-Mails auf einmal
- Rückgängig machen einer bestätigten Zuordnung
