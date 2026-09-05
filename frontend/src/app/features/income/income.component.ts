import { Component, HostListener, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { SessionTimeoutService } from "../../core/auth/session-timeout.service";
import { NotificationService } from "../../shared/coming-soon/notifications/notification.service";
import { IncomeService } from "./income.service";
import {
  Income,
  IncomeFrequency,
  IncomePayload,
  IncomeSourceSummary,
  groupBySource,
  monthOverMonthDeltaPct,
  sumIncomesForMonth,
} from "../../core/models/income.model";

@Component({
  selector: "app-income",
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: "./income.component.html",
  styleUrl: "./income.component.css",
})
export class IncomeComponent implements OnInit {
  userMenuOpen = signal(false);

  incomes = signal<Income[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  // --- Formulario embebido (alta / edición), sin componente aparte ---
  formOpen = signal(false);
  editingId = signal<string | null>(null);
  formSource = "";
  formAmount: number | null = null;
  formFrequency: IncomeFrequency = "VARIABLE";
  formDate = this.todayIso();
  saving = signal(false);
  formError = signal<string | null>(null);

  // --- KPIs y agregaciones derivadas ---
  readonly totalThisMonth = computed(() => sumIncomesForMonth(this.incomes()));
  readonly monthDeltaPct = computed(() => monthOverMonthDeltaPct(this.incomes()));
  readonly activeSources = computed(() => groupBySource(this.incomes()));

  readonly mainSource = computed(() => this.activeSources()[0] ?? null);
  readonly mainSourceShare = computed(() => {
    const main = this.mainSource();
    const total = this.incomes().reduce((sum, i) => sum + i.amount, 0);
    return main && total > 0 ? (main.total / total) * 100 : 0;
  });

  readonly frequencyBreakdown = computed(() => {
    const counts: Record<IncomeFrequency, number> = { MENSUAL: 0, VARIABLE: 0, UNICA: 0 };
    for (const s of this.activeSources()) counts[s.frequency]++;
    const order: IncomeFrequency[] = ["MENSUAL", "VARIABLE", "UNICA"];
    return order
      .filter((f) => counts[f] > 0)
      .map((f) => {
        const [singular, plural] = this.frequencyLabelsPlural[f];
        return `${counts[f]} ${counts[f] === 1 ? singular : plural}`;
      })
      .join(" · ");
  });

  readonly recentHistory = computed(() =>
    [...this.incomes()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
  );

  private readonly frequencyLabelsPlural: Record<IncomeFrequency, [string, string]> = {
    MENSUAL: ["mensual", "mensuales"],
    VARIABLE: ["variable", "variables"],
    UNICA: ["única", "únicas"],
  };

  get isEditMode(): boolean {
    return this.editingId() !== null;
  }

  constructor(
    public auth: AuthService,
    private router: Router,
    private sessionTimeout: SessionTimeoutService,
    private notifications: NotificationService,
    private incomeService: IncomeService
  ) {}

  ngOnInit(): void {
    this.loadIncomes();
  }

  get initials(): string {
    const email = this.auth.currentUser()?.email ?? "";
    return email.slice(0, 2).toUpperCase();
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update((open) => !open);
  }

  @HostListener("document:click")
  closeUserMenu(): void {
    if (this.userMenuOpen()) this.userMenuOpen.set(false);
  }

  goTo(path: string): void {
    this.userMenuOpen.set(false);
    this.router.navigate([path]);
  }

  // --- Formulario ---
  openCreateForm(): void {
    this.editingId.set(null);
    this.formSource = "";
    this.formAmount = null;
    this.formFrequency = "VARIABLE";
    this.formDate = this.todayIso();
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditForm(income: Income): void {
    this.editingId.set(income.id);
    this.formSource = income.source;
    this.formAmount = income.amount;
    this.formFrequency = income.frequency;
    this.formDate = income.date.slice(0, 10);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  /** "Editar" desde una tarjeta de fuente agrupada: abre el movimiento más reciente de esa fuente. */
  editSource(item: IncomeSourceSummary): void {
    const latest = this.latestMovementOf(item.source);
    if (latest) this.openEditForm(latest);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
  }

  submitForm(): void {
    this.formError.set(null);

    if (!this.formSource.trim()) {
      this.formError.set("La fuente de ingreso es requerida");
      return;
    }
    if (this.formAmount === null || this.formAmount <= 0) {
      this.formError.set("El monto debe ser mayor a 0");
      return;
    }
    if (!this.formDate) {
      this.formError.set("La fecha es requerida");
      return;
    }

    const payload: IncomePayload = {
      source: this.formSource.trim(),
      amount: this.formAmount,
      frequency: this.formFrequency,
      date: this.formDate,
    };

    this.saving.set(true);
    const id = this.editingId();
    const request$ = id ? this.incomeService.update(id, payload) : this.incomeService.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        const wasEditing = id !== null;
        this.closeForm();
        this.loadIncomes();
        this.notifications.success(wasEditing ? "Ingreso actualizado" : "Ingreso agregado");
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.error ?? "No se pudo guardar el ingreso");
      },
    });
  }

  // --- Eliminar ---
  deleteIncome(income: Income): void {
    this.notifications.warning({
      message: `¿Eliminar el ingreso "${income.source}" (${this.formatAmount(income.amount)})? Esta acción no se puede deshacer.`,
      actionLabel: "Eliminar",
      onAction: () => this.performDelete(income.id),
    });
  }

  /** "Eliminar" desde una tarjeta de fuente: solo borra el movimiento más reciente de esa fuente (se avisa en el mensaje). */
  deleteSource(item: IncomeSourceSummary): void {
    const latest = this.latestMovementOf(item.source);
    if (!latest) return;

    this.notifications.warning({
      message: `"${item.source}" tiene ${this.formatAmount(item.total)} acumulados en varios movimientos. Esto elimina solo el más reciente (${this.formatShortDate(latest.date)}, ${this.formatAmount(latest.amount)}). ¿Continuar?`,
      actionLabel: "Eliminar",
      onAction: () => this.performDelete(latest.id),
    });
  }

  private latestMovementOf(source: string): Income | undefined {
    return this.incomes()
      .filter((i) => i.source === source)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }

  private performDelete(id: string): void {
    this.incomeService.delete(id).subscribe({
      next: () => {
        this.loadIncomes();
        this.notifications.success("Ingreso eliminado");
      },
      error: (err) => {
        this.notifications.error(err?.error?.error ?? "No se pudo eliminar el ingreso");
      },
    });
  }

  // --- Presentación ---
  sourceColor(i: number): string {
    const palette = ["var(--navy)", "var(--cobalt)", "var(--coral)", "var(--turquoise)"];
    return palette[i % palette.length] ?? "var(--gray-mid)";
  }

  sourceInitials(source: string): string {
    return source.trim().slice(0, 2).toUpperCase();
  }

  sourceIndex(source: string): number {
    return this.activeSources().findIndex((s) => s.source === source);
  }

  formatAmount(n: number): string {
    return "Q " + n.toLocaleString("es-GT", { maximumFractionDigits: 2 });
  }

  formatPct(n: number): string {
    return `${Math.abs(n).toFixed(1)}%`;
  }

  formatShortDate(iso: string): string {
    return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short" }).format(new Date(iso));
  }

  frequencyLabel(freq: string): string {
    const labels: Record<string, string> = { MENSUAL: "Mensual", VARIABLE: "Variable", UNICA: "Única" };
    return labels[freq] ?? freq;
  }

  notImplementedYet(): void {
    this.notifications.info("Esta función estará disponible próximamente.");
  }

  onLogout(): void {
    this.sessionTimeout.stop();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(["/login"]),
      error: () => this.router.navigate(["/login"]),
    });
  }

  private loadIncomes(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.incomeService.list().subscribe({
      next: (res) => {
        this.incomes.set(res.incomes);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(err?.error?.error ?? "No se pudieron cargar los ingresos");
      },
    });
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}