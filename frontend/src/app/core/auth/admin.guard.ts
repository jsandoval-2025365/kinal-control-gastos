import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map, catchError, of } from "rxjs";
import { AuthService } from "./auth.service";

/**
 * Igual que authGuard, pero además exige rol ADMIN. Recordatorio (sección
 * 11): esto NO reemplaza el `authorize('ADMIN')` del backend. Un USER que
 * manipule el frontend y llegue al endpoint igual recibirá 403 del backend.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () =>
    auth.isAuthenticated() && auth.isAdmin() ? true : router.createUrlTree(["/profile"]);

  if (auth.initialized()) {
    return decide();
  }

  return auth.fetchCurrentUser().pipe(
    map(() => decide()),
    catchError(() => of(router.createUrlTree(["/login"])))
  );
};
