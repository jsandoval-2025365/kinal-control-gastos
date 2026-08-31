import { Component, HostListener, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { SessionTimeoutService } from "../../core/auth/session-timeout.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.css",
})
export class DashboardComponent {
  /** Controla la visibilidad del menú desplegable del usuario. */
  userMenuOpen = signal(false);

  constructor(
    public auth: AuthService,
    private router: Router,
    private sessionTimeout: SessionTimeoutService
  ) {}

  /** Iniciales del avatar, calculadas a partir del email (no hay campo "nombre" en el modelo). */
  get initials(): string {
    const email = this.auth.currentUser()?.email ?? "";
    return email.slice(0, 2).toUpperCase();
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update((open) => !open);
  }

  /** Cierra el menú si el usuario hace click fuera de él. */
  @HostListener("document:click")
  closeUserMenu(): void {
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  /** Navega a una vista todavía no implementada (sección del sidebar / botones). */
  goTo(path: string): void {
    this.userMenuOpen.set(false);
    this.router.navigate([path]);
  }

  onLogout(): void {
    this.sessionTimeout.stop();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(["/login"]),
      error: () => this.router.navigate(["/login"]),
    });
  }
}