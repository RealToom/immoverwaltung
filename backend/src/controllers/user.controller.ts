import type { Request, Response } from "express";
import * as userService from "../services/user.service.js";

export async function getUsers(req: Request, res: Response): Promise<void> {
  const users = await userService.listUsers(req.companyId!);
  res.json({ data: users });
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const user = await userService.createUser(req.companyId!, req.body);
  res.status(201).json({ data: user });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const user = await userService.updateUser(req.companyId!, id, req.body);
  res.json({ data: user });
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  await userService.deleteUser(req.companyId!, id, req.user!.id);
  res.status(204).send();
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const result = await userService.resetUserPassword(req.companyId!, id);
  res.json({ data: result });
}

export async function unlockUser(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  await userService.unlockUser(req.companyId!, id);
  res.json({ data: { message: "Benutzer entsperrt" } });
}
