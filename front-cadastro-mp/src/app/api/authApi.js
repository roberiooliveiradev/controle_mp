// src/app/api/authApi.js

import { httpClient } from "./httpClient";

export async function loginApi({ email, password }) {
  const { data } = await httpClient.post("/auth/login", { email, password });
  return data;
}

export async function ssoLoginApi({ centralAccessToken }) {
  const { data } = await httpClient.post(
    "/auth/sso-login",
    {},
    {
      headers: {
        Authorization: `Bearer ${centralAccessToken}`,
      },
    }
  );

  return data;
}

export async function refreshApi({ refresh_token }) {
  const { data } = await httpClient.post("/auth/refresh", { refresh_token });
  return data;
}

export async function logoutApi({ refresh_token } = {}) {
  const { data } = await httpClient.post("/auth/logout", { refresh_token });
  return data;
}