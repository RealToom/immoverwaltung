import type { Request, Response } from "express";
import { consumptionQuerySchema, energyPassportSchema, propertyIdParamSchema } from "../schemas/energy.schema.js";
import { getConsumption } from "../services/energy-consumption.service.js";
import { getPassport, upsertPassport } from "../services/energy-passport.service.js";

export async function getConsumptionHandler(req: Request, res: Response): Promise<void> {
  const { propertyId, year } = consumptionQuerySchema.parse(req.query);
  const data = await getConsumption(req.companyId!, propertyId, year);
  res.json({ data });
}

export async function getPassportHandler(req: Request, res: Response): Promise<void> {
  const { propertyId } = propertyIdParamSchema.parse(req.params);
  const passport = await getPassport(req.companyId!, propertyId);
  res.json({ data: passport });
}

export async function upsertPassportHandler(req: Request, res: Response): Promise<void> {
  const { propertyId } = propertyIdParamSchema.parse(req.params);
  const data = energyPassportSchema.parse(req.body);
  const passport = await upsertPassport(req.companyId!, propertyId, data);
  res.json({ data: passport });
}
