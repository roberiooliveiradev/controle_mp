// src/app/api/httpClient.js

import axios from "axios";
import { env } from "../config/env";
import { authStorage } from "../auth/authStorage";

export const httpClient = axios.create({
	baseURL: `${env.apiBaseUrl}/api`,
	timeout: 20000,
});

httpClient.interceptors.request.use((config) => {
	const token = authStorage.getAccessToken();
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

httpClient.interceptors.response.use(
	(res) => res,
	(err) => {
		const status = err?.response?.status;
		if (status === 401) {
			authStorage.clearAll();
		}
		return Promise.reject(err);
	},
);
