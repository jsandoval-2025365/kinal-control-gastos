import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { incomeService } from "./income.service";
import { createIncomeSchema, updateIncomeSchema } from "./income.validators";

export const listIncome = asyncHandler(async (req: Request, res: Response) => {
  const incomes = await incomeService.listForUser(req.user!.id);
  res.status(200).json({ incomes });
});

export const getIncome = asyncHandler(async (req: Request, res: Response) => {
  const income = await incomeService.getForUser(req.params.id, req.user!.id);
  res.status(200).json({ income });
});

export const createIncome = asyncHandler(async (req: Request, res: Response) => {
  const input = createIncomeSchema.parse(req.body);
  const income = await incomeService.create(req.user!.id, input);
  res.status(201).json({ income });
});

export const updateIncome = asyncHandler(async (req: Request, res: Response) => {
  const input = updateIncomeSchema.parse(req.body);
  const income = await incomeService.update(req.params.id, req.user!.id, input);
  res.status(200).json({ income });
});

export const deleteIncome = asyncHandler(async (req: Request, res: Response) => {
  await incomeService.remove(req.params.id, req.user!.id);
  res.status(204).send();
});