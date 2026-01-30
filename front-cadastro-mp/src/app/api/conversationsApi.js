// src/app/api/conversationsApi.js
import { httpClient } from "./httpClient";

export async function listConversationsApi({ limit = 50, offset = 0 } = {}) {
  const { data } = await httpClient.get("/conversations", {
    params: { limit, offset },
  });
  return data;
}

export async function getConversationApi(id) {
  const { data } = await httpClient.get(`/conversations/${id}`);
  return data;
}

export async function createConversationApi(payload) {
  const { data } = await httpClient.post("/conversations", payload);
  return data;
}

export async function updateConversationApi(id, payload) {
  const { data } = await httpClient.patch(`/conversations/${id}`, payload);
  return data;
}

export async function deleteConversationApi(id) {
  await httpClient.delete(`/conversations/${id}`);
}

/**
 * Retorna:
 * { [conversationId]: unreadCount }
 */
export async function getUnreadSummaryApi() {
  const { data } = await httpClient.get("/conversations/unread-summary");
  return data ?? {};
}
