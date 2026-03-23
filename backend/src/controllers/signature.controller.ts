import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { renderTemplate } from "../services/document-template.service.js";
import {
  uploadDocument,
  createSignatureRequest,
  activateRequest,
  getSignedDocument,
} from "../services/yousign.service.js";
import { sendForSignatureSchema } from "../schemas/signature.schema.js";

async function renderToPdfBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(11).text(text, { lineGap: 4 });
    doc.end();
  });
}

export async function sendForSignature(req: Request, res: Response): Promise<void> {
  if (!env.YOUSIGN_API_KEY) {
    throw new AppError(503, "Signaturservice nicht konfiguriert");
  }

  const contractId = parseInt(req.params.id as string, 10);
  const { templateId, signerEmail, signerName } = sendForSignatureSchema.parse(req.body);

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, companyId: req.companyId as number },
    include: { tenant: true },
  });
  if (!contract) throw new AppError(404, "Vertrag nicht gefunden");

  if (contract.signatureStatus === "AUSSTEHEND") {
    throw new AppError(409, "Unterschrift bereits angefordert");
  }

  const rendered = await renderTemplate(req.companyId as number, templateId, {
    contract,
    tenant: contract.tenant,
  });

  const pdfBuffer = await renderToPdfBuffer(rendered);

  const email = signerEmail ?? contract.tenant.email;
  const name = signerName ?? contract.tenant.name;
  if (!email) throw new AppError(400, "Keine E-Mail-Adresse für Mieter vorhanden");

  const parts = name.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || parts[0];

  const documentId = await uploadDocument(pdfBuffer, `Mietvertrag-${contractId}.pdf`);
  const signatureRequestId = await createSignatureRequest(
    documentId,
    { email, firstName, lastName },
    contractId,
  );
  await activateRequest(signatureRequestId);

  await prisma.contract.update({
    where: { id: contractId },
    data: { signatureStatus: "AUSSTEHEND", signatureRequestId },
  });

  res.json({ data: { signatureRequestId, status: "AUSSTEHEND" } });
}

export async function getSignatureStatus(req: Request, res: Response): Promise<void> {
  const contractId = parseInt(req.params.id as string, 10);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, companyId: req.companyId },
    select: { signatureStatus: true, signatureRequestId: true },
  });
  if (!contract) throw new AppError(404, "Vertrag nicht gefunden");
  res.json({ data: { signatureStatus: contract.signatureStatus } });
}

export async function downloadSignedDocument(req: Request, res: Response): Promise<void> {
  const contractId = parseInt(req.params.id as string, 10);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, companyId: req.companyId },
    select: {
      signedDocumentId: true,
      signatureRequestId: true,
      signatureStatus: true,
    },
  });
  if (!contract) throw new AppError(404, "Vertrag nicht gefunden");

  if (!contract.signedDocumentId || !contract.signatureRequestId) {
    throw new AppError(409, "Dokument noch nicht verfügbar");
  }

  const pdfBuffer = await getSignedDocument(
    contract.signatureRequestId,
    contract.signedDocumentId,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Mietvertrag-${contractId}-signed.pdf"`,
  );
  res.send(pdfBuffer);
}
