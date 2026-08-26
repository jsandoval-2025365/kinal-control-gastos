import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, throwError } from "rxjs";
import { Router } from "@angular/router";
import { CsrfService } from "./csrf.service";
import { AuthService } from "./auth.service";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Interceptor funcional (Angular 15+/22 style):
 *  1. Añade `withCredentials: true` a toda petición hacia la API para que
 *     la cookie de sesión HttpOnly viaje automáticamente.
 *  2. Adjunta el header `x-csrf-token` en peticiones mutantes.
 *  3. Si el backend responde 401, limpia el estado local y redirige a login
 *     (el backend ya invalidó/rechazó la sesión; el frontend solo refleja eso).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const csrf = inject(CsrfService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const withCreds = req.clone({ withCredentials: true });

  const proceed = (finalReq: typeof withCreds) =>
    next(finalReq).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          auth.clearLocalUser();
          router.navigate(["/login"]);
        }
        return throwError(() => err);
      })
    );

  if (MUTATING_METHODS.has(req.method)) {
    return csrf.getToken().pipe(
      switchMap((token) => {
        const withCsrf = withCreds.clone({
          setHeaders: { "x-csrf-token": token },
        });
        return proceed(withCsrf);
      })
    );
  }

  return proceed(withCreds);
};
