// src/app/api/productsApi.js

import axios from "axios";

export async function listProductsApi({ limit = 30, offset = 0, q = null } = {}) {
  const res = await axios.get("/api/products", {
    params: { limit, offset, q },
  });
  return res.data;
}

export async function getProductApi(productId) {
  const res = await axios.get(`/api/products/${productId}`);
  return res.data;
}
