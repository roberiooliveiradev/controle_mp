// src/app/api/productsApi.js
import { httpClient } from "./httpClient";

export async function listProductsApi({
  limit = 30,
  offset = 0,
  q = null,
  flag = "all", // ✅ novo parâmetro
} = {}) {
  const params = { limit, offset };

  if (q) params.q = q;
  if (flag) params.flag = flag;

  const { data } = await httpClient.get("/products", { params });
  return data;
}

// Flag (ANALYST/ADMIN)
export async function setProductFieldFlagApi(fieldId, field_flag) {
  await httpClient.patch(`/products/fields/${fieldId}/flag`, { field_flag });
}

export async function getProductApi(productId) {
  const { data } = await httpClient.get(`/products/${productId}`);
  return data;
}
