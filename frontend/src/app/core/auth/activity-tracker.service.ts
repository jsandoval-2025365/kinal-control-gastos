import { Injectable, NgZone, signal } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs/operators";

/**
 * Detecta actividad REAL del usuario dentro de la aplicación: movimientos
 * de mouse, clics, teclas, scroll, toques táctiles, y cambios de vista
 * (navegación). El interceptor HTTP también lo alimenta (ver
 * `auth.interceptor.ts`), para que hacer una consulta al backend también
 * cuente como actividad.
 *
 * Este servicio NO sabe nada de sesiones, JWT, ni de negocio — es de
 * propósito único: "¿cuándo fue la última vez que el usuario hizo algo?".
 * `SessionTimeoutService` lo consume para decidir cuándo el usuario está
 * inactivo, sin acoplarse directamente a cómo se detecta esa actividad.
 */
@Injectable({ providedIn: "root" })
export class ActivityTrackerService {
  private readonly lastActivitySignal = signal<number>(Date.now());
  /** Marca de tiempo (epoch ms) de la última actividad detectada. */
  readonly lastActivityAt = this.lastActivitySignal.asReadonly();

  /** Evita actualizar el signal en cada píxel de un mousemove. */
  private readonly THROTTLE_MS = 2000;
  private lastRecordedAt = 0;

  private static readonly DOM_EVENTS: (keyof DocumentEventMap)[] = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "wheel",
    "click",
  ];

  constructor(
    private zone: NgZone,
    private router: Router
  ) {
    // Los listeners de DOM se registran fuera de la zona de Angular para no
    // disparar detección de cambios en cada movimiento de mouse; solo se
    // vuelve a entrar a la zona cuando realmente se actualiza el signal
    // (ver `handleDomActivity`).
    this.zone.runOutsideAngular(() => {
      ActivityTrackerService.DOM_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, this.handleDomActivity, { passive: true });
      });
    });

    // Cambiar de vista (navegar entre /dashboard, /income, etc.) también
    // cuenta como actividad, aunque el usuario no haya tocado el mouse.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.markActive());
  }

  /** Milisegundos transcurridos desde la última actividad detectada. */
  getIdleMs(): number {
    return Date.now() - this.lastActivitySignal();
  }

  /**
   * Registra actividad explícita. Lo usa este mismo servicio (eventos DOM)
   * y también el interceptor HTTP (`auth.interceptor.ts`), para que las
   * peticiones al backend también reinicien el contador de inactividad.
   */
  markActive(): void {
    this.lastActivitySignal.set(Date.now());
  }

  private handleDomActivity = (): void => {
    const now = Date.now();
    if (now - this.lastRecordedAt < this.THROTTLE_MS) return;
    this.lastRecordedAt = now;
    this.zone.run(() => this.markActive());
  };
}