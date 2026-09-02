import { Injectable, signal } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs";
import { AuthService } from "./auth.service";
import { NotificationService } from "../../shared/coming-soon/notifications/notification.service";

/*
 * Tiempo máximo sin interacción antes de mostrar la advertencia.
 *
 * EJEMPLO:
 * 5 minutos de inactividad
 */
const INACTIVITY_TIMEOUT_MS = 5 * 60_000;

/*
 * Tiempo que tiene el usuario para continuar la sesión
 * después de que aparece la advertencia.
 */
const GRACE_MS = 60_000;

/*
 * Renovar el JWT antes de que expire.
 *
 * Esto evita que el JWT caduque mientras el usuario
 * sigue utilizando activamente la aplicación.
 */
const REFRESH_BEFORE_EXPIRY_MS = 30_000;

/*
 * Evita ejecutar demasiadas veces la lógica de actividad
 * cuando el usuario mueve constantemente el mouse.
 */
const ACTIVITY_THROTTLE_MS = 1_000;

@Injectable({ providedIn: "root" })
export class SessionTimeoutService {
  readonly graceActive = signal(false);

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  private notificationId: string | null = null;
  private graceDeadline: number | null = null;

  private lastActivity = Date.now();
  private lastActivityNotification = 0;

  private refreshInProgress = false;

  constructor(
    private auth: AuthService,
    private notifications: NotificationService,
    private router: Router
  ) {
    this.startActivityListeners();
    this.startNavigationListener();
  }

  /**
   * Se llama después de login, refresh o recuperación de sesión.
   */
  scheduleFromExpiresAt(expiresAt: Date | null): void {
    this.clearTimers();

    if (!expiresAt) {
      return;
    }

    this.lastActivity = Date.now();

    /*
     * Inicia nuevamente el contador de inactividad.
     */
    this.scheduleInactivityTimer();

    /*
     * Programa la renovación preventiva del JWT.
     */
    this.scheduleRefreshTimer(expiresAt);
  }

  /**
   * Registra una actividad del usuario.
   *
   * Si la advertencia ya está activa:
   * - cancela la advertencia
   * - intenta renovar la sesión
   *
   * Si todavía no está en advertencia:
   * - reinicia el contador de inactividad
   */
  notifyActivity(): void {
    const now = Date.now();

    /*
     * Evita procesar eventos de actividad demasiadas veces.
     */
    if (
      now - this.lastActivityNotification <
      ACTIVITY_THROTTLE_MS
    ) {
      return;
    }

    this.lastActivityNotification = now;

    /*
     * Si estamos dentro de los 60 segundos de gracia,
     * cualquier interacción del usuario significa que
     * quiere continuar utilizando la aplicación.
     */
    if (this.graceActive()) {
      this.extendNow();
      return;
    }

    this.lastActivity = now;

    this.scheduleInactivityTimer();
  }

  /**
   * Detiene todos los temporizadores.
   */
  stop(): void {
    this.clearTimers();
  }

  /**
   * Escucha las acciones normales del usuario.
   */
  private startActivityListeners(): void {
    const events = [
      "click",
      "mousedown",
      "keydown",
      "input",
      "scroll",
      "touchstart",
      "mousemove",
    ];

    events.forEach((eventName) => {
      document.addEventListener(
        eventName,
        () => this.notifyActivity(),
        { passive: true }
      );
    });
  }

  /**
   * Considera la navegación entre vistas como actividad.
   */
  private startNavigationListener(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.notifyActivity();
      });
  }

  /**
   * Programa el temporizador que detectará la inactividad.
   */
  private scheduleInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.handleInactivity();
    }, INACTIVITY_TIMEOUT_MS);
  }

  /**
   * Programa una renovación preventiva del JWT.
   */
  private scheduleRefreshTimer(expiresAt: Date): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const refreshAt =
      expiresAt.getTime() - REFRESH_BEFORE_EXPIRY_MS;

    const delay = Math.max(0, refreshAt - Date.now());

    this.refreshTimer = setTimeout(() => {
      this.refreshIfActive(expiresAt);
    }, delay);
  }

  /**
   * Renueva el JWT solamente si el usuario
   * todavía está dentro del periodo considerado activo.
   */
  private refreshIfActive(expiresAt: Date): void {
    if (this.refreshInProgress) {
      return;
    }

    const inactiveFor = Date.now() - this.lastActivity;

    /*
     * Si ya superó el tiempo de inactividad,
     * no renovamos el JWT.
     *
     * El temporizador de inactividad será el encargado
     * de mostrar la advertencia.
     */
    if (inactiveFor >= INACTIVITY_TIMEOUT_MS) {
      this.handleInactivity();
      return;
    }

    /*
     * Si todavía está activo, renovamos el JWT.
     */
    this.refreshInProgress = true;

    this.auth.refreshSession().subscribe({
      next: (res) => {
        this.refreshInProgress = false;

        this.scheduleFromExpiresAt(res.expiresAt);
      },

      error: () => {
        this.refreshInProgress = false;
        this.forceLogout();
      },
    });
  }

  /**
   * Se ejecuta cuando el usuario lleva demasiado tiempo
   * sin interactuar.
   */
  private handleInactivity(): void {
    if (this.graceActive()) {
      return;
    }

    this.clearInactivityTimer();

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
      if (!this.notificationId) {
        return;
      }

      this.notifications.update(this.notificationId, {
        message: this.buildCountdownMessage(),
      });
    }, 1000);

    this.graceTimer = setTimeout(() => {
      this.forceLogout();
    }, GRACE_MS);
  }

  /**
   * Construye el mensaje del contador.
   */
  private buildCountdownMessage(): string {
    const secondsLeft = Math.max(
      0,
      Math.ceil(
        ((this.graceDeadline ?? 0) - Date.now()) / 1000
      )
    );

    return `Su sesión está a punto de expirar por inactividad. Tiene ${secondsLeft}s para continuar.`;
  }

  /**
   * Renueva la sesión cuando el usuario vuelve a interactuar
   * durante los 60 segundos de advertencia.
   */
  private extendNow(): void {
    if (this.refreshInProgress) {
      return;
    }

    this.refreshInProgress = true;

    this.clearTimers();

    this.lastActivity = Date.now();

    this.auth.refreshSession().subscribe({
      next: (res) => {
        this.refreshInProgress = false;

        this.scheduleFromExpiresAt(res.expiresAt);
      },

      error: () => {
        this.refreshInProgress = false;

        this.forceLogout();
      },
    });
  }

  /**
   * Cierra definitivamente la sesión.
   */
  private forceLogout(): void {
    this.clearTimers();

    this.auth.forceExpireSession().subscribe({
      complete: () => {
        this.router.navigate(["/login"]);

        this.notifications.info(
          "Su sesión se cerró por inactividad. Por favor vuelva a iniciar sesión."
        );
      },

      error: () => {
        this.router.navigate(["/login"]);

        this.notifications.info(
          "Su sesión se cerró por inactividad. Por favor vuelva a iniciar sesión."
        );
      },
    });
  }

  /**
   * Cancela solamente el temporizador de inactividad.
   */
  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /**
   * Limpia todos los temporizadores.
   */
  private clearTimers(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    if (this.notificationId) {
      this.notifications.dismiss(this.notificationId);
    }

    this.inactivityTimer = null;
    this.refreshTimer = null;
    this.graceTimer = null;
    this.countdownInterval = null;

    this.notificationId = null;
    this.graceDeadline = null;

    this.graceActive.set(false);
  }
}