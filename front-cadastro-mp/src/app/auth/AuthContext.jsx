// src/app/auth/AuthContext.jsx

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authStorage } from "./authStorage";
import { decodeJwt } from "./jwt";
import { loginApi, logoutApi, ssoLoginApi } from "../api/authApi";

import {
  connectSocket,
  disconnectSocket,
  setSocketAuthToken,
} from "../realtime/socket";

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
  const ids = authStorage
    .listProfileUserIds()
    .filter((id) => id !== excludingUserId);

  return ids.length > 0 ? ids[ids.length - 1] : null;
}

export function AuthProvider({ children }) {
  const [activeUserId, setActiveUserIdState] = useState(() =>
    authStorage.getActiveUserId()
  );

  const [user, setUser] = useState(() => authStorage.getActiveUser());
  const [token, setToken] = useState(() => authStorage.getActiveAccessToken());
  const [loginMode, setLoginMode] = useState(() => authStorage.getLoginMode());

  const isAuthenticated = !!activeUserId && !!token;

  function setActiveUserId(userId) {
    if (!userId) return;

    authStorage.setActiveUserId(userId);
    setActiveUserIdState(userId);
    setUser(authStorage.getUser(userId));
    setToken(authStorage.getAccessToken(userId));
    setLoginMode(authStorage.getLoginMode());
  }

  function refreshActiveFromStorage() {
    const uid = authStorage.getActiveUserId();

    setActiveUserIdState(uid);
    setUser(uid ? authStorage.getUser(uid) : null);
    setToken(uid ? authStorage.getAccessToken(uid) : null);
    setLoginMode(authStorage.getLoginMode());
  }

  function applyTokenPair(data, mode = "local") {
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;

    if (!accessToken || !refreshToken) {
      throw new Error("Login inválido: tokens ausentes.");
    }

    const builtUser = buildUserFromAccessToken(accessToken);
    if (!builtUser?.id) {
      throw new Error("Não foi possível ler o user_id (sub) do JWT.");
    }

    authStorage.setAccessToken(builtUser.id, accessToken);
    authStorage.setRefreshToken(builtUser.id, refreshToken);
    authStorage.setUser(builtUser.id, builtUser);
    authStorage.setLoginMode(mode);

    setLoginMode(mode);
    setActiveUserId(builtUser.id);

    return builtUser;
  }

  async function login({ email, password }) {
    const data = await loginApi({ email, password });
    return applyTokenPair(data, "local");
  }

  async function ssoLogin({ centralAccessToken }) {
    const data = await ssoLoginApi({ centralAccessToken });
    return applyTokenPair(data, "sso");
  }

  async function logout(options = {}) {
    const { silent = false, clearAll = false } = options;

    const uid = authStorage.getActiveUserId();

    if (!uid) {
      authStorage.clearActiveUserId();
      authStorage.clearLoginMode();
      refreshActiveFromStorage();
      return;
    }

    const refreshToken = authStorage.getRefreshToken(uid);

    try {
      if (silent) {
        await logoutApi({ refresh_token: refreshToken }).catch(() => {});
      } else {
        await logoutApi({ refresh_token: refreshToken });
      }
    } finally {
      if (clearAll) {
        authStorage.clearAllAuth();
      } else {
        authStorage.clearProfile(uid);

        if (!silent) {
          const nextUid = pickFallbackActiveUserId(uid);
          if (nextUid) authStorage.setActiveUserId(nextUid);
        } else {
          authStorage.clearActiveUserId();
          authStorage.clearLoginMode();
        }
      }

      refreshActiveFromStorage();
    }
  }

  function listProfiles() {
    return authStorage
      .listProfileUserIds()
      .map((id) => authStorage.getUser(id))
      .filter(Boolean);
  }

  function updateActiveUserProfile(updatedUser) {
    const uid = authStorage.getActiveUserId();
    if (!uid) return;

    const targetId = updatedUser?.id ? Number(updatedUser.id) : uid;
    if (targetId !== uid) return;

    authStorage.setUser(uid, updatedUser);
    setUser(updatedUser);
  }

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
      ssoLogin,
      logout,

      setActiveUserId,
      listProfiles,
      updateActiveUserProfile,

      loginMode,
      isSsoSession: loginMode === "sso",
    }),
    [user, token, activeUserId, isAuthenticated, loginMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return ctx;
}