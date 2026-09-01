import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, tap, throwError } from "rxjs";
import { Router } from "@angular/router";
import { CsrfService } from "./csrf.service";
import { AuthService } from "./auth.service";
import { SessionTimeoutService } from "./session-timeout.service";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Endpoints de mantenimiento de sesión: nunca deben contar como "actividad
// del usuario" ni disparar notifyActivity() — evitaría un bucle.
const SESSION_MAINTENANCE_PATHS = ["/auth/refresh", "/auth/session-expire", "/csrf-token"];

/**
 * Interceptor funcional:
 *  1. Añade `withCredentials: true` para que la cookie de sesión viaje.
 *  2. Adjunta el header `x-csrf-token` en peticiones mutantes.
 *  3. Si el backend responde 401, limpia el estado local y redirige a login.
 *  4. Notifica a `SessionTimeoutService` de cada petición exitosa, para que
 *     pueda detectar "actividad del usuario" durante la ventana de gracia
 *     de expiración y renovar la sesión automáticamente.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const csrf = inject(CsrfService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const sessionTimeout = inject(SessionTimeoutService);

  const withCreds = req.clone({ withCredentials: true });
  const isMaintenanceCall = SESSION_MAINTENANCE_PATHS.some((path) => req.url.includes(path));

  const proceed = (finalReq: typeof withCreds) =>
    next(finalReq).pipe(
      tap(() => {
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