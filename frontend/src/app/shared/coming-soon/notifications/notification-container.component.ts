import { Component } from "@angular/core";
import { NotificationService } from "./notification.service";

/**
 * Renderiza TODAS las notificaciones activas de la app. Se monta una única
 * vez, en `app.component.ts` (raíz), y lee del `NotificationService`.
 */
@Component({
  selector: "app-notification-container",
  standalone: true,
  templateUrl: "./notification-container.component.html",
  styleUrl: "./notification-container.component.css",
})
export class NotificationContainerComponent {
  constructor(public notifications: NotificationService) {}
}