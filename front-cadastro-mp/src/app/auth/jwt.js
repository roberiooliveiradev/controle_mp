// src/app/auth/jwt.js

function base64UrlToJson(base64Url) {
	const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(
		base64.length + ((4 - (base64.length % 4)) % 4),
		"=",
	);
	return JSON.parse(atob(padded));
}

export function decodeJwt(token) {
	if (!token) return null;
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	return base64UrlToJson(parts[1]);
}
