# Tenant Portal — Implementierungsplan Teil 4: Frontend Feature Pages + Admin UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle verbleibenden Feature-Pages des Tenant Portals implementieren (Dokumente, Signatur, Upload, Tickets, Finanzen, Nachrichten) sowie die Admin-UI-Erweiterung (Einladung senden + Nachrichten) im bestehenden Frontend.

**Voraussetzung:** Teil 1, 2 und 3 abgeschlossen. `tenant-portal/` läuft auf Port 5173, Backend auf Port 3001.

**Architecture:** React Query Hooks pro Feature, Optimistic Updates wo sinnvoll. Canvas API für Signature Pad. Lucide Icons durchgängig (kein Emoji). Alle UI-Texte auf Deutsch.

**Tech Stack:** Vite 5, React 18, TypeScript, Tailwind CSS 3, Shadcn/UI, TanStack Query v5, React Router v6, signature_pad (npm), date-fns

---

## Dateiübersicht Teil 4

| Aktion | Datei |
|--------|-------|
| Create | `tenant-portal/src/hooks/api/useTenantDocuments.ts` |
| Create | `tenant-portal/src/hooks/api/useTenantTickets.ts` |
| Create | `tenant-portal/src/hooks/api/useTenantFinances.ts` |
| Create | `tenant-portal/src/hooks/api/useTenantMessages.ts` |
| Create | `tenant-portal/src/pages/Documents.tsx` |
| Create | `tenant-portal/src/pages/SignDocument.tsx` |
| Create | `tenant-portal/src/pages/UploadDocument.tsx` |
| Create | `tenant-portal/src/pages/Tickets.tsx` |
| Create | `tenant-portal/src/pages/NewTicket.tsx` |
| Create | `tenant-portal/src/pages/Finances.tsx` |
| Create | `tenant-portal/src/pages/Messages.tsx` |
| Modify | `tenant-portal/src/App.tsx` (neue Routes eintragen) |
| Modify | `cozy-estate-central/src/pages/Tenants.tsx` (Einladung senden Button) |
| Modify | `cozy-estate-central/src/hooks/api/useTenants.ts` (invite Mutation) |

---

## Task 24: API Hooks für alle Feature-Pages

**Files:**
- Create: `tenant-portal/src/hooks/api/useTenantDocuments.ts`
- Create: `tenant-portal/src/hooks/api/useTenantTickets.ts`
- Create: `tenant-portal/src/hooks/api/useTenantFinances.ts`
- Create: `tenant-portal/src/hooks/api/useTenantMessages.ts`

- [ ] **Step 1: useTenantDocuments Hook schreiben**

`tenant-portal/src/hooks/api/useTenantDocuments.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantDocument {
  id: number;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  createdAt: string;
  requiresSignature: boolean;
  signatureType: "SIMPLE" | "SIGNATURE_PAD" | null;
  signedAt: string | null;
  downloadUrl: string;
}

export interface TenantUpload {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  description: string | null;
  createdAt: string;
}

export function useTenantDocuments(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "documents"],
    queryFn: () => tenantApi<{ data: TenantDocument[] }>(slug, "/documents"),
    select: (res) => res.data,
  });
}

export function useTenantUploads(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "uploads"],
    queryFn: () => tenantApi<{ data: TenantUpload[] }>(slug, "/uploads"),
    select: (res) => res.data,
  });
}

export function useSignDocument(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      type,
      signatureData,
    }: {
      documentId: number;
      type: "SIMPLE" | "SIGNATURE_PAD";
      signatureData?: string;
    }) =>
      tenantApi(slug, `/documents/${documentId}/sign`, {
        method: "POST",
        body: { type, signatureData },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "documents"] }),
  });
}

export function useUploadDocument(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      tenantApi<{ data: TenantUpload }>(slug, "/uploads", {
        method: "POST",
        body: formData,
        isFormData: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "uploads"] }),
  });
}
```

- [ ] **Step 2: useTenantTickets Hook schreiben**

`tenant-portal/src/hooks/api/useTenantTickets.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantTicket {
  id: number;
  title: string;
  description: string;
  category: string;
  status: "OFFEN" | "IN_BEARBEITUNG" | "GESCHLOSSEN";
  createdAt: string;
  photoPath: string | null;
}

export function useTenantTickets(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "tickets"],
    queryFn: () => tenantApi<{ data: TenantTicket[] }>(slug, "/tickets"),
    select: (res) => res.data,
  });
}

export function useCreateTicket(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      tenantApi<{ data: TenantTicket }>(slug, "/tickets", {
        method: "POST",
        body: formData,
        isFormData: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "tickets"] }),
  });
}
```

