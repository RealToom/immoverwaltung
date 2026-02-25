import Handlebars from "handlebars";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function listTemplates(companyId: number) {
  return prisma.documentTemplate.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });
}

export async function createTemplate(
  companyId: number,
  data: { name: string; category: string; content: string },
) {
  try {
    Handlebars.compile(data.content);
  } catch {
    throw new AppError(400, "Ungültiges Template-Format (Handlebars-Fehler)");
  }
  return prisma.documentTemplate.create({ data: { ...data, companyId } });
}

export async function updateTemplate(
  companyId: number,
  id: number,
  data: Record<string, unknown>,
) {
  const t = await prisma.documentTemplate.findFirst({ where: { id, companyId } });
  if (!t) throw new AppError(404, "Vorlage nicht gefunden");
  if (typeof data.content === "string") {
    try {
      Handlebars.compile(data.content);
    } catch {
      throw new AppError(400, "Ungültiges Template-Format (Handlebars-Fehler)");
    }
  }
  return prisma.documentTemplate.update({ where: { id }, data: data as never });
}

export async function deleteTemplate(companyId: number, id: number) {
  const t = await prisma.documentTemplate.findFirst({ where: { id, companyId } });
  if (!t) throw new AppError(404, "Vorlage nicht gefunden");
  await prisma.documentTemplate.delete({ where: { id } });
}

export async function renderTemplate(
  companyId: number,
  id: number,
  variables: Record<string, unknown>,
): Promise<string> {
  const t = await prisma.documentTemplate.findFirst({ where: { id, companyId } });
  if (!t) throw new AppError(404, "Vorlage nicht gefunden");
  const compiled = Handlebars.compile(t.content, { strict: true, noEscape: false });
  return compiled(variables, {
    allowProtoPropertiesByDefault: false,
    allowProtoMethodsByDefault: false,
  });
}
