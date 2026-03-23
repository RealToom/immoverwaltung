import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

function yousignHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.YOUSIGN_API_KEY}`,
  };
}

export async function uploadDocument(pdfBuffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), filename);
  form.append("nature", "signable_document");

  let res: Response;
  try {
    res = await fetch(`${env.YOUSIGN_BASE_URL}/documents`, {
      method: "POST",
      headers: yousignHeaders(),
      body: form,
    });
  } catch {
    throw new AppError(502, "Signaturservice nicht verfügbar");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError(502, `Yousign Fehler: ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

interface Signer {
  email: string;
  firstName: string;
  lastName: string;
}

export async function createSignatureRequest(
  documentId: string,
  signer: Signer,
  contractId: number,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${env.YOUSIGN_BASE_URL}/signature_requests`, {
      method: "POST",
      headers: { ...yousignHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mietvertrag",
        documents: [{ document_id: documentId }],
        signers: [
          {
            info: {
              email: signer.email,
              first_name: signer.firstName,
              last_name: signer.lastName,
            },
            signature_level: "electronic_signature",
            fields: [
              {
                type: "signature",
                document_id: documentId,
                page: 1,
                x: 150,
                y: 700,
                width: 200,
                height: 50,
              },
            ],
          },
        ],
        external_id: String(contractId),
      }),
    });
  } catch {
    throw new AppError(502, "Signaturservice nicht verfügbar");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError(502, `Yousign Fehler: ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function activateRequest(signatureRequestId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/activate`,
      {
        method: "POST",
        headers: { ...yousignHeaders(), "Content-Type": "application/json" },
      },
    );
  } catch {
    throw new AppError(502, "Signaturservice nicht verfügbar");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError(502, `Yousign Fehler: ${body}`);
  }
}

export async function getSignedDocument(
  signatureRequestId: string,
  documentId: string,
): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(
      `${env.YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/documents/${documentId}/download`,
      { headers: yousignHeaders() },
    );
  } catch {
    throw new AppError(502, "Signaturservice nicht verfügbar");
  }

  if (!res.ok) {
    throw new AppError(502, "Signiertes Dokument nicht verfügbar");
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