- [ ] **Step 3: useTenantFinances Hook schreiben**

`tenant-portal/src/hooks/api/useTenantFinances.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface RentPayment {
  id: number;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: "BEZAHLT" | "AUSSTEHEND" | "UEBERFAELLIG";
  description: string;
}

export interface FinancesData {
  nextPayment: {
    amount: number;
    dueDate: string;
    status: "BEZAHLT" | "AUSSTEHEND" | "UEBERFAELLIG";
  } | null;
  payments: RentPayment[];
  totalOpen: number;
}

export function useTenantFinances(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "finances"],
    queryFn: () => tenantApi<{ data: FinancesData }>(slug, "/finances"),
    select: (res) => res.data,
  });
}
```

- [ ] **Step 4: useTenantMessages Hook schreiben**

`tenant-portal/src/hooks/api/useTenantMessages.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantMessage {
  id: number;
  direction: "TENANT_TO_ADMIN" | "ADMIN_TO_TENANT";
  body: string;
  createdAt: string;
  readAt: string | null;
}

export function useTenantMessages(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "messages"],
    queryFn: () => tenantApi<{ data: TenantMessage[] }>(slug, "/messages"),
    select: (res) => res.data,
    refetchInterval: 30_000, // poll every 30 seconds
  });
}

export function useSendMessage(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      tenantApi<{ data: TenantMessage }>(slug, "/messages", {
        method: "POST",
        body: { body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "messages"] }),
  });
}
```

- [ ] **Step 5: `isFormData` Support in api.ts ergänzen**

In `tenant-portal/src/lib/api.ts` die `RequestOptions` und `api`-Funktion um `isFormData` erweitern:
```typescript
// In RequestOptions interface:
isFormData?: boolean;

// In api<T>() function, body-Handling:
if (options?.body !== undefined) {
  if (options.isFormData) {
    init.body = options.body as FormData;
    // Content-Type NICHT setzen — Browser setzt multipart/form-data automatisch
  } else {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
}
```

- [ ] **Step 6: Commit**

```bash
cd tenant-portal
git add src/hooks/api/
git add src/lib/api.ts
git commit -m "feat(tenant-portal): API hooks for documents, tickets, finances, messages"
```

---

## Task 25: Documents Page

**Files:**
- Create: `tenant-portal/src/pages/Documents.tsx`

- [ ] **Step 1: Documents.tsx schreiben**

`tenant-portal/src/pages/Documents.tsx`:
```typescript
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Upload, PenLine, CheckCircle, Clock } from "lucide-react";
import { useTenantDocuments, useTenantUploads } from "@/hooks/api/useTenantDocuments";
import { format } from "date-fns";
import { de } from "date-fns/locale";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: documents, isLoading: docsLoading } = useTenantDocuments(slug!);
  const { data: uploads, isLoading: uploadsLoading } = useTenantUploads(slug!);

  const pendingSignature = documents?.filter(
    (d) => d.requiresSignature && !d.signedAt
  ) ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dokumente</h1>
        <button
          onClick={() => navigate(`/${slug}/documents/upload`)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 rounded-lg"
        >
          <Upload className="w-4 h-4" />
          Hochladen
        </button>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Signature Banner */}
        {pendingSignature.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <PenLine className="w-5 h-5 text-amber-600" />
              <span className="font-semibold text-amber-800">
                {pendingSignature.length === 1
                  ? "1 Dokument wartet auf Ihre Unterschrift"
                  : `${pendingSignature.length} Dokumente warten auf Ihre Unterschrift`}
              </span>
            </div>
            <div className="space-y-2">
              {pendingSignature.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => navigate(`/${slug}/documents/sign/${doc.id}`)}
                  className="w-full flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2 text-left hover:bg-amber-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                    <p className="text-xs text-gray-500">{doc.category}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Unterschreiben
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Vom Verwalter bereitgestellte Dokumente */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Vom Verwalter
          </h2>
          {docsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !documents?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Keine Dokumente vorhanden</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <div className="flex-shrink-0">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                    <p className="text-xs text-gray-500">
                      {doc.category} · {formatBytes(doc.sizeBytes)} ·{" "}
                      {format(new Date(doc.createdAt), "dd.MM.yyyy", { locale: de })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {doc.requiresSignature && (
                      doc.signedAt ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )
                    )}
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary font-medium"
                    >
                      Öffnen
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Hochgeladene Dokumente */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Meine Uploads
          </h2>
          {uploadsLoading ? (
            <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ) : !uploads?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Noch keine Uploads</p>
          ) : (
            <div className="space-y-2">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <FileText className="w-8 h-8 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{upload.filename}</p>
                    <p className="text-xs text-gray-500">
                      {upload.category} · {formatBytes(upload.sizeBytes)} ·{" "}
                      {format(new Date(upload.createdAt), "dd.MM.yyyy", { locale: de })}
                    </p>
                    {upload.description && (
                      <p className="text-xs text-gray-400 truncate">{upload.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd tenant-portal
git add src/pages/Documents.tsx
git commit -m "feat(tenant-portal): Documents page with pending signature banner"
```

