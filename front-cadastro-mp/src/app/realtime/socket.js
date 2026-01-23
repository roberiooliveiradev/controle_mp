// src/app/realtime/socket.js
import { io } from "socket.io-client";
import { env } from "../config/env";

/**
 * Se o backend exige token, ele costuma chegar via querystring (?token=...).
 * Alguns setups aceitam via auth: { token }.
 * Aqui damos suporte aos dois.
 */

function guessTokenFromStorage() {
	// tenta chaves comuns (ajuste se seu AuthContext usar outra)
	const keys = ["access_token", "token", "cadmp_token", "jwt", "auth_token"];

	for (const k of keys) {
		const v = localStorage.getItem(k);
		if (v && String(v).trim()) return String(v).trim();
	}
	return "";
}

const baseUrl = env?.apiBaseUrl || window.location.origin;

// ✅ path explícito ajuda muito com nginx/flask-socketio
const socketPath = env?.socketPath || "/socket.io";

export const socket = io(baseUrl, {
	path: socketPath,
	autoConnect: false,
	transports: ["websocket", "polling"],
	reconnection: true,
	reconnectionAttempts: Infinity,
	reconnectionDelay: 500,
	timeout: 20000,
	// query fica vazio até setarmos token
	query: {},
	// auth também fica vazio até setarmos token
	auth: {},
});

export function setSocketAuthToken(token) {
	const t = token ? String(token).trim() : "";

	// ✅ compat com backend que lê querystring
	socket.io.opts.query = { ...(socket.io.opts.query ?? {}), token: t };

	// ✅ compat com backend que lê auth payload
	socket.auth = { ...(socket.auth ?? {}), token: t };
}

export function connectSocket(token) {
	// garante token antes de conectar (se o backend exigir)
	const t = token
		? String(token).trim()
		: socket.io.opts?.query?.token ||
			socket.auth?.token ||
			guessTokenFromStorage();
	if (t) setSocketAuthToken(t);

	if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
	if (socket.connected) socket.disconnect();
}

export function joinConversationRoom(conversationId) {
	const id = Number(conversationId);
	if (!id) return;
	socket.emit("conversation:join", { conversation_id: id });
}

export function leaveConversationRoom(conversationId) {
	const id = Number(conversationId);
	if (!id) return;
	socket.emit("conversation:leave", { conversation_id: id });
}
