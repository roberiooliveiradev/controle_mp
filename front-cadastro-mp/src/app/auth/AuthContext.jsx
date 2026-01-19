// src/app/auth/AuthContext.jsx

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authStorage } from "./authStorage";
import { decodeJwt } from "./jwt";
import { loginApi, logoutApi } from "../api/authApi";

import { connectSocket, disconnectSocket, setSocketAuthToken } from "../realtime/socket";

const AuthContext = createContext(null);

function buildUserFromAccessToken(accessToken) {
  const payload = decodeJwt(accessToken);
  if (!payload) return null;

  return {
    id: payload.sub ? Number(payload.sub) : undefined,
    email: payload.email,
    role_id: payload.role_id,
    full_name: payload.full_name,
  };
}

function pickFallbackActiveUserId(excludingUserId = null) {
  const ids = authStorage.listProfileUserIds().filter((id) => id !== excludingUserId);
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

export function AuthProvider({ children }) {
  const [activeUserId, setActiveUserIdState] = useState(() => authStorage.getActiveUserId());
  const [user, setUser] = useState(() => authStorage.getActiveUser());
  const [token, setToken] = useState(() => authStorage.getActiveAccessToken());

  const isAuthenticated = !!activeUserId && !!token;

  function setActiveUserId(userId) {
    if (!userId) return;

    authStorage.setActiveUserId(userId);
    setActiveUserIdState(userId);
    setUser(authStorage.getUser(userId));
    setToken(authStorage.getAccessToken(userId));
  }

  function refreshActiveFromStorage() {
    const uid = authStorage.getActiveUserId();
    setActiveUserIdState(uid);
    setUser(uid ? authStorage.getUser(uid) : null);
    setToken(uid ? authStorage.getAccessToken(uid) : null);
  }

  async function login({ email, password }) {
    const data = await loginApi({ email, password });
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;

    if (!accessToken || !refreshToken) throw new Error("Login inválido: tokens ausentes.");

    const builtUser = buildUserFromAccessToken(accessToken);
    if (!builtUser?.id) throw new Error("Não foi possível ler o user_id (sub) do JWT.");

    authStorage.setAccessToken(builtUser.id, accessToken);
    authStorage.setRefreshToken(builtUser.id, refreshToken);
    authStorage.setUser(builtUser.id, builtUser);

    setActiveUserId(builtUser.id);
  }

  async function logout() {
    const uid = authStorage.getActiveUserId();
    if (!uid) {
      authStorage.clearActiveUserId();
      refreshActiveFromStorage();
      return;
    }

    const refreshToken = authStorage.getRefreshToken(uid);

    try {
      await logoutApi({ refresh_token: refreshToken });
    } finally {
      authStorage.clearProfile(uid);

      const nextUid = pickFallbackActiveUserId(uid);
      if (nextUid) authStorage.setActiveUserId(nextUid);
      refreshActiveFromStorage();
    }
  }

  function listProfiles() {
    return authStorage.listProfileUserIds().map((id) => authStorage.getUser(id)).filter(Boolean);
  }

  // ✅ Socket lifecycle: sempre manter autenticado pelo token ativo
  useEffect(() => {
    if (!token) {
      setSocketAuthToken(null);
      disconnectSocket();
      return;
    }

    setSocketAuthToken(token);
    connectSocket();
  }, [token, activeUserId]);

  const value = useMemo(
    () => ({
      user,
      token,
      activeUserId,
      isAuthenticated,
      login,
      logout,
      setActiveUserId,
      listProfiles,
    }),
    [user, token, activeUserId, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return ctx;
}
