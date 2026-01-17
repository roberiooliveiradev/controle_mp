// src/app/api/messagesApi.js

import { httpClient } from "./httpClient";

export async function listMessagesApi(
	conversationId,
	{ limit = 100, offset = 0 } = {},
) {
	const { data } = await httpClient.get(
		`/conversations/${conversationId}/messages`,
		{
			params: { limit, offset },
		},
	);
	return data; // lista de MessageResponse :contentReference[oaicite:9]{index=9}
}

export async function createMessageApi(conversationId, payload) {
	// payload: { body?, message_type_id, files?, create_request? } :contentReference[oaicite:10]{index=10}
	const { data } = await httpClient.post(
		`/conversations/${conversationId}/messages`,
		payload,
	);
	return data;
}

export async function markReadApi(conversationId, message_ids) {
	// body: { message_ids: [1,2,3] } :contentReference[oaicite:11]{index=11}
	const { data } = await httpClient.post(
		`/conversations/${conversationId}/messages/read`,
		{ message_ids },
	);
	return data; // { updated: true|false } :contentReference[oaicite:12]{index=12}
}

export async function deleteMessageApi(conversationId, messageId) {
	await httpClient.delete(
		`/conversations/${conversationId}/messages/${messageId}`,
	);
}
