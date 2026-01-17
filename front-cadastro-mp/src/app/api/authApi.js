// src/app/api/authApi.js

import { httpClient } from "./httpClient";

export async function loginApi({ email, password }) {
	const { data } = await httpClient.post("/auth/login", { email, password });
	return data; // { access_token, refresh_token, token_type }
}

export async function refreshApi({ refresh_token }) {
	const { data } = await httpClient.post("/auth/refresh", { refresh_token });
	return data; // { access_token, refresh_token, token_type }
}

export async function logoutApi({ refresh_token } = {}) {
	// backend aceita body opcional com refresh_token
	const { data } = await httpClient.post("/auth/logout", { refresh_token });
	return data;
}
