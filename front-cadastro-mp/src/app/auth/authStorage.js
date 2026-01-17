// src/app/auth/authStorage.js

const ACCESS_TOKEN_KEY = "cadmp_access_token";
const REFRESH_TOKEN_KEY = "cadmp_refresh_token";
const USER_KEY = "cadmp_user";

export const authStorage = {
	getAccessToken() {
		return localStorage.getItem(ACCESS_TOKEN_KEY);
	},
	setAccessToken(token) {
		localStorage.setItem(ACCESS_TOKEN_KEY, token);
	},
	clearAccessToken() {
		localStorage.removeItem(ACCESS_TOKEN_KEY);
	},

	getRefreshToken() {
		return localStorage.getItem(REFRESH_TOKEN_KEY);
	},
	setRefreshToken(token) {
		localStorage.setItem(REFRESH_TOKEN_KEY, token);
	},
	clearRefreshToken() {
		localStorage.removeItem(REFRESH_TOKEN_KEY);
	},

	getUser() {
		const raw = localStorage.getItem(USER_KEY);
		return raw ? JSON.parse(raw) : null;
	},
	setUser(user) {
		localStorage.setItem(USER_KEY, JSON.stringify(user));
	},
	clearUser() {
		localStorage.removeItem(USER_KEY);
	},

	clearAll() {
		this.clearAccessToken();
		this.clearRefreshToken();
		this.clearUser();
	},
};