---

## Task 26: SignDocument Page

**Files:**
- Create: `tenant-portal/src/pages/SignDocument.tsx`

- [ ] **Step 1: `signature_pad` installieren**

```bash
cd tenant-portal
npm install signature_pad
```

Überprüfen dass `signature_pad` in `package.json` unter `dependencies` erscheint.

- [ ] **Step 2: SignDocument.tsx schreiben**

`tenant-portal/src/pages/SignDocument.tsx`:
```typescript
import { useParams, useNavigate } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import SignaturePad from "signature_pad";
import { ArrowLeft, RotateCcw, CheckCircle } from "lucide-react";
import { useTenantDocuments, useSignDocument } from "@/hooks/api/useTenantDocuments";

export default function SignDocumentPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const documentId = Number(id);

  const { data: documents } = useTenantDocuments(slug!);
  const doc = documents?.find((d) => d.id === documentId);
  const signMutation = useSignDocument(slug!);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signature Pad initialisieren
  useEffect(() => {
    if (doc?.signatureType === "SIGNATURE_PAD" && canvasRef.current) {
      sigPadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(30, 30, 30)",
      });

      // Canvas-Größe an devicePixelRatio anpassen
      function resizeCanvas() {
        const canvas = canvasRef.current!;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d")!.scale(ratio, ratio);
        sigPadRef.current?.clear();
      }

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }
  }, [doc?.signatureType]);

  function clearPad() {
    sigPadRef.current?.clear();
  }

  async function handleSign() {
    setError(null);
    try {
      if (doc?.signatureType === "SIMPLE") {
        if (!agreed) {
          setError("Bitte bestätigen Sie die Zustimmung.");
          return;
        }
        await signMutation.mutateAsync({ documentId, type: "SIMPLE" });
      } else {
        if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
          setError("Bitte unterschreiben Sie im Feld oben.");
          return;
        }
        const signatureData = sigPadRef.current.toDataURL("image/png");
        await signMutation.mutateAsync({ documentId, type: "SIGNATURE_PAD", signatureData });
      }
      setDone(true);
    } catch {
      setError("Fehler beim Speichern der Unterschrift. Bitte versuchen Sie es erneut.");
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Unterschrift gespeichert</h2>
        <p className="text-gray-500 mb-8">Das Dokument wurde erfolgreich unterzeichnet.</p>
        <button
          onClick={() => navigate(`/${slug}/documents`)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold"
        >
          Zurück zu Dokumenten
        </button>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Dokument wird geladen…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold">Dokument unterschreiben</h1>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Dokument-Info */}
        <div className="bg-white rounded-xl border p-4">
          <p className="font-semibold text-gray-900">{doc.title}</p>
          <p className="text-sm text-gray-500 mt-1">{doc.category}</p>
          <a
            href={doc.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary mt-2 inline-block font-medium"
          >
            Dokument ansehen →
          </a>
        </div>

        {/* Unterschrift-Bereich */}
        {doc.signatureType === "SIMPLE" ? (
          <div className="bg-white rounded-xl border p-4 space-y-4">
            <h2 className="font-semibold text-gray-900">Einfache Zustimmung</h2>
            <p className="text-sm text-gray-600">
              Mit Ihrer Bestätigung erklären Sie sich mit dem Inhalt des oben verlinkten Dokuments
              einverstanden. Der Zeitstempel Ihrer Zustimmung wird gespeichert.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-primary"
              />
              <span className="text-sm text-gray-700">
                Ich habe das Dokument gelesen und stimme dem Inhalt zu.
              </span>
            </label>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Ihre Unterschrift</h2>
              <button
                onClick={clearPad}
                className="flex items-center gap-1 text-sm text-gray-500"
              >
                <RotateCcw className="w-4 h-4" />
                Löschen
              </button>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
              <canvas
                ref={canvasRef}
                className="w-full h-48 touch-none"
                style={{ touchAction: "none" }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center">
              Bitte unterschreiben Sie im Feld oben mit dem Finger
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleSign}
          disabled={signMutation.isPending}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold disabled:opacity-50"
        >
          {signMutation.isPending ? "Wird gespeichert…" : "Jetzt unterschreiben"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd tenant-portal
git add src/pages/SignDocument.tsx
git commit -m "feat(tenant-portal): SignDocument page with SIMPLE + SIGNATURE_PAD modes"
```

