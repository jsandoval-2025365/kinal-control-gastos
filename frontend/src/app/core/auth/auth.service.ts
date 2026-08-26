import { Injectable, computed, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap, catchError, of, finalize, map } from "rxjs";
import { environment } from "../../../environments/environment";
import { LoginPayload, RegisterPayload, User } from "../models/user.model";

/**
 * Fuente de verdad del estado de autenticación en el frontend.
 *
 * Importante (sección 6/11): este servicio NO es un mecanismo de seguridad.
 * Solo mejora la UX (mostrar/ocultar elementos, redirigir). La seguridad
 * real siempre se aplica en el backend, que es quien valida cada request.
 *
 * El JWT vive en una cookie HttpOnly — Angular nunca lo lee ni lo
 * almacena en localStorage/sessionStorage/memoria manualmente. Cada
 * request al backend se hace con `withCredentials: true` para que el
 * navegador adjunte la cookie automáticamente.
 */
@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;

  private readonly currentUserSignal = signal<User | null>(null);
  private readonly initializedSignal = signal(false);

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === "ADMIN");
  readonly initialized = computed(() => this.initializedSignal());

  constructor(private http: HttpClient) {}

  /** Limpia el estado local (usado por el interceptor ante un 401). */
  clearLocalUser(): void {
    this.currentUserSignal.set(null);
  }

  register(payload: RegisterPayload): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${this.apiUrl}/auth/register`, payload, {
      withCredentials: true,
    });
  }

  login(payload: LoginPayload): Observable<{ user: User }> {
    return this.http
      .post<{ user: User }>(`${this.apiUrl}/auth/login`, payload, {
        withCredentials: true,
      })
      .pipe(tap((res) => this.currentUserSignal.set(res.user)));
  }

  logout(): Observable<unknown> {
    return this.http
      .post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(finalize(() => this.currentUserSignal.set(null)));
  }

  /**
   * Se llama al arrancar la app (APP_INITIALIZER) para saber si ya existe
   * una sesión válida (cookie presente y sesión no revocada/expirada).
   */
  fetchCurrentUser(): Observable<User | null> {
    return this.http
      .get<{ user: User }>(`${this.apiUrl}/auth/me`, { withCredentials: true })
      .pipe(
        map((res) => res.user),
        tap((user) => this.currentUserSignal.set(user)),
        catchError(() => {
          this.currentUserSignal.set(null);
          return of(null);
        }),
        finalize(() => this.initializedSignal.set(true))
      );
  }
}
