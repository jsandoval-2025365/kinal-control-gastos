import { Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "./auth.service";
import { NotificationService } from "../../shared/coming-soon/notifications/notification.service";
import { ActivityTrackerService } from "./activity-tracker.service";

/** Debe coincidir con `SESSION_REFRESH_GRACE_SECONDS` del backend. */
const GRACE_MS = 60_000;

/**
 * Cuánto tiempo SIN actividad real (sin navegar, sin escribir, sin hacer
 * peticiones) se considera "usuario inactivo". Al cruzar este umbral
 * arranca el aviso de expiración + el margen de gracia de un minuto.
 * Si el usuario vuelve a interactuar antes de que termine ese margen,
 * el aviso se cancela y el contador de inactividad se reinicia desde cero
 * (porque se recalcula en cada tick a partir de la actividad real más
 * reciente, no de un valor guardado aparte).
 */
const IDLE_THRESHOLD_MS = 5 * 60_000; // 5 minutos — ajustar aquí si se necesita otro umbral

/**
 * Mientras el usuario SIGUE ACTIVO (por debajo del umbral de inactividad),
 * el JWT se renueva EN SILENCIO un poco antes de vencer, sin mostrar
 * ningún aviso — así la sesión nunca se interrumpe mientras la persona
 * sigue trabajando en la app, sin importar cuánto dure esa sesión de
 * trabajo continuo.
 */
const REFRESH_LEAD_MS = 60_000; // renovar 1 minuto antes del vencimiento real del JWT

/** Frecuencia con la que se revisa el estado de actividad/expiración. */
const HEARTBEAT_MS = 1_000;

/**
 * Orquesta la sesión combinando DOS mecanismos independientes:
 *
 *  1. RENOVACIÓN SILENCIOSA: si el usuario está activo y el JWT está por
 *     vencer, se renueva solo, sin avisar nada.
 *  2. CIERRE POR INACTIVIDAD: si el usuario deja de interactuar por
 *     `IDLE_THRESHOLD_MS`, se muestra el aviso con cuenta regresiva de
 *     `GRACE_MS`. Cualquier actividad durante ese margen cancela el aviso
 *     y reinicia el reloj de inactividad. Si el margen termina sin
 *     actividad, se cierra la sesión de verdad (revocación + limpieza de
 *     cookie en el backend).
 */
@Injectable({ providedIn: "root" })
export class SessionTimeoutService {
  /** true mientras se está mostrando el aviso de inactividad. */
  readonly graceActive = signal(false);

  private expiresAt: Date | null = null;
  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;
  private graceDeadline: number | null = null;
  private notificationId: string | null = null;
  private refreshInFlight = false;

  constructor(
    private auth: AuthService,
    private notifications: NotificationService,
    private router: Router,
    private activity: ActivityTrackerService
  ) {}

  /** Se llama tras login/refresh/reload para (re)armar el vigilante de sesión. */
  scheduleFromExpiresAt(expiresAt: Date | null): void {
    this.expiresAt = expiresAt;
    if (!expiresAt) {
      this.stop();
      return;
    }
    // Iniciar/renovar sesión cuenta como actividad: el reloj de
    // inactividad arranca en cero, no desde que se cargó la página.
    this.activity.markActive();
    this.startHeartbeat();
  }

  /** Se llama en logout manual, para no dejar el vigilante corriendo de fondo. */
  stop(): void {
    if (this.heartbeatHandle) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }
    this.cancelGracePeriod();
    this.expiresAt = null;
    this.refreshInFlight = false;
  }

  private startHeartbeat(): void {
    if (this.heartbeatHandle) return; // ya está corriendo, no duplicar
    this.heartbeatHandle = setInterval(() => this.tick(), HEARTBEAT_MS);
  }

  private tick(): void {
    const idleMs = this.activity.getIdleMs();

    if (idleMs >= IDLE_THRESHOLD_MS) {
      if (!this.graceActive()) {
        // Se acaba de cruzar el umbral de inactividad: arrancar el aviso.
        this.startGracePeriod();
      } else if (this.graceDeadline !== null && Date.now() >= this.graceDeadline) {
        // El margen de gracia terminó sin actividad: cerrar sesión de verdad.
        this.forceLogout();
      } else {
        this.refreshCountdownMessage();
      }
      return;
    }

    // El usuario está activo (por debajo del umbral de inactividad).
    if (this.graceActive()) {
      // Volvió a interactuar durante el margen de gracia: cancelar el aviso.
      this.cancelGracePeriod();
    }
    this.maybeRefreshNearExpiry();
  }

  /** Renueva el JWT en silencio si está por vencer y el usuario sigue activo. */
  private maybeRefreshNearExpiry(): void {
    if (!this.expiresAt || this.refreshInFlight) return;
    const msUntilExpiry = this.expiresAt.getTime() - Date.now();
    if (msUntilExpiry <= REFRESH_LEAD_MS) {
      this.silentRefresh();
    }
  }

  private silentRefresh(): void {
    this.refreshInFlight = true;
    this.auth.refreshSession().subscribe({
      next: (res) => {
        this.refreshInFlight = false;
        this.expiresAt = res.expiresAt;
      },
      error: () => {
        this.refreshInFlight = false;
        // La sesión ya no es válida en el backend (revocada, o venció el
        // límite absoluto de 24h) — no hay nada que renovar.
        this.forceLogout();
      },
    });
  }

  private startGracePeriod(): void {
    this.graceActive.set(true);
    this.graceDeadline = Date.now() + GRACE_MS;
    this.notificationId = this.notifications.show({
      type: "warning",
      message: this.buildCountdownMessage(),
      actionLabel: "Continuar sesión",
      onAction: () => {
        this.activity.markActive();
        this.cancelGracePeriod();
      },
      dismissible: false,
    });
  }

  private refreshCountdownMessage(): void {
    if (!this.notificationId) return;
    this.notifications.update(this.notificationId, { message: this.buildCountdownMessage() });
  }

  private buildCountdownMessage(): string {
    const secondsLeft = Math.max(
      0,
      Math.ceil(((this.graceDeadline ?? 0) - Date.now()) / 1000)
    );
    return `Llevas un rato sin actividad. Tu sesión se cerrará en ${secondsLeft}s si no interactúas con la aplicación.`;
  }

  private cancelGracePeriod(): void {
    if (this.notificationId) {
      this.notifications.dismiss(this.notificationId);
      this.notificationId = null;
    }
    this.graceActive.set(false);
    this.graceDeadline = null;
    // Ya que volvió a interactuar, aprovechamos para renovar en silencio
    // si el JWT estaba a punto de vencer mientras se mostraba el aviso.
    this.maybeRefreshNearExpiry();
  }

  private forceLogout(): void {
    this.stop();
    this.auth.forceExpireSession().subscribe({
      complete: () => {
        this.router.navigate(["/login"]);
        this.notifications.info("Su sesión se cerró por inactividad. Vuelva a iniciar sesión.");
      },
    });
  }
}