import { Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "./auth.service";
import { NotificationService } from "../../shared/coming-soon/notifications/notification.service";

/**
 * Debe coincidir con `SESSION_REFRESH_GRACE_SECONDS` del backend
 * (backend/src/config/env.ts). Si cambias uno, cambia el otro.
 */
const GRACE_MS = 60_000;

/**
 * Orquesta el aviso de expiración de sesión:
 *
 *  1. Cuando el JWT expira, muestra una notificación de advertencia con
 *     cuenta regresiva y un botón "Continuar sesión".
 *  2. Durante ese minuto de gracia, CUALQUIER petición HTTP del usuario
 *     (detectada por `authInterceptor` vía `notifyActivity()`) renueva la
 *     sesión automáticamente — no hace falta que el usuario presione nada.
 *  3. Si el minuto pasa sin actividad, fuerza el cierre de sesión: llama
 *     al backend para revocar la sesión y limpiar la cookie, y redirige a
 *     `/login`.
 *
 * No conoce nada de componentes de UI concretos — solo habla con
 * `NotificationService` (genérico) y `AuthService`. Esto es justo el
 * patrón de "conexión sin acoplamiento" que evita que un componente
 * dependa directamente de otro.
 */
@Injectable({ providedIn: "root" })
export class SessionTimeoutService {
  /** true mientras está activa la ventana de gracia de 1 minuto. */
  readonly graceActive = signal(false);

  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private notificationId: string | null = null;
  private graceDeadline: number | null = null;

  constructor(
    private auth: AuthService,
    private notifications: NotificationService,
    private router: Router
  ) {}

  /** Reprograma el aviso según el `expiresAt` vigente (llamar tras login/refresh/reload). */
  scheduleFromExpiresAt(expiresAt: Date | null): void {
    this.clearTimers();
    if (!expiresAt) return;

    const msUntilExpiry = expiresAt.getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      this.handleExpiry();
      return;
    }
    this.expiryTimer = setTimeout(() => this.handleExpiry(), msUntilExpiry);
  }

  /**
   * Llamado por `authInterceptor` en cada petición HTTP exitosa. Si
   * estamos dentro de la ventana de gracia, cuenta como "el usuario volvió
   * a hacer una petición / acceder a un recurso" y renueva la sesión.
   */
  notifyActivity(): void {
    if (this.graceActive()) {
      this.extendNow();
    }
  }

  /** Se llama al hacer logout manual, para no dejar timers corriendo de fondo. */
  stop(): void {
    this.clearTimers();
  }

  private handleExpiry(): void {
    this.graceActive.set(true);
    this.graceDeadline = Date.now() + GRACE_MS;

    this.notificationId = this.notifications.show({
      type: "warning",
      message: this.buildCountdownMessage(),
      actionLabel: "Continuar sesión",
      onAction: () => this.extendNow(),
      dismissible: false,
    });

    this.countdownInterval = setInterval(() => {
      if (!this.notificationId) return;
      this.notifications.update(this.notificationId, {
        message: this.buildCountdownMessage(),
      });
    }, 1000);

    this.graceTimer = setTimeout(() => this.forceLogout(), GRACE_MS);
  }

  private buildCountdownMessage(): string {
    const secondsLeft = Math.max(
      0,
      Math.ceil(((this.graceDeadline ?? 0) - Date.now()) / 1000)
    );
    return `Su sesión ha expirado. Tiene ${secondsLeft}s para continuar antes de que se cierre automáticamente.`;
  }

  private extendNow(): void {
    this.clearTimers();
    this.auth.refreshSession().subscribe({
      next: (res) => this.scheduleFromExpiresAt(res.expiresAt),
      error: () => this.forceLogout(),
    });
  }

  private forceLogout(): void {
    this.clearTimers();
    this.auth.forceExpireSession().subscribe({
      complete: () => {
        this.router.navigate(["/login"]);
        this.notifications.info("Su sesión se cerró por inactividad. Porfavor vuelva a iniciar sesión.");
      },
    });
  }

  private clearTimers(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.notificationId) this.notifications.dismiss(this.notificationId);

    this.expiryTimer = null;
    this.graceTimer = null;
    this.countdownInterval = null;
    this.notificationId = null;
    this.graceDeadline = null;
    this.graceActive.set(false);
  }
}