---

## Task 27: UploadDocument Page

**Files:**
- Create: `tenant-portal/src/pages/UploadDocument.tsx`

- [ ] **Step 1: UploadDocument.tsx schreiben**

`tenant-portal/src/pages/UploadDocument.tsx`:
```typescript
import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { ArrowLeft, Upload, FileText, X } from "lucide-react";
import { useUploadDocument } from "@/hooks/api/useTenantDocuments";

const CATEGORIES = [
  "Mietvertrag",
  "Nebenkostenabrechnung",
  "Versicherung",
  "Personalausweis",
  "Sonstiges",
];

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function UploadDocument() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const uploadMutation = useUploadDocument(slug!);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ALLOWED_MIME_TYPES.includes(selected.type)) {
      setError("Nur PDF, JPG und PNG Dateien erlaubt.");
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError("Datei darf maximal 10 MB groß sein.");
      return;
    }
    setError(null);
    setFile(selected);
  }

  function removeFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Bitte wählen Sie eine Datei aus.");
      return;
    }
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (description.trim()) formData.append("description", description.trim());

    try {
      await uploadMutation.mutateAsync(formData);
      setDone(true);
    } catch {
      setError("Upload fehlgeschlagen. Bitte versuchen Sie es erneut.");
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dokument hochgeladen</h2>
        <p className="text-gray-500 mb-8">Ihre Datei wurde erfolgreich übermittelt.</p>
        <button
          onClick={() => navigate(`/${slug}/documents`)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold"
        >
          Zurück zu Dokumenten
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold">Dokument hochladen</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4">
        {/* Datei-Auswahl */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Datei auswählen</h2>
          {file ? (
            <div className="flex items-center gap-3 bg-gray-50 border rounded-lg px-3 py-2">
              <FileText className="w-8 h-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button type="button" onClick={removeFile}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 border-2 border-dashed border-gray-300 rounded-xl py-8 hover:border-primary transition-colors"
            >
              <Upload className="w-10 h-10 text-gray-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Datei auswählen</p>
                <p className="text-xs text-gray-400">PDF, JPG oder PNG · max. 10 MB</p>
              </div>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Kategorie */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Beschreibung */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Beschreibung <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurze Beschreibung des Dokuments…"
            rows={3}
            maxLength={500}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={uploadMutation.isPending}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold disabled:opacity-50"
        >
          {uploadMutation.isPending ? "Wird hochgeladen…" : "Hochladen"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd tenant-portal
git add src/pages/UploadDocument.tsx
git commit -m "feat(tenant-portal): UploadDocument page with file picker + category"
```

---

## Task 28: Tickets Page + NewTicket Page

**Files:**
- Create: `tenant-portal/src/pages/Tickets.tsx`
- Create: `tenant-portal/src/pages/NewTicket.tsx`

- [ ] **Step 1: Tickets.tsx schreiben**

