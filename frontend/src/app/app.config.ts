import { ApplicationConfig, APP_INITIALIZER } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { routes } from "./app.routes";
import { authInterceptor } from "./core/auth/auth.interceptor";
import { AuthService } from "./core/auth/auth.service";
import { firstValueFrom, of } from "rxjs";
import { catchError } from "rxjs/operators";

/**
 * Resuelve el estado de autenticación UNA vez al arrancar la app, antes de
 * que se evalúen los guards de la primera navegación. Así evitamos un
 * parpadeo entre "no autenticado" y "autenticado" en la carga inicial.
 * APP_INITIALIZER requiere una Promise, por eso se convierte con firstValueFrom.
 */
function initAuth(auth: AuthService) {
  return () =>
    firstValueFrom(auth.fetchCurrentUser().pipe(catchError(() => of(null))));
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [AuthService],
      multi: true,
    },
  ],
};
