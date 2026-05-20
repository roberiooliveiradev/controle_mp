// src/app/auth/AuthContext.jsx

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authStorage } from "./authStorage";
import { decodeJwt } from "./jwt";
import { loginApi, logoutApi, refreshApi, ssoLoginApi } from "../api/authApi";

import {
  connectSocket,
  disconnectSocket,
  setSocketAuthToken,
} from "../realtime/socket";

const AuthContext = createContext(null);

function normalizeEmail(value) {
  return value ? String(value).trim().toLowerCase() : "";
}

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

function getCentralIdentity(centralAccessToken) {
  const payload = decodeJwt(centralAccessToken);
  if (!payload) return null;

  return {
    sub: payload.sub,
    email: normalizeEmail(payload.email),
    name: payload.name || payload.full_name || payload.preferred_username,
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
      if (clearAll) {
        authStorage.clearAllAuth();
      } else {
        authStorage.clearActiveUserId();
        authStorage.clearLoginMode();
      }

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

  async function syncSsoSession({ centralAccessToken }) {
    if (!centralAccessToken) {
      throw new Error("Token central ausente.");
    }

    const centralIdentity = getCentralIdentity(centralAccessToken);
    if (!centralIdentity?.email) {
      throw new Error("Token central sem email.");
    }

    const currentUser = authStorage.getActiveUser();
    const currentEmail = normalizeEmail(currentUser?.email);
    const currentMode = authStorage.getLoginMode();
    const currentToken = authStorage.getActiveAccessToken();

    const alreadySynced =
      currentMode === "sso" &&
      !!currentToken &&
      !!currentEmail &&
      currentEmail === centralIdentity.email;

    if (alreadySynced) {
      return currentUser;
    }

    if (authStorage.getActiveUserId()) {
      await logout({ silent: true, clearAll: true });
    } else {
      authStorage.clearAllAuth();
      refreshActiveFromStorage();
    }

    return ssoLogin({ centralAccessToken });
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
    let cancelled = false;

    async function bootstrapSession() {
      const uid = authStorage.getActiveUserId();
      const access = authStorage.getActiveAccessToken();
      const refresh = authStorage.getActiveRefreshToken();

      if (!uid || !access || !refresh) return;

      const payload = decodeJwt(access);
      if (!payload?.exp) return;

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp > now + 30) return;

      try {
        const data = await refreshApi({ refresh_token: refresh });
        if (cancelled) return;
        applyTokenPair(data, authStorage.getLoginMode() || "local");
      } catch {
        if (cancelled) return;
        authStorage.clearProfile(uid);
        authStorage.clearActiveUserId();
        authStorage.clearLoginMode();
        refreshActiveFromStorage();
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, []);

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
      syncSsoSession,
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