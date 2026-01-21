// src/app/api/usersApi.js
import { httpClient } from "./httpClient";

export async function createUserApi({ full_name, email, password }) {
  const { data } = await httpClient.post("/users", { full_name, email, password });
  return data; // { id, full_name, email, role_id }
}
