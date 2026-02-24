// src/app/api/httpClient.js

import axios from "axios";
import { env } from "../config/env";
import { authStorage } from "../auth/authStorage";
import { refreshApi } from "./authApi";

import { connectSocket, setSocketAuthToken } from "../realtime/socket";

export const httpClient = axios.create({
  baseURL: `${env.apiBaseUrl}${env.apiPrefix}`,
  timeout: 20000,
});

httpClient.interceptors.request.use((config) => {
  const token = authStorage.getActiveAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue = [];

function resolveQueue(error, newAccessToken) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newAccessToken);
  });
  refreshQueue = [];
}

httpClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const status = err?.response?.status;

    if (status !== 401 || originalRequest?._retry) {
      return Promise.reject(err);
    }

    const activeUserId = authStorage.getActiveUserId();
    const refreshToken = authStorage.getActiveRefreshToken();

    if (!activeUserId || !refreshToken) {
      authStorage.clearActiveUserId();
      return Promise.reject(err);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(httpClient(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const data = await refreshApi({ refresh_token: refreshToken });
      const newAccess = data.access_token;
      const newRefresh = data.refresh_token;

      authStorage.setAccessToken(activeUserId, newAccess);
      authStorage.setRefreshToken(activeUserId, newRefresh);

      // ✅ mantém o socket autenticado após refresh
      setSocketAuthToken(newAccess);
      connectSocket();

      resolveQueue(null, newAccess);

      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return httpClient(originalRequest);
    } catch (refreshErr) {
      resolveQueue(refreshErr, null);
      authStorage.clearProfile(activeUserId);
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
