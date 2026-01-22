// src/app/config/env.js

const base = import.meta.env.VITE_API_BASE_URL ?? "";
const prefix = import.meta.env.VITE_API_PREFIX ?? "/api";

// Normaliza para não duplicar barras
function trimEndSlash(s) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

export const env = {
  apiBaseUrl: trimEndSlash(base),   // "" ou "http://127.0.0.1:5000"
  apiPrefix: prefix.startsWith("/") ? prefix : `/${prefix}`, // "/api" ou ""
};
