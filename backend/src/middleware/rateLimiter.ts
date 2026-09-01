import rateLimit from "express-rate-limit";

/**
 * Rate limiting específico para login/registro (sección 16), mitiga
 * ataques de fuerza bruta. No se aplica globalmente para no penalizar
 * el resto de la API sin necesidad (evitar sobreingeniería, sección 21).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10, // 10 intentos por IP en la ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos, inténtalo más tarde" },
});
