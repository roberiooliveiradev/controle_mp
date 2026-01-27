// src/app/api/auditApi.js
import { httpClient } from "./httpClient";

export async function listAuditLogsApi({
	limit = 50,
	offset = 0,

	entity_name = null,
	action_name = null,
	user_id = null,
	entity_id = null,
	q = null,

	from = null, // ISO datetime: "2026-01-26T10:30:00"
	to = null, // ISO datetime
} = {}) {
	const params = new URLSearchParams();
	params.set("limit", String(limit));
	params.set("offset", String(offset));

	if (entity_name) params.set("entity_name", String(entity_name));
	if (action_name) params.set("action_name", String(action_name));
	if (user_id != null) params.set("user_id", String(user_id));
	if (entity_id != null) params.set("entity_id", String(entity_id));
	if (q) params.set("q", String(q));

	if (from) params.set("from", String(from));
	if (to) params.set("to", String(to));

	const { data } = await httpClient.get(`/audit/logs?${params.toString()}`);
	return data; // { items, total, limit, offset }
}

export async function getAuditSummaryApi({
	entity_name = null,
	action_name = null,
	user_id = null,
	from = null,
	to = null,
	top_users_limit = 10,
} = {}) {
	const params = new URLSearchParams();
	if (entity_name) params.set("entity_name", String(entity_name));
	if (action_name) params.set("action_name", String(action_name));
	if (user_id != null) params.set("user_id", String(user_id));
	if (from) params.set("from", String(from));
	if (to) params.set("to", String(to));
	params.set("top_users_limit", String(top_users_limit));

	const { data } = await httpClient.get(`/audit/summary?${params.toString()}`);
	return data; // { by_day, by_entity_action, top_users }
}
