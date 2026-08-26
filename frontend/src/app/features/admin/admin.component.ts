import { Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AdminService } from "./admin.service";
import { Role, User } from "../../core/models/user.model";

@Component({
  selector: "app-admin",
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container" style="max-width: 640px;">
      <h2>Panel de administración</h2>
      <p><a routerLink="/profile">Volver a mi perfil</a></p>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align:left; border-bottom: 1px solid #ddd; padding: 8px;">Email</th>
            <th style="text-align:left; border-bottom: 1px solid #ddd; padding: 8px;">Rol</th>
            <th style="border-bottom: 1px solid #ddd; padding: 8px;">Acción</th>
          </tr>
        </thead>
        <tbody>
          @for (u of users(); track u.id) {
            <tr>
              <td style="padding: 8px;">{{ u.email }}</td>
              <td style="padding: 8px;">{{ u.role }}</td>
              <td style="padding: 8px;">
                <button
                  style="width:auto; padding: 6px 12px;"
                  (click)="toggleRole(u)"
                >
                  Hacer {{ u.role === "ADMIN" ? "USER" : "ADMIN" }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AdminComponent implements OnInit {
  users = signal<User[]>([]);
  error = signal<string | null>(null);

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.adminService.listUsers().subscribe({
      next: (res) => this.users.set(res.users),
      error: (err) => this.error.set(err?.error?.error ?? "No se pudo cargar la lista"),
    });
  }

  toggleRole(user: User): void {
    const newRole: Role = user.role === "ADMIN" ? "USER" : "ADMIN";
    this.adminService.changeRole(user.id, newRole).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.error ?? "No se pudo cambiar el rol"),
    });
  }
}
