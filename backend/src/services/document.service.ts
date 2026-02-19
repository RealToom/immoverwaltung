import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";
import { encryptFile, isEncryptionEnabled } from "../lib/crypto.js";

export async function listDocuments(companyId: number, propertyId: number) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new NotFoundError("Immobilie", propertyId);

  return prisma.document.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listTenantDocuments(companyId: number, tenantId: number) {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, companyId } });
  if (!tenant) throw new NotFoundError("Mieter", tenantId);

  return prisma.document.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocument(companyId: number, id: number) {
  const doc = await prisma.document.findFirst({
    where: { id, companyId },
  });
  if (!doc) throw new NotFoundError("Dokument", id);
  return doc;
}

interface CreateDocumentData {
  name: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  propertyId?: number;
  tenantId?: number;
  retentionUntil?: Date | null;
}

export async function createDocument(companyId: number, data: CreateDocumentData) {
  // Validate ownership
  if (data.propertyId) {
    const property = await prisma.property.findFirst({ where: { id: data.propertyId, companyId } });
    if (!property) throw new NotFoundError("Immobilie", data.propertyId);
  }
  if (data.tenantId) {
    const tenant = await prisma.tenant.findFirst({ where: { id: data.tenantId, companyId } });
    if (!tenant) throw new NotFoundError("Mieter", data.tenantId);
  }

  // DSGVO Art. 32 - Encrypt file at rest if encryption is enabled
  let filePath = data.filePath;
  let encrypted = false;
  if (isEncryptionEnabled()) {
    filePath = encryptFile(data.filePath);
    encrypted = true;
  }

  return prisma.document.create({
    data: {
      name: data.name,
      fileType: data.fileType,
      fileSize: data.fileSize,
      filePath,
      propertyId: data.propertyId ?? null,
      tenantId: data.tenantId ?? null,
      companyId,
      retentionUntil: data.retentionUntil ?? null,
      isEncrypted: encrypted,
    },
  });
}

export async function deleteDocument(companyId: number, id: number) {
  const doc = await prisma.document.findFirst({
    where: { id, companyId },
  });
  if (!doc) throw new NotFoundError("Dokument", id);

  // Delete file from disk
  if (doc.filePath) {
    try {
      fs.unlinkSync(doc.filePath);
    } catch {
      // File may already be deleted - continue with DB cleanup
    }
  }

  return prisma.document.delete({ where: { id } });
}
