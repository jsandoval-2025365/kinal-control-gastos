import { ApplicationConfig, APP_INITIALIZER } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { routes } from "./app.routes";
import { authInterceptor } from "./core/auth/auth.interceptor";
import { AuthService } from "./core/auth/auth.service";
import { SessionTimeoutService } from "./core/auth/session-timeout.service";
import { firstValueFrom, of } from "rxjs";
import { catchError, tap } from "rxjs/operators";

/**
 * Resuelve el estado de autenticación UNA vez al arrancar la app, antes de
 * que se evalúen los guards de la primera navegación. Si ya existe una
 * sesión válida, además programa el aviso de expiración con
 * `SessionTimeoutService`, para que el conteo de expiración funcione
 * incluso si el usuario simplemente recarga la página (F5) sin volver a
 * pasar por el login.
 */
function initAuth(auth: AuthService, sessionTimeout: SessionTimeoutService) {
  return () =>
    firstValueFrom(
      auth.fetchCurrentUser().pipe(
        tap(() => sessionTimeout.scheduleFromExpiresAt(auth.expiresAt())),
        catchError(() => of(null))
      )
    );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [AuthService, SessionTimeoutService],
      multi: true,
    },
  ],
};