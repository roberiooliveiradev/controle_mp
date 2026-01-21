// src/app/api/requestsApi.js

import { httpClient } from "./httpClient";

export async function createRequestApi(payload) {
	// payload: { message_id, items:[{request_type_id, request_status_id, product_id?, fields:[...]}] }
	const { data } = await httpClient.post("/requests", payload);
	return data;
}

export async function getRequestApi(requestId) {
	const { data } = await httpClient.get(`/requests/${requestId}`);
	return data;
}

export async function deleteRequestApi(requestId) {
	await httpClient.delete(`/requests/${requestId}`);
}

// -------- Listagem (tela) --------
export async function listRequestItemsApi({
	limit = 30,
	offset = 0,
	status_id = null,
	created_by = null,
} = {}) {
	const params = new URLSearchParams();
	params.set("limit", String(limit));
	params.set("offset", String(offset));
	if (status_id != null) params.set("status_id", String(status_id));
	if (created_by != null) params.set("created_by", String(created_by));

	const { data } = await httpClient.get(`/requests/items?${params.toString()}`);
	return data;
}

// -------- Status (ANALYST/ADMIN) --------
export async function changeRequestItemStatusApi(itemId, request_status_id) {
	await httpClient.patch(`/requests/items/${itemId}/status`, {
		request_status_id,
	});
}

// -------- Edição (USER quando RETURNED) --------
export async function updateRequestItemApi(itemId, payload) {
	// payload: { request_type_id?, request_status_id?, product_id? }
	await httpClient.patch(`/requests/items/${itemId}`, payload);
}

export async function updateRequestFieldApi(fieldId, payload) {
	// payload: { field_type_id?, field_tag?, field_value?, field_flag? }
	await httpClient.patch(`/requests/fields/${fieldId}`, payload);
}
