import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container">
      <h2>Crear cuenta</h2>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (success()) {
        <p>Cuenta creada. Ya puedes <a routerLink="/login">iniciar sesión</a>.</p>
      } @else {
        <form (ngSubmit)="onSubmit()">
          <input
            type="email"
            name="email"
            placeholder="Email"
            [(ngModel)]="email"
            required
            autocomplete="username"
          />
          <input
            type="password"
            name="password"
            placeholder="Contraseña (mín. 10 caracteres)"
            [(ngModel)]="password"
            required
            minlength="10"
            autocomplete="new-password"
          />
          <button type="submit" [disabled]="loading()">
            {{ loading() ? "Creando..." : "Crear cuenta" }}
          </button>
        </form>
      }
      <p>¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
    </div>
  `,
})
export class RegisterComponent {
  email = "";
  password = "";
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.register({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? "No se pudo completar el registro");
      },
    });
  }
}
