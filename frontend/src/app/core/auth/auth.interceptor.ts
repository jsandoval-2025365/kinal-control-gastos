import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, tap, throwError } from "rxjs";
import { Router } from "@angular/router";
import { CsrfService } from "./csrf.service";
import { AuthService } from "./auth.service";
import { SessionTimeoutService } from "./session-timeout.service";

const MUTATING_METHODS = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

const SESSION_MAINTENANCE_PATHS = [
  "/auth/refresh",
  "/auth/session-expire",
  "/csrf-token",
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const csrf = inject(CsrfService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const sessionTimeout = inject(SessionTimeoutService);

  const withCreds = req.clone({
    withCredentials: true,
  });

  const isMaintenanceCall = SESSION_MAINTENANCE_PATHS.some(
    (path) => req.url.includes(path)
  );

  const proceed = (finalReq: typeof withCreds) =>
    next(finalReq).pipe(
      tap(() => {
        /*
         * Una petición normal exitosa también cuenta como
         * actividad del usuario.
         *
         * No contamos refresh, session-expire ni csrf-token
         * porque son operaciones internas.
         */
        if (!isMaintenanceCall) {
          sessionTimeout.notifyActivity();
        }
      }),

      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          auth.clearLocalUser();
          router.navigate(["/login"]);
        }

        return throwError(() => err);
      })
    );

  /*
   * Las peticiones que modifican información necesitan
   * el token CSRF.
   */
  if (MUTATING_METHODS.has(req.method)) {
    return csrf.getToken().pipe(
      switchMap((token) => {
        const withCsrf = withCreds.clone({
          setHeaders: {
            "x-csrf-token": token,
          },
        });

        return proceed(withCsrf);
      })
    );
  }

  return proceed(withCreds);
};