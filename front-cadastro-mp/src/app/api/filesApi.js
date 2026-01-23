// src/app/api/filesApi.js
import { httpClient } from "./httpClient";

/**
 * Upload binário (multipart/form-data)
 * Backend: POST /files/upload
 * Retorna: { files: [{ original_name, stored_name, content_type, size_bytes, sha256 }] }
 */
export async function uploadFilesApi(files) {
	if (!Array.isArray(files) || files.length === 0) return [];

	const fd = new FormData();
	for (const f of files) fd.append("files", f);

	const { data } = await httpClient.post(`/files/upload`, fd, {
		headers: { "Content-Type": "multipart/form-data" },
	});

	return data?.files ?? [];
}

/**
 * Download autenticado (blob)
 * Backend: GET /files/<id>/download
 */
export async function downloadFileApi(fileId, fallbackName = "arquivo") {
	const res = await httpClient.get(`/files/${fileId}/download`, {
		responseType: "blob",
	});

	const blob = res.data;
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = fallbackName || "arquivo";
	document.body.appendChild(a);
	a.click();
	a.remove();

	// libera depois
	setTimeout(() => URL.revokeObjectURL(url), 1500);
}
