import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, tap, throwError } from "rxjs";
import { Router } from "@angular/router";
import { CsrfService } from "./csrf.service";
import { AuthService } from "./auth.service";
import { ActivityTrackerService } from "./activity-tracker.service";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Endpoints de mantenimiento de sesión: NUNCA deben contar como "actividad
// del usuario". Si `session-expire` (que se llama precisamente cuando el
// usuario está inactivo) marcara actividad, el reloj de inactividad se
// reiniciaría solo y el cierre automático de sesión nunca terminaría de
// ejecutarse.
const SESSION_MAINTENANCE_PATHS = ["/auth/refresh", "/auth/session-expire", "/csrf-token"];

/**
 * Interceptor funcional:
 *  1. Añade `withCredentials: true` para que la cookie de sesión viaje.
 *  2. Adjunta el header `x-csrf-token` en peticiones mutantes.
 *  3. Si el backend responde 401, limpia el estado local y redirige a login.
 *  4. Alimenta `ActivityTrackerService` con cada petición exitosa que no
 *     sea de mantenimiento de sesión, para que hacer consultas al backend
 *     también cuente como "actividad real" del usuario.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const csrf = inject(CsrfService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const activity = inject(ActivityTrackerService);

  const withCreds = req.clone({ withCredentials: true });
  const isMaintenanceCall = SESSION_MAINTENANCE_PATHS.some((path) => req.url.includes(path));

  const proceed = (finalReq: typeof withCreds) =>
    next(finalReq).pipe(
      tap(() => {
        if (!isMaintenanceCall) {
          activity.markActive();
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