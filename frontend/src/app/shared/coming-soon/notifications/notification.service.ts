import { Injectable, signal } from "@angular/core";
import { AppNotification } from "./notification.model";

/**
 * Servicio CENTRAL de mensajes/notificaciones de toda la aplicación.
 *
 * Este es el punto de conexión entre componentes: cualquier componente o
 * servicio (de cualquier feature) puede inyectar `NotificationService` y
 * llamar a `show()`/`info()`/`warning()`/etc. sin necesitar conocer quién
 * más existe en la app ni cómo se renderiza el mensaje.
 *
 * El único responsable de RENDERIZAR las notificaciones es
 * `NotificationContainerComponent`, montado UNA sola vez en la raíz
 * (`app.component.ts`). Esto es justo lo que evita el acoplamiento entre
 * componentes: nadie llama directamente a otro componente ni le pasa
 * `@Input()`/`@Output()` a través de varios niveles — todos hablan con
 * este servicio, que es un singleton (`providedIn: 'root'`) inyectado por
 * Angular. Si mañana agregas otra feature que necesite mostrar mensajes
 * (ej. "nota guardada", "error al eliminar"), reutiliza este mismo
 * servicio en vez de crear un mecanismo nuevo.
 */
@Injectable({ providedIn: "root" })
export class NotificationService {
  private readonly notificationsSignal = signal<AppNotification[]>([]);
  readonly notifications = this.notificationsSignal.asReadonly();

  private nextId = 0;

  /** API genérica: úsala cuando necesites control total (acción, persistencia, etc.). */
  show(notification: Omit<AppNotification, "id">): string {
    const id = `notif-${++this.nextId}`;
    const full: AppNotification = { dismissible: true, ...notification, id };

    this.notificationsSignal.update((list) => [...list, full]);

    if (full.autoDismissMs) {
      setTimeout(() => this.dismiss(id), full.autoDismissMs);
    }

    return id;
  }

  /** Actualiza una notificación existente (ej. para refrescar un contador en vivo). */
  update(id: string, changes: Partial<Omit<AppNotification, "id">>): void {
    this.notificationsSignal.update((list) =>
      list.map((n) => (n.id === id ? { ...n, ...changes } : n))
    );
  }

  dismiss(id: string): void {
    this.notificationsSignal.update((list) => list.filter((n) => n.id !== id));
  }

  clear(): void {
    this.notificationsSignal.set([]);
  }

  // --- Atajos para los casos más comunes ---

  info(message: string, autoDismissMs = 4000): string {
    return this.show({ type: "info", message, autoDismissMs });
  }

  success(message: string, autoDismissMs = 4000): string {
    return this.show({ type: "success", message, autoDismissMs });
  }

  error(message: string, autoDismissMs = 6000): string {
    return this.show({ type: "error", message, autoDismissMs });
  }

  /** Advertencias: no se auto-cierran por defecto (útil para acciones pendientes). */
  warning(notification: Omit<AppNotification, "id" | "type">): string {
    return this.show({ ...notification, type: "warning" });
  }
}
