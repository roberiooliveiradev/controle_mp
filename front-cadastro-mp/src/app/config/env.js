// src/app/config/env.js

const base = import.meta.env.VITE_API_BASE_URL ?? "";
const prefix = import.meta.env.VITE_API_PREFIX ?? "/api";
const socketPathRaw = import.meta.env.VITE_SOCKET_PATH ?? "/socket.io";

// Normaliza para não duplicar barras
function trimEndSlash(s) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

export const env = {
  apiBaseUrl: trimEndSlash(base),
  apiPrefix: prefix.startsWith("/") ? prefix : `/${prefix}`,
  socketPath: socketPathRaw.startsWith("/") ? socketPathRaw : `/${socketPathRaw}`,
};
