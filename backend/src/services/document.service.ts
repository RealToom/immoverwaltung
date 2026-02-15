import { prisma } from "../lib/prisma.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";

export async function listDocuments(companyId: number, propertyId: number) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new NotFoundError("Immobilie", propertyId);

  return prisma.document.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDocument(
  companyId: number,
  propertyId: number,
  data: { name: string; fileType: string; fileSize?: string; filePath?: string | null }
) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, companyId } });
  if (!property) throw new NotFoundError("Immobilie", propertyId);

  return prisma.document.create({
    data: {
      name: data.name,
      fileType: data.fileType,
      fileSize: data.fileSize ?? "0 KB",
      filePath: data.filePath ?? null,
      propertyId,
    },
  });
}

export async function deleteDocument(companyId: number, id: number) {
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { property: { select: { companyId: true } } },
  });
  if (!doc) throw new NotFoundError("Dokument", id);
  if (doc.property.companyId !== companyId) throw new ForbiddenError();

  return prisma.document.delete({ where: { id } });
}
