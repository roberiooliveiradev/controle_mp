// src/app/api/productsApi.js
import { httpClient } from "./httpClient";

export async function listProductsApi({
	limit = 30,
	offset = 0,
	q = null,
} = {}) {
	const { data } = await httpClient.get("/products", {
		params: { limit, offset, q },
	});
	return data;
}

// Flag (ANALYST/ADMIN)
export async function setProductFieldFlagApi(fieldId, field_flag) {
	// field_flag: string | null
	await httpClient.patch(`/products/fields/${fieldId}/flag`, { field_flag });
}

export async function getProductApi(productId) {
	const { data } = await httpClient.get(`/products/${productId}`);
	return data;
}
