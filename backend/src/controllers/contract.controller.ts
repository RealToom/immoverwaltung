import type { Request, Response } from "express";
import type { ContractStatus, ContractType } from "@prisma/client";
import * as contractService from "../services/contract.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await contractService.listContracts(req.companyId!, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    search: (req.query.search as string) || "",
    status: req.query.status as ContractStatus | undefined,
    type: req.query.type as ContractType | undefined,
    propertyId: req.query.propertyId ? Number(req.query.propertyId) : undefined,
  });
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const contract = await contractService.getContract(req.companyId!, Number(req.params.id));
  res.json({ data: contract });
}

export async function create(req: Request, res: Response): Promise<void> {
  const contract = await contractService.createContract(req.companyId!, req.body);
  res.status(201).json({ data: contract });
}

export async function update(req: Request, res: Response): Promise<void> {
  const contract = await contractService.updateContract(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: contract });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await contractService.deleteContract(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
