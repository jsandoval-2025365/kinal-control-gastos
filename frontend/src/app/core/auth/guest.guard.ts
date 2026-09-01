import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map, catchError, of } from "rxjs";
import { AuthService } from "./auth.service";

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () => (auth.isAuthenticated() ? router.createUrlTree(["/dashboard"]) : true);

  if (auth.initialized()) {
    return decide();
  }

  return auth.fetchCurrentUser().pipe(
    map(() => decide()),
    catchError(() => of(true))
  );
};