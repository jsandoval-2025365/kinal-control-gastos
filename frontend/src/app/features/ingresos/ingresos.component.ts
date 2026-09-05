import { Component, HostListener, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { SessionTimeoutService } from "../../core/auth/session-timeout.service";
import { NotificationService } from "../../shared/coming-soon/notifications/notification.service";

@Component({
  selector: "app-income",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./ingresos.component.html",
  styleUrl: "./ingresos.component.css",
})
export class IncomeComponent {
  /** Controla la visibilidad del menú desplegable del usuario (idéntico al dashboard). */
  userMenuOpen = signal(false);

  constructor(
    public auth: AuthService,
    private router: Router,
    private sessionTimeout: SessionTimeoutService,
    private notifications: NotificationService
  ) {}

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
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  /** Navega a otra sección del sidebar/nav inferior. */
  goTo(path: string): void {
    this.userMenuOpen.set(false);
    this.router.navigate([path]);
  }

  /**
   * Acciones de esta vista (exportar, agregar/editar/eliminar fuente) todavía
   * no tienen backend implementado — en vez de navegar a un lugar sin
   * sentido, se muestra un aviso reutilizando el sistema de notificaciones
   * genérico (NotificationService).
   */
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
}