import argon2 from "argon2";

/**
 * Argon2id: ganador del Password Hashing Competition, resistente tanto a
 * ataques por GPU (gracias al componente de memoria) como a ataques por
 * canal lateral (por eso "id" y no "i" o "d" puros). Es la recomendación
 * de OWASP para hashing de contraseñas en 2024+.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, recomendación OWASP
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

/**
 * Hash "señuelo" precalculado en memoria de un valor fijo. Se usa cuando
 * el usuario NO existe, para que el login ejecute siempre una verificación
 * Argon2 (operación costosa) y así evitar que el tiempo de respuesta
 * revele si el email existe o no (mitiga timing attack / user enumeration,
 * sección 7). Se calcula una sola vez de forma perezosa.
 */
let dummyHashPromise: Promise<string> | null = null;

export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash("dummy-password-for-timing-safety", ARGON2_OPTIONS);
  }
  return dummyHashPromise;
}
