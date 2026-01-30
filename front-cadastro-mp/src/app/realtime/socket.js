// src/app/realtime/socket.js
import { io } from "socket.io-client";
import { env } from "../config/env";

/**
 * Token pode ir via:
 * - querystring (?token=...)
 * - auth: { token }
 *
 * Este arquivo garante:
 * - login/refresh: token atualizado e reconexão se necessário
 * - logout: desconecta e limpa token
 */

function guessTokenFromStorage() {
  const keys = ["access_token", "token", "cadmp_token", "jwt", "auth_token"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

const baseUrl = env?.apiBaseUrl || window.location.origin;
const socketPath = env?.socketPath || "/socket.io";

export const socket = io(baseUrl, {
  path: socketPath,
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  timeout: 20000,
  query: {},
  auth: {},
});

let lastAppliedToken = "";

export function setSocketAuthToken(token) {
  const t = token ? String(token).trim() : "";

  // querystring compat
  socket.io.opts.query = { ...(socket.io.opts.query ?? {}) };
  if (t) socket.io.opts.query.token = t;
  else delete socket.io.opts.query.token;

  // auth payload compat
  socket.auth = { ...(socket.auth ?? {}) };
  if (t) socket.auth.token = t;
  else delete socket.auth.token;

  lastAppliedToken = t;
}

function getEffectiveToken(tokenParam) {
  const param = tokenParam ? String(tokenParam).trim() : "";
  if (param) return param;

  const fromQuery = String(socket.io.opts?.query?.token ?? "").trim();
  if (fromQuery) return fromQuery;

  const fromAuth = String(socket.auth?.token ?? "").trim();
  if (fromAuth) return fromAuth;

  return guessTokenFromStorage();
}

/**
 * Conecta garantindo token atualizado.
 * Se já estiver conectado com token diferente, reconecta.
 */
export function connectSocket(token) {
  const t = getEffectiveToken(token);

  // aplica token (inclusive vazio) antes de conectar
  if (t !== lastAppliedToken) {
    setSocketAuthToken(t);

    // se estava conectado com token antigo -> derruba e reconecta
    if (socket.connected) socket.disconnect();
  } else {
    // garante token realmente aplicado
    const hasQueryToken = !!String(socket.io.opts?.query?.token ?? "").trim();
    const hasAuthToken = !!String(socket.auth?.token ?? "").trim();
    if (t && !hasQueryToken && !hasAuthToken) {
      setSocketAuthToken(t);
      if (socket.connected) socket.disconnect();
    }
  }

  if (!socket.connected) socket.connect();
}

/**
 * Logout-safe: desconecta e opcionalmente limpa token do socket
 */
export function disconnectSocket({ clearAuth = false } = {}) {
  if (socket.connected) socket.disconnect();
  if (clearAuth) setSocketAuthToken("");
}

export function ensureSocketConnected(token) {
  if (!socket.connected) connectSocket(token);
}

export function joinConversationRoom(conversationId, token) {
  const id = Number(conversationId);
  if (!id) return;

  ensureSocketConnected(token);
  socket.emit("conversation:join", { conversation_id: id });
}

export function leaveConversationRoom(conversationId, token) {
  const id = Number(conversationId);
  if (!id) return;

  ensureSocketConnected(token);
  socket.emit("conversation:leave", { conversation_id: id });
}
