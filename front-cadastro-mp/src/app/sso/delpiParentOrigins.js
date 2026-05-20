/**
 * Origens permitidas do portal Minha DELPI (postMessage pai → iframe).
 */
export const ALLOWED_DELPI_PARENT_ORIGINS = [
  import.meta.env.VITE_DELPI_PARENT_ORIGIN,
  "https://minhadelpi.com.br",
  "https://www.minhadelpi.com.br",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

export function isAllowedDelpiParentOrigin(origin) {
  return ALLOWED_DELPI_PARENT_ORIGINS.includes(origin);
}
