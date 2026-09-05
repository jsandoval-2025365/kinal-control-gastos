import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { Errors } from "../../utils/AppError";
import { CreateIncomeInput, UpdateIncomeInput } from "./income.validators";

type IncomeRecord = {
  id: string;
  userId: string;
  source: string;
  amount: Prisma.Decimal;
  frequency: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Convierte el registro de Prisma a un DTO serializable en JSON.
 * `amount` viaja como Decimal en la base de datos (precisión exacta para
 * dinero); se convierte a number solo en el borde de salida hacia el
 * cliente, donde ya no hay más aritmética acumulativa que proteger.
 */
function toDTO(income: IncomeRecord) {
  return {
    id: income.id,
    source: income.source,
    amount: Number(income.amount),
    frequency: income.frequency,
    date: income.date,
    createdAt: income.createdAt,
    updatedAt: income.updatedAt,
  };
}

export class IncomeService {
  async listForUser(userId: string) {
    const incomes = await prisma.income.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });
    return incomes.map(toDTO);
  }

  /**
   * Control de propiedad (mismo principio que `getNoteForUser`, sección 13):
   * un usuario solo puede leer sus propios ingresos. A diferencia de las
   * notas, aquí NO se da bypass a ADMIN — son datos financieros personales
   * y ningún flujo actual del proyecto requiere que un admin los consulte.
   */
  async getForUser(id: string, userId: string) {
    const income = await prisma.income.findUnique({ where: { id } });
    if (!income) throw Errors.notFound("Ingreso no encontrado");
    if (income.userId !== userId) {
      throw Errors.forbidden("No tienes acceso a este recurso");
    }
    return toDTO(income);
  }

  async create(userId: string, input: CreateIncomeInput) {
    const income = await prisma.income.create({
      data: {
        userId,
        source: input.source,
        amount: input.amount,
        frequency: input.frequency,
        date: input.date,
      },
    });
    return toDTO(income);
  }

  async update(id: string, userId: string, input: UpdateIncomeInput) {
    const existing = await prisma.income.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Ingreso no encontrado");
    if (existing.userId !== userId) {
      throw Errors.forbidden("No tienes acceso a este recurso");
    }

    const income = await prisma.income.update({
      where: { id },
      data: {
        ...(input.source !== undefined && { source: input.source }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.frequency !== undefined && { frequency: input.frequency }),
        ...(input.date !== undefined && { date: input.date }),
      },
    });
    return toDTO(income);
  }

  async remove(id: string, userId: string) {
    const existing = await prisma.income.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Ingreso no encontrado");
    if (existing.userId !== userId) {
      throw Errors.forbidden("No tienes acceso a este recurso");
    }
    await prisma.income.delete({ where: { id } });
  }
}

export const incomeService = new IncomeService();