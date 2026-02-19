import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import type { UpdateCompanyInput } from "../schemas/company.schema.js";

export async function getCompany(companyId: number) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new AppError(404, "Firma nicht gefunden");
  }

  return company;
}

export async function updateCompany(companyId: number, data: UpdateCompanyInput) {
  const company = await prisma.company.update({
    where: { id: companyId },
    data,
  });

  return company;
}
