import { Injectable, computed, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap, catchError, of, finalize, map } from "rxjs";
import { environment } from "../../../environments/environment";
import { LoginPayload, RegisterPayload, User } from "../models/user.model";

interface AuthResponse {
  user: User;
  expiresAt: string | null;
}

/**
 * Fuente de verdad del estado de autenticación en el frontend.
 *
 * Este servicio NO es un mecanismo de seguridad. Solo mejora la UX
 * (mostrar/ocultar elementos, redirigir). La seguridad real siempre se
 * aplica en el backend, que es quien valida cada request.
 *
 * El JWT vive en una cookie HttpOnly — Angular nunca lo lee ni lo
 * almacena en localStorage/sessionStorage/memoria manualmente. Cada
 * request al backend se hace con `withCredentials: true`.
 *
 * `expiresAt` es la única información sobre el JWT que el backend expone
 * explícitamente en el cuerpo de la respuesta (porque la cookie es
 * HttpOnly y Angular no puede leer su contenido) — se usa para programar
 * el aviso de expiración de sesión (ver `SessionTimeoutService`).
 */
@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;

  private readonly currentUserSignal = signal<User | null>(null);
  private readonly initializedSignal = signal(false);
  private readonly expiresAtSignal = signal<Date | null>(null);

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === "ADMIN");
  readonly initialized = computed(() => this.initializedSignal());
  readonly expiresAt = computed(() => this.expiresAtSignal());

  constructor(private http: HttpClient) {}

  /** Limpia el estado local (usado por el interceptor ante un 401, y por logout). */
  clearLocalUser(): void {
    this.currentUserSignal.set(null);
    this.expiresAtSignal.set(null);
  }

  register(payload: RegisterPayload): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${this.apiUrl}/auth/register`, payload, {
      withCredentials: true,
    });
  }

  login(payload: LoginPayload): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, payload, { withCredentials: true })
      .pipe(
        tap((res) => this.applyAuthResponse(res)),
        map((res) => res.user)
      );
  }

  logout(): Observable<unknown> {
    return this.http
      .post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(finalize(() => this.clearLocalUser()));
  }

  /**
   * Renueva el JWT dentro del margen de gracia posterior a su expiración.
   * El backend valida que la sesión siga activa en PostgreSQL antes de
   * emitir un token nuevo.
   */
  refreshSession(): Observable<{ user: User; expiresAt: Date | null }> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => this.applyAuthResponse(res)),
        map(() => ({ user: this.currentUserSignal() as User, expiresAt: this.expiresAtSignal() }))
      );
  }

  /**
   * Fuerza el cierre y la limpieza de la cookie en el backend, incluso si
   * el JWT ya expiró más allá del margen de gracia. Se usa cuando el
   * usuario deja pasar el minuto de aviso sin actuar.
   */
  forceExpireSession(): Observable<unknown> {
    return this.http
      .post(`${this.apiUrl}/auth/session-expire`, {}, { withCredentials: true })
      .pipe(finalize(() => this.clearLocalUser()));
  }

  fetchCurrentUser(): Observable<User | null> {
    return this.http
      .get<AuthResponse>(`${this.apiUrl}/auth/me`, { withCredentials: true })
      .pipe(
        tap((res) => this.applyAuthResponse(res)),
        map((res) => res.user),
        catchError(() => {
          this.clearLocalUser();
          return of(null);
        }),
        finalize(() => this.initializedSignal.set(true))
      );
  }

  private applyAuthResponse(res: AuthResponse): void {
    this.currentUserSignal.set(res.user);
    this.expiresAtSignal.set(res.expiresAt ? new Date(res.expiresAt) : null);
  }
}