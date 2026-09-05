import { Router } from "express";
import * as incomeController from "./income.controller";
import { authenticate } from "../../middleware/authenticate";

export const incomeRouter = Router();

incomeRouter.get("/", authenticate, incomeController.listIncome);
incomeRouter.get("/:id", authenticate, incomeController.getIncome);
incomeRouter.post("/", authenticate, incomeController.createIncome);
incomeRouter.put("/:id", authenticate, incomeController.updateIncome);
incomeRouter.delete("/:id", authenticate, incomeController.deleteIncome);