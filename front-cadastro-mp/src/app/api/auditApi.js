// src/app/api/auditApi.js
import { httpClient } from "./httpClient";

export async function listAuditLogsApi({
	limit = 50,
	offset = 0,

	entity_name = null,
	action_name = null,
	user_name = null, // ✅ novo
	user_id = null, // compat
	entity_id = null,
	q = null,

	from = null,
	to = null,
} = {}) {
	const params = new URLSearchParams();
	params.set("limit", String(limit));
	params.set("offset", String(offset));

	if (entity_name) params.set("entity_name", String(entity_name));
	if (action_name) params.set("action_name", String(action_name));
	if (user_name) params.set("user_name", String(user_name)); // ✅
	if (user_id != null) params.set("user_id", String(user_id)); // compat
	if (entity_id != null) params.set("entity_id", String(entity_id));
	if (q) params.set("q", String(q));

	if (from) params.set("from", String(from));
	if (to) params.set("to", String(to));

	const { data } = await httpClient.get(`/audit/logs?${params.toString()}`);
	return data;
}

export async function getAuditSummaryApi({
	entity_name = null,
	action_name = null,
	user_name = null,
	from = null,
	to = null,
	top_users_limit = 10,
} = {}) {
	const params = new URLSearchParams();
	if (entity_name) params.set("entity_name", String(entity_name));
	if (action_name) params.set("action_name", String(action_name));
	if (user_name) params.set("user_name", String(user_name));
	if (from) params.set("from", String(from));
	if (to) params.set("to", String(to));
	params.set("top_users_limit", String(top_users_limit));

	// ✅ antes estava "/api/audit/summary"
	const { data } = await httpClient.get(`/audit/summary?${params.toString()}`);
	return data;
}
