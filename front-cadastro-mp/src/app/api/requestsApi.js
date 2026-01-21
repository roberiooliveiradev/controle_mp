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

  // mantém
  status_id = null,

  // novos filtros (server-side)
  created_by_name = null,   // string (nome ou e-mail)
  type_id = null,           // number (id)
  type_q = null,            // string (nome contém)
  item_id = null,           // number (id do item)
  date_mode = null,         // "AUTO" | "CREATED" | "UPDATED"
  date_from = null,         // "YYYY-MM-DD"
  date_to = null,           // "YYYY-MM-DD"

  // legado (se quiser manter no front por algum motivo)
  // created_by = null,     // id do usuário (não recomendado agora)
} = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  if (status_id != null) params.set("status_id", String(status_id));

  // ✅ novos
  if (created_by_name) params.set("created_by_name", String(created_by_name));
  if (type_id != null) params.set("type_id", String(type_id));
  if (type_q) params.set("type_q", String(type_q));
  if (item_id != null) params.set("item_id", String(item_id));
  if (date_mode) params.set("date_mode", String(date_mode));
  if (date_from) params.set("date_from", String(date_from));
  if (date_to) params.set("date_to", String(date_to));

  // ❗ se você decidir suportar filtro por ID no backend, aí sim:
  // if (created_by != null) params.set("created_by", String(created_by));

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
