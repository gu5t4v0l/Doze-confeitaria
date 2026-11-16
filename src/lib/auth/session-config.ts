/** Constantes de sessão (seguras para importar no proxy e em Server Actions). */
export const IS_PROD = process.env.NODE_ENV === "production";
/** `__Host-` exige Secure + Path=/ + sem Domain: só em produção (HTTPS). */
export const SESSION_COOKIE = IS_PROD ? "__Host-doze_admin" : "doze_admin";
export const SESSION_MAX_AGE_SECONDS = 48 * 60 * 60;
