// src/app/realtime/socket.js
import { io } from "socket.io-client";
import { env } from "../config/env";

/**
 * Token pode ir via:
 * - querystring (?token=...)
 * - auth: { token }
 *
 * Regras:
 * - connectSocket(token): aplica token e conecta (reconecta se token mudou)
 * - disconnectSocket({clearAuth}): desconecta e opcionalmente limpa token
 * - join/leave: garante que o socket está conectado
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

function normalizeToken(t) {
  return t ? String(t).trim() : "";
}

export function setSocketAuthToken(token) {
  const t = normalizeToken(token);

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
  const param = normalizeToken(tokenParam);
  if (param) return param;

  const q = normalizeToken(socket.io.opts?.query?.token);
  if (q) return q;

  const a = normalizeToken(socket.auth?.token);
  if (a) return a;

  return guessTokenFromStorage();
}

/**
 * Conecta garantindo token atualizado.
 * Se já estiver conectado e token mudou -> reconecta.
 */
export function connectSocket(token) {
  const t = getEffectiveToken(token);

  const tokenChanged = t !== lastAppliedToken;
  if (tokenChanged) {
    setSocketAuthToken(t);
    if (socket.connected) socket.disconnect();
  } else {
    // garante que token existe no objeto do socket (alguns builds resetam opts)
    const hasQueryToken = !!normalizeToken(socket.io.opts?.query?.token);
    const hasAuthToken = !!normalizeToken(socket.auth?.token);
    if (t && !hasQueryToken && !hasAuthToken) {
      setSocketAuthToken(t);
      if (socket.connected) socket.disconnect();
    }
  }

  if (!socket.connected) socket.connect();
}

export function disconnectSocket({ clearAuth = false } = {}) {
  try {
    if (socket.connected) socket.disconnect();
  } finally {
    if (clearAuth) setSocketAuthToken("");
  }
}

function ensureConnected() {
  if (socket.connected) return;
  // tenta conectar com token atual (se houver)
  connectSocket();
}

export function joinConversationRoom(conversationId) {
  const id = Number(conversationId);
  if (!id) return;
  ensureConnected();
  socket.emit("conversation:join", { conversation_id: id });
}

export function leaveConversationRoom(conversationId) {
  const id = Number(conversationId);
  if (!id) return;
  ensureConnected();
  socket.emit("conversation:leave", { conversation_id: id });
}
