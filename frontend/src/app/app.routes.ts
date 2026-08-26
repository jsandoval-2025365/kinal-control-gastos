import { Routes } from "@angular/router";
import { authGuard } from "./core/auth/auth.guard";
import { adminGuard } from "./core/auth/admin.guard";
import { guestGuard } from "./core/auth/guest.guard";

export const routes: Routes = [
  { path: "", redirectTo: "profile", pathMatch: "full" },
  {
    path: "login",
    canActivate: [guestGuard],
    loadComponent: () =>
      import("./features/login/login.component").then((m) => m.LoginComponent),
  },
  {
    path: "register",
    canActivate: [guestGuard],
    loadComponent: () =>
      import("./features/register/register.component").then((m) => m.RegisterComponent),
  },
  {
    path: "profile",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/profile/profile.component").then((m) => m.ProfileComponent),
  },
  {
    path: "admin",
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import("./features/admin/admin.component").then((m) => m.AdminComponent),
  },
  { path: "**", redirectTo: "profile" },
];
