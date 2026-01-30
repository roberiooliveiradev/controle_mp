// src/app/api/conversationsApi.js

import { httpClient } from "./httpClient";

export async function listConversationsApi({ limit = 50, offset = 0 } = {}) {
	const { data } = await httpClient.get("/conversations", {
		params: { limit, offset },
	});
	return data; // lista de ConversationResponse :contentReference[oaicite:5]{index=5}
}

export async function getConversationApi(id) {
	const { data } = await httpClient.get(`/conversations/${id}`);
	return data; // ConversationResponse :contentReference[oaicite:6]{index=6}
}

export async function createConversationApi(payload) {
	// payload: { title, has_flag, assigned_to_id } :contentReference[oaicite:7]{index=7}
	const { data } = await httpClient.post("/conversations", payload);
	return data;
}

export async function updateConversationApi(id, payload) {
	// payload: { title?, has_flag?, assigned_to_id? } :contentReference[oaicite:8]{index=8}
	const { data } = await httpClient.patch(`/conversations/${id}`, payload);
	return data;
}

export async function deleteConversationApi(id) {
	await httpClient.delete(`/conversations/${id}`);
}

export async function getUnreadSummaryApi() {
  const { data } = await httpClient.get("/conversations/unread-summary");
  return data; // { [conversationId]: unreadCount }
}

