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

let discoveredParentOrigin = null;

/** Grava a origem do portal após o primeiro DELPI_AUTH válido. */
export function rememberDelpiParentOrigin(origin) {
  if (isAllowedDelpiParentOrigin(origin)) {
    discoveredParentOrigin = origin;
  }
}

/** Destino de postMessage iframe → portal (referrer ou origem descoberta). */
export function getDelpiParentPostMessageTarget() {
  if (discoveredParentOrigin) {
    return discoveredParentOrigin;
  }

  try {
    if (document.referrer) {
      const refOrigin = new URL(document.referrer).origin;
      if (isAllowedDelpiParentOrigin(refOrigin)) {
        return refOrigin;
      }
    }
  } catch {
    // ignore
  }

  return (
    import.meta.env.VITE_DELPI_PARENT_ORIGIN ||
    "https://minhadelpi.com.br"
  );
}
