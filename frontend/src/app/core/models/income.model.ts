export type IncomeFrequency = "MENSUAL" | "VARIABLE" | "UNICA";

export interface Income {
  id: string;
  source: string;
  amount: number;
  frequency: IncomeFrequency;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomePayload {
  source: string;
  amount: number;
  frequency: IncomeFrequency;
  date: string;
}

export interface IncomeSourceSummary {
  source: string;
  total: number;
  frequency: IncomeFrequency;
  lastDate: string;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Suma de ingresos cuyo `date` cae en el mes/año de `reference` (por defecto, hoy). */
export function sumIncomesForMonth(incomes: Income[], reference: Date = new Date()): number {
  return incomes
    .filter((i) => isSameMonth(new Date(i.date), reference))
    .reduce((sum, i) => sum + i.amount, 0);
}

/** % de variación del mes de `reference` contra el mes anterior. `null` si el mes anterior no tuvo ingresos (evita división entre cero). */
export function monthOverMonthDeltaPct(incomes: Income[], reference: Date = new Date()): number | null {
  const previousMonth = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const current = sumIncomesForMonth(incomes, reference);
  const previous = sumIncomesForMonth(incomes, previousMonth);
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Agrupa los ingresos por `source`, sumando montos y quedándose con la fecha/frecuencia más reciente. Ordenado de mayor a menor total. */
export function groupBySource(incomes: Income[]): IncomeSourceSummary[] {
  const map = new Map<string, IncomeSourceSummary>();
  for (const income of incomes) {
    const existing = map.get(income.source);
    if (existing) {
      existing.total += income.amount;
      if (new Date(income.date) > new Date(existing.lastDate)) {
        existing.lastDate = income.date;
        existing.frequency = income.frequency;
      }
    } else {
      map.set(income.source, {
        source: income.source,
        total: income.amount,
        frequency: income.frequency,
        lastDate: income.date,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}