import type { Request, Response } from "express";
import * as companyService from "../services/company.service.js";
import type { UpdateCompanyInput } from "../schemas/company.schema.js";

export async function getCompanyHandler(req: Request, res: Response) {
  const company = await companyService.getCompany(req.companyId!);
  res.json({ data: company });
}

export async function updateCompanyHandler(req: Request, res: Response) {
  const data = req.body as UpdateCompanyInput;
  const company = await companyService.updateCompany(req.companyId!, data);
  res.json({ data: company });
}
