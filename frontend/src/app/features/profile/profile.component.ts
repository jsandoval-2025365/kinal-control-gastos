import { Component } from "@angular/core";
import { DatePipe } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: "./profile.component.html",
  styleUrl: "./profile.component.css",
})
export class ProfileComponent {

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  onLogout(): void {

    this.auth.logout().subscribe({

      next: () => {
        this.router.navigate(["/login"]);
      },

      error: () => {
        this.router.navigate(["/login"]);
      },

    });
  }
}