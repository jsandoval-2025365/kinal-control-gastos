import { doubleCsrf } from "csrf-csrf";
import { env, isProd } from "./env";

export const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: () => "csrf-static-identifier",
  cookieName: isProd ? "__Host-csrf" : "csrf_token",
  cookieOptions: {
    httpOnly: false,
    sameSite: "lax",
    secure: isProd,
    path: "/",
  },
  size: 64,
}); 