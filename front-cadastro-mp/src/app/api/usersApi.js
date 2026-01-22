// src/app/api/usersApi.js
import { httpClient } from "./httpClient";

export async function createUserApi({ full_name, email, password }) {
  const { data } = await httpClient.post("/users", { full_name, email, password });
  return data;
}

export async function updateUserApi({ user_id, current_password, full_name, email, password }) {
  const body = { current_password }; // ✅ obrigatório

  if (full_name != null) body.full_name = full_name;
  if (email != null) body.email = email;
  if (password != null) body.password = password;

  const { data } = await httpClient.put(`/users/${user_id}`, body);
  return data;
}
