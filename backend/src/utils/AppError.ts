/**
 * Error de aplicación con código HTTP explícito. El errorHandler central
 * usa `statusCode` y `message` para responder; cualquier otro error
 * (no controlado) se responde como 500 sin filtrar detalles internos.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const Errors = {
  unauthorized: (msg = "No autenticado") => new AppError(401, msg),
  forbidden: (msg = "No autorizado") => new AppError(403, msg),
  notFound: (msg = "Recurso no encontrado") => new AppError(404, msg),
  conflict: (msg = "El recurso ya existe") => new AppError(409, msg),
  badRequest: (msg = "Solicitud inválida") => new AppError(400, msg),
  tooManyRequests: (msg = "Demasiados intentos, inténtalo más tarde") =>
    new AppError(429, msg),
};
