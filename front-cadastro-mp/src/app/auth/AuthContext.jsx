// src/app/auth/AuthContext.jsx

import { createContext, useContext, useMemo, useState } from "react";
import { authStorage } from "./authStorage";
import { decodeJwt } from "./jwt";
import { loginApi, logoutApi } from "../api/authApi";

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

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => authStorage.getAccessToken());
  const [user, setUser] = useState(() => authStorage.getUser());
  const isAuthenticated = !!token;

  async function login({ email, password }) {
    const data = await loginApi({ email, password });

    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;

    if (!accessToken || !refreshToken) {
      throw new Error("Login inválido: tokens ausentes.");
    }

    const builtUser = buildUserFromAccessToken(accessToken);
    if (!builtUser) throw new Error("Não foi possível ler o usuário do JWT.");

    authStorage.setAccessToken(accessToken);
    authStorage.setRefreshToken(refreshToken);
    authStorage.setUser(builtUser);

    setToken(accessToken);
    setUser(builtUser);
  }

  async function logout() {
    const refreshToken = authStorage.getRefreshToken();
    try {
      await logoutApi({ refresh_token: refreshToken });
    } finally {
      authStorage.clearAll();
      setToken(null);
      setUser(null);
    }
  }

  const value = useMemo(
    () => ({ user, token, isAuthenticated, login, logout }),
    [user, token, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return ctx;
}