`tenant-portal/src/pages/Tickets.tsx`:
```typescript
import { useParams, useNavigate } from "react-router-dom";
import { Plus, AlertCircle, Clock, CheckCircle, Wrench } from "lucide-react";
import { useTenantTickets, TenantTicket } from "@/hooks/api/useTenantTickets";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";

type StatusFilter = "ALLE" | "OFFEN" | "IN_BEARBEITUNG" | "GESCHLOSSEN";

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  GESCHLOSSEN: "Geschlossen",
};

function StatusIcon({ status }: { status: TenantTicket["status"] }) {
  if (status === "OFFEN") return <AlertCircle className="w-5 h-5 text-red-500" />;
  if (status === "IN_BEARBEITUNG") return <Wrench className="w-5 h-5 text-amber-500" />;
  return <CheckCircle className="w-5 h-5 text-green-500" />;
}

function StatusBadge({ status }: { status: TenantTicket["status"] }) {
  const colors: Record<string, string> = {
    OFFEN: "bg-red-100 text-red-700",
    IN_BEARBEITUNG: "bg-amber-100 text-amber-700",
    GESCHLOSSEN: "bg-green-100 text-green-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function Tickets() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: tickets, isLoading } = useTenantTickets(slug!);
  const [filter, setFilter] = useState<StatusFilter>("ALLE");

  const filtered =
    filter === "ALLE" ? tickets ?? [] : (tickets ?? []).filter((t) => t.status === filter);

  const tabs: StatusFilter[] = ["ALLE", "OFFEN", "IN_BEARBEITUNG", "GESCHLOSSEN"];
  const tabLabels: Record<StatusFilter, string> = {
    ALLE: "Alle",
    OFFEN: "Offen",
    IN_BEARBEITUNG: "In Bearb.",
    GESCHLOSSEN: "Erledigt",
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-semibold">Meine Tickets</h1>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b px-4">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                filter === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tabLabels[tab]}
              {tab !== "ALLE" && tickets && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({tickets.filter((t) => t.status === tab).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Keine Tickets in dieser Kategorie</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((ticket) => (
              <div key={ticket.id} className="bg-white border rounded-xl p-4 flex items-start gap-3">
                <div className="mt-0.5">
                  <StatusIcon status={ticket.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{ticket.title}</p>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{ticket.description}</p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {ticket.category} ·{" "}
                    {format(new Date(ticket.createdAt), "dd.MM.yyyy", { locale: de })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate(`/${slug}/tickets/new`)}
        className="fixed bottom-24 right-4 bg-primary text-primary-foreground w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: NewTicket.tsx schreiben**

`tenant-portal/src/pages/NewTicket.tsx`:
```typescript
import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, X, CheckCircle } from "lucide-react";
import { useCreateTicket } from "@/hooks/api/useTenantTickets";

