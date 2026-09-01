import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map, catchError, of } from "rxjs";
import { AuthService } from "./auth.service";

/**
 * Guard de FRONTEND (sección 8). Es solo UX: evita que el usuario vea una
 * pantalla protegida por un instante antes de un 401. NO es el mecanismo
 * de seguridad real — el backend (`authenticate` middleware) es quien
 * decide de verdad si el request es válido.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.initialized()) {
    return auth.isAuthenticated() ? true : router.createUrlTree(["/login"]);
  }

  // Si el estado de auth todavía no se resolvió (primer load), lo resolvemos aquí.
  return auth.fetchCurrentUser().pipe(
    map((user) => (user ? true : router.createUrlTree(["/login"]))),
    catchError(() => of(router.createUrlTree(["/login"])))
  );
};
