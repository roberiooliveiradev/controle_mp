// src/app/api/usersApi.js
import { httpClient } from "./httpClient";

export async function createUserApi({ full_name, email, password }) {
  const { data } = await httpClient.post("/users", { full_name, email, password });
  return data;
}

export async function updateUserApi({ user_id, current_password, full_name, email, password }) {
  const body = { current_password };
  if (full_name != null) body.full_name = full_name;
  if (email != null) body.email = email;
  if (password != null) body.password = password;

  const { data } = await httpClient.put(`/users/${user_id}`, body);
  return data;
}

// -------------------------
// ADMIN
// -------------------------

export async function adminListUsersApi({
  limit = 30,
  offset = 0,
  include_deleted = true,
} = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("include_deleted", include_deleted ? "1" : "0");

  const { data } = await httpClient.get(`/users/admin?${params.toString()}`);
  return data; // { items, total, limit, offset }
}

export async function adminUpdateUserApi({ user_id, role_id = null, is_deleted = null }) {
  const body = {};
  if (role_id != null) body.role_id = role_id;
  if (is_deleted != null) body.is_deleted = is_deleted;

  const { data } = await httpClient.put(`/users/${user_id}/admin`, body);
  return data; // AdminUserResponse
}
