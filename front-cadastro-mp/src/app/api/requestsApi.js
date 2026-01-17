// src/app/api/requestsApi.js

import { httpClient } from "./httpClient";

export async function createRequestApi(payload) {
	// payload: { message_id, items:[{request_type_id, request_status_id, product_id?, fields:[...]}] } :contentReference[oaicite:14]{index=14}
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