const CATEGORIES = [
  "Sanitär",
  "Elektrik",
  "Heizung",
  "Fenster / Türen",
  "Schloss / Einbruch",
  "Schimmel",
  "Sonstiges",
];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export default function NewTicket() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const createMutation = useCreateTicket(slug!);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Nur JPG und PNG Fotos erlaubt.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Foto darf maximal 10 MB groß sein.");
      return;
    }
    setError(null);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Bitte geben Sie einen Titel ein.");
      return;
    }
    if (!description.trim()) {
      setError("Bitte beschreiben Sie das Problem.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("category", category);
    if (photo) formData.append("photo", photo);

    try {
      await createMutation.mutateAsync(formData);
      setDone(true);
    } catch {
      setError("Fehler beim Erstellen des Tickets. Bitte versuchen Sie es erneut.");
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ticket erstellt</h2>
        <p className="text-gray-500 mb-8">
          Ihr Anliegen wurde übermittelt. Die Verwaltung wird sich baldmöglichst darum kümmern.
        </p>
        <button
          onClick={() => navigate(`/${slug}/tickets`)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold"
        >
          Zurück zu Tickets
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold">Schaden melden</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4">
        {/* Titel */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Titel</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Heizung ausgefallen"
            maxLength={120}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Kategorie */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Beschreibung */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Beschreibung</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreiben Sie das Problem möglichst genau…"
            rows={4}
            maxLength={2000}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{description.length}/2000</p>
        </div>

        {/* Foto (optional) */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-900 mb-3">
            Foto <span className="font-normal text-gray-400">(optional)</span>
          </h2>
          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Vorschau"
                className="w-full rounded-lg object-cover max-h-48"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-6 hover:border-primary transition-colors"
            >
              <Camera className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-500">Foto aufnehmen oder auswählen</span>
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold disabled:opacity-50"
        >
          {createMutation.isPending ? "Wird übermittelt…" : "Ticket einreichen"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd tenant-portal
git add src/pages/Tickets.tsx src/pages/NewTicket.tsx
git commit -m "feat(tenant-portal): Tickets list with filter tabs + NewTicket form with camera"
```

---

## Task 29: Finances Page

**Files:**
- Create: `tenant-portal/src/pages/Finances.tsx`

- [ ] **Step 1: Finances.tsx schreiben**

`tenant-portal/src/pages/Finances.tsx`:
```typescript
import { useParams } from "react-router-dom";
import { TrendingUp, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useTenantFinances, RentPayment } from "@/hooks/api/useTenantFinances";
import { format } from "date-fns";
import { de } from "date-fns/locale";

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );
}

function StatusIcon({ status }: { status: RentPayment["status"] }) {
  if (status === "BEZAHLT") return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (status === "UEBERFAELLIG") return <AlertCircle className="w-5 h-5 text-red-500" />;
  return <Clock className="w-5 h-5 text-amber-500" />;
}

function StatusBadge({ status }: { status: RentPayment["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    BEZAHLT: { label: "Bezahlt", cls: "bg-green-100 text-green-700" },
    AUSSTEHEND: { label: "Ausstehend", cls: "bg-amber-100 text-amber-700" },
    UEBERFAELLIG: { label: "Überfällig", cls: "bg-red-100 text-red-700" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

export default function Finances() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useTenantFinances(slug!);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-semibold">Finanzen</h1>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Nächste Zahlung */}
        {isLoading ? (
          <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        ) : data?.nextPayment ? (
          <div
            className={`rounded-2xl p-5 text-white ${
              data.nextPayment.status === "UEBERFAELLIG"
                ? "bg-red-500"
                : "bg-primary"
            }`}
          >
            <p className="text-sm font-medium opacity-80 mb-1">Nächste Miete</p>
            <p className="text-4xl font-bold mb-1">{formatEur(data.nextPayment.amount)}</p>
            <p className="text-sm opacity-80">
              Fällig am{" "}
              {format(new Date(data.nextPayment.dueDate), "dd. MMMM yyyy", { locale: de })}
            </p>
            {data.nextPayment.status === "UEBERFAELLIG" && (
              <div className="flex items-center gap-1.5 mt-2 bg-white/20 rounded-lg px-3 py-1.5">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Zahlung überfällig</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border rounded-2xl p-5 text-center text-gray-400">
            Keine ausstehende Zahlung
          </div>
        )}

        {/* Offener Betrag gesamt */}
        {data && data.totalOpen > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              Offener Gesamtbetrag: <span className="font-semibold">{formatEur(data.totalOpen)}</span>
            </p>
          </div>
        )}

        {/* Zahlungshistorie */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Zahlungshistorie
            </h2>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !data?.payments.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Keine Zahlungen vorhanden</p>
          ) : (
            <div className="space-y-2">
              {data.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <StatusIcon status={payment.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {payment.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      Fällig: {format(new Date(payment.dueDate), "dd.MM.yyyy", { locale: de })}
                      {payment.paidDate &&
                        ` · Bezahlt: ${format(new Date(payment.paidDate), "dd.MM.yyyy", { locale: de })}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatEur(payment.amount)}
                    </p>
                    <StatusBadge status={payment.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd tenant-portal
git add src/pages/Finances.tsx
git commit -m "feat(tenant-portal): Finances page with next payment hero + payment history"
```

---

## Task 30: Messages Page (Chat UI)

**Files:**
- Create: `tenant-portal/src/pages/Messages.tsx`

- [ ] **Step 1: Messages.tsx schreiben**

`tenant-portal/src/pages/Messages.tsx`:
```typescript
import { useParams } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { Send } from "lucide-react";
import { useTenantMessages, useSendMessage } from "@/hooks/api/useTenantMessages";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isYesterday } from "date-fns";
import { de } from "date-fns/locale";

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Gestern ${format(d, "HH:mm")}`;
  return format(d, "dd.MM.yyyy HH:mm", { locale: de });
}

export default function Messages() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { data: messages, isLoading } = useTenantMessages(slug!);
  const sendMutation = useSendMessage(slug!);

  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const body = text.trim();
    if (!body || sendMutation.isPending) return;
    setText("");
    try {
      await sendMutation.mutateAsync(body);
    } catch {
      setText(body); // Restore text on error so user doesn't lose it
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const companyName = user?.companyName ?? "Verwaltung";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-0">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-semibold">Nachrichten</h1>
        <p className="text-xs text-gray-400 mt-0.5">{companyName}</p>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ paddingBottom: "80px" }}>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-12 w-2/3 rounded-2xl animate-pulse bg-gray-200 ${i % 2 === 0 ? "ml-auto" : ""}`}
              />
            ))}
          </div>
        ) : !messages?.length ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">
              Noch keine Nachrichten. Schreiben Sie der Verwaltung.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.direction === "TENANT_TO_ADMIN";
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-white border text-gray-900 rounded-bl-sm"
                  }`}
                >
                  {!isMine && (
                    <p className="text-xs font-semibold text-primary mb-1">{companyName}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isMine ? "text-primary-foreground/70 text-right" : "text-gray-400"
                    }`}
                  >
                    {formatMessageTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar — fixed at bottom above device bottom edge */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t px-4 py-3 flex items-end gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht schreiben…"
          rows={1}
          maxLength={2000}
          className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-32 overflow-y-auto"
          style={{ lineHeight: "1.5" }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          className="flex-shrink-0 bg-primary text-primary-foreground w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd tenant-portal
git add src/pages/Messages.tsx
git commit -m "feat(tenant-portal): Messages chat UI with 30s polling + send"
```

---

## Task 31: App.tsx Routes vervollständigen

**Files:**
- Modify: `tenant-portal/src/App.tsx`

- [ ] **Step 1: Alle neuen Routes in App.tsx eintragen**

Die folgenden Routes müssen in `App.tsx` im `<Routes>` Block innerhalb des `/:slug`-Segments ergänzt werden (hinter den bereits vorhandenen Routes für Login, AcceptInvite, Dashboard, Profile):

```tsx
// Neue Imports oben:
import Documents from "@/pages/Documents";
import SignDocumentPage from "@/pages/SignDocument";
import UploadDocument from "@/pages/UploadDocument";
import Tickets from "@/pages/Tickets";
import NewTicket from "@/pages/NewTicket";
import Finances from "@/pages/Finances";
import Messages from "@/pages/Messages";

// Neue Routes innerhalb <Route path="/:slug"> nach den bestehenden:
<Route
  path="documents"
  element={
    <ProtectedRoute>
      <Documents />
    </ProtectedRoute>
  }
/>
<Route
  path="documents/sign/:id"
  element={
    <ProtectedRoute>
      <SignDocumentPage />
    </ProtectedRoute>
  }
/>
<Route
  path="documents/upload"
  element={
    <ProtectedRoute>
      <UploadDocument />
    </ProtectedRoute>
  }
/>
<Route
  path="tickets"
  element={
    <ProtectedRoute>
      <Tickets />
    </ProtectedRoute>
  }
/>
<Route
  path="tickets/new"
  element={
    <ProtectedRoute>
      <NewTicket />
    </ProtectedRoute>
  }
/>
<Route
  path="finances"
  element={
    <ProtectedRoute>
      <Finances />
    </ProtectedRoute>
  }
/>
<Route
  path="messages"
  element={
    <ProtectedRoute>
      <Messages />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 2: BottomNav prüfen — alle 5 Links korrekt?**

`BottomNav.tsx` muss Links zu diesen Pfaden haben:
- `/${slug}/dashboard` — Start (Home icon)
- `/${slug}/documents` — Dokumente (FileText icon)
- `/${slug}/tickets` — Tickets (AlertCircle icon)
- `/${slug}/messages` — Nachrichten (MessageSquare icon)
- `/${slug}/profile` — Profil (User icon)

Falls ein Link noch fehlt oder auf falschen Pfad zeigt: korrigieren.

- [ ] **Step 3: Commit**

```bash
cd tenant-portal
git add src/App.tsx src/components/BottomNav.tsx
git commit -m "feat(tenant-portal): wire all routes in App.tsx + verify BottomNav links"
```

---

## Task 32: Admin UI — Einladung senden

**Files:**
- Modify: `cozy-estate-central/src/hooks/api/useTenants.ts`
- Modify: `cozy-estate-central/src/pages/Tenants.tsx`

**Ziel:** In der bestehenden Mieterliste des Admin-Frontends einen "Einladung senden" Button ergänzen, der `POST /api/tenants/:id/invite` aufruft.

- [ ] **Step 1: useTenants.ts — inviteTenant Mutation ergänzen**

`cozy-estate-central/src/hooks/api/useTenants.ts` lesen, dann folgende Mutation ergänzen:

```typescript
// Import ergänzen falls noch nicht vorhanden:
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Neue Mutation (am Ende des Files oder nach anderen Mutations):
export function useInviteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: number) =>
      api(`/api/tenants/${tenantId}/invite`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}
```

- [ ] **Step 2: Tenants.tsx lesen**

Datei `cozy-estate-central/src/pages/Tenants.tsx` lesen um zu verstehen, wie die Mieterliste gerendert wird — welche Spalten, welche Action-Buttons existieren bereits (z.B. Bearbeiten, Löschen).

- [ ] **Step 3: "Einladung senden" Button in Mieterliste einfügen**

In der Zeilen-Aktionsspalte der Mieterliste (dort wo Bearbeiten/Löschen stehen) einen neuen Button ergänzen:

```tsx
// Imports ergänzen:
import { useInviteTenant } from "@/hooks/api/useTenants";
import { Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Im Component:
const inviteMutation = useInviteTenant();
const { toast } = useToast();

async function handleInvite(tenantId: number, tenantName: string) {
  try {
    await inviteMutation.mutateAsync(tenantId);
    toast({
      title: "Einladung gesendet",
      description: `${tenantName} erhält eine E-Mail mit dem Einladungslink.`,
    });
  } catch {
    toast({
      title: "Fehler",
      description: "Einladung konnte nicht gesendet werden.",
      variant: "destructive",
    });
  }
}

// Button in der Aktionsspalte (nach bestehendem Code, vor Löschen-Button):
<Button
  variant="ghost"
  size="sm"
  onClick={() => handleInvite(tenant.id, `${tenant.firstName} ${tenant.lastName}`)}
  disabled={inviteMutation.isPending}
  title="Einladung per E-Mail senden"
>
  {inviteMutation.isPending ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : (
    <Mail className="w-4 h-4" />
  )}
</Button>
```

- [ ] **Step 4: TypeScript prüfen**

```bash
cd cozy-estate-central
npx tsc --noEmit
```

Alle TypeScript-Fehler beheben bevor Commit.

- [ ] **Step 5: Commit**

```bash
cd cozy-estate-central
git add src/hooks/api/useTenants.ts src/pages/Tenants.tsx
git commit -m "feat(admin): Einladung senden Button in Mieterliste"
```

---

## Task 33: Integration-Test manuell

Dieser Task verifiziert, dass der komplette End-to-End-Flow funktioniert.

**Voraussetzung:** Backend läuft (`cd backend && npm run dev`), tenant-portal läuft (`cd tenant-portal && npm run dev`), Admin-Frontend läuft (`cd cozy-estate-central && npm run dev`).

- [ ] **Step 1: Company slug prüfen**

```bash
cd backend
npx prisma studio
```

In Prisma Studio: `Company`-Tabelle öffnen. Prüfen dass die Testfirma einen `slug` hat (z.B. `mustermann-hv`). Falls nicht: `slug` in der Datenbank setzen (über Prisma Studio direkt editieren oder `npx prisma db execute --stdin` mit UPDATE query).

- [ ] **Step 2: Branding-Endpunkt testen**

```bash
curl http://localhost:3001/api/tenant/company/mustermann-hv
```

Erwartetes Ergebnis:
```json
{
  "data": {
    "name": "Mustermann Hausverwaltung GmbH",
    "slug": "mustermann-hv",
    "logoUrl": null,
    "primaryColor": "#2563eb"
  }
}
```

- [ ] **Step 3: Einladung senden (Admin-Frontend)**

1. Admin-Frontend öffnen: http://localhost:8080
2. Einloggen mit admin@immoverwalt.de / Admin123!
3. Zu Mieter-Seite navigieren
4. Bei einem Mieter auf Mail-Icon klicken
5. Toast-Meldung "Einladung gesendet" erscheint

- [ ] **Step 4: Invite-Token prüfen**

```bash
cd backend
npx prisma studio
```

`TenantUser`-Tabelle: Prüfen dass ein Eintrag mit `inviteToken` und `inviteExpiresAt` erstellt wurde.

- [ ] **Step 5: Invite-Link im Portal testen**

Tenant-Portal aufrufen: http://localhost:5173/mustermann-hv/invite/\<TOKEN\>

Erwartung:
- Branding lädt (Firmenname + Primärfarbe)
- "Passwort festlegen" Formular erscheint
- Nach Absenden → Weiterleitung zu Dashboard

- [ ] **Step 6: Login testen**

http://localhost:5173/mustermann-hv/login

Erwartung: Login mit soeben gesetztem Passwort → Dashboard mit Mietdaten

- [ ] **Step 7: Alle Seiten im Portal durchklicken**

Folgende Seiten öffnen und prüfen dass sie laden (kein weißer Screen, keine Konsolen-Errors):
- Dashboard
- Dokumente
- Tickets → Neues Ticket Button
- Finanzen
- Nachrichten → Nachricht senden
- Profil → Abmelden

- [ ] **Step 8: Abschließender Commit falls Bugfixes nötig**

```bash
git add -A
git commit -m "fix(tenant-portal): integration test bugfixes"
```

---

## Zusammenfassung Teil 4

Nach Abschluss aller Tasks in Teil 4:

| Feature | Status |
|---------|--------|
| API Hooks (Dokumente, Tickets, Finanzen, Nachrichten) | Task 24 |
| Documents Page mit Signatur-Banner | Task 25 |
| SignDocument (SIMPLE + SIGNATURE_PAD) | Task 26 |
| UploadDocument Page | Task 27 |
| Tickets List + NewTicket Form | Task 28 |
| Finances Page | Task 29 |
| Messages Chat UI | Task 30 |
| App.tsx Routes vollständig | Task 31 |
| Admin: Einladung senden Button | Task 32 |
| E2E Integration-Test | Task 33 |

Das Tenant-Portal ist dann feature-complete entsprechend dem Design-Spec.
