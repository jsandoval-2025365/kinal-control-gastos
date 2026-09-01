import { Routes } from "@angular/router";
import { authGuard } from "./core/auth/auth.guard";
import { adminGuard } from "./core/auth/admin.guard";
import { guestGuard } from "./core/auth/guest.guard";

export const routes: Routes = [
  { path: "", redirectTo: "dashboard", pathMatch: "full" },
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
    path: "dashboard",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/dashboard/dashboard.component").then((m) => m.DashboardComponent),
  },
  {
    path: "admin",
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import("./features/admin/admin.component").then((m) => m.AdminComponent),
  },
  // Secciones todavía no implementadas: muestran una vista genérica de "próximamente".
  {
    path: "income",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./shared/coming-soon/coming-soon.component").then((m) => m.ComingSoonComponent),
    data: { title: "Ingresos" },
  },
  {
    path: "expenses",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./shared/coming-soon/coming-soon.component").then((m) => m.ComingSoonComponent),
    data: { title: "Gastos" },
  },
  {
    path: "budget",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./shared/coming-soon/coming-soon.component").then((m) => m.ComingSoonComponent),
    data: { title: "Presupuesto" },
  },
  {
    path: "settings",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./shared/coming-soon/coming-soon.component").then((m) => m.ComingSoonComponent),
    data: { title: "Configuración" },
  },
  { path: "**", redirectTo: "dashboard" },
];