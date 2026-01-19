// src/app/realtime/socket.js
import { io } from "socket.io-client";
import { env } from "../config/env";

// OBS: backend espera token via querystring (?token=...)
// e os eventos de join/leave são conversation:join / conversation:leave
export const socket = io(env.apiBaseUrl, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  query: {}, // vamos setar token aqui
});

export function setSocketAuthToken(token) {
  // Atualiza querystring do manager (necessário no browser)
  socket.io.opts.query = { token: token ?? "" };
}

export function connectSocket() {
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}

export function joinConversationRoom(conversationId) {
  if (!conversationId) return;
  socket.emit("conversation:join", { conversation_id: Number(conversationId) });
}

export function leaveConversationRoom(conversationId) {
  if (!conversationId) return;
  socket.emit("conversation:leave", { conversation_id: Number(conversationId) });
}
