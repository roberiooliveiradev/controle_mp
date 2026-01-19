// src/app/auth/authStorage.js


const ACTIVE_USER_ID_KEY = "cadmp_active_user_id";
const ACCESS_TOKEN_PREFIX = "cadmp_access_token:";
const REFRESH_TOKEN_PREFIX = "cadmp_refresh_token:";
const USER_PREFIX = "cadmp_user:";

function key(prefix, userId) {
  return `${prefix}${userId}`;
}

export const authStorage = {
  // ---- Active profile ----
  getActiveUserId() {
    const v = localStorage.getItem(ACTIVE_USER_ID_KEY);
    return v ? Number(v) : null;
  },
  setActiveUserId(userId) {
    localStorage.setItem(ACTIVE_USER_ID_KEY, String(userId));
  },
  clearActiveUserId() {
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
  },

  // ---- Per-user data ----
  getAccessToken(userId) {
    return localStorage.getItem(key(ACCESS_TOKEN_PREFIX, userId));
  },
  setAccessToken(userId, token) {
    localStorage.setItem(key(ACCESS_TOKEN_PREFIX, userId), token);
  },
  clearAccessToken(userId) {
    localStorage.removeItem(key(ACCESS_TOKEN_PREFIX, userId));
  },

  getRefreshToken(userId) {
    return localStorage.getItem(key(REFRESH_TOKEN_PREFIX, userId));
  },
  setRefreshToken(userId, token) {
    localStorage.setItem(key(REFRESH_TOKEN_PREFIX, userId), token);
  },
  clearRefreshToken(userId) {
    localStorage.removeItem(key(REFRESH_TOKEN_PREFIX, userId));
  },

  getUser(userId) {
    const raw = localStorage.getItem(key(USER_PREFIX, userId));
    return raw ? JSON.parse(raw) : null;
  },
  setUser(userId, user) {
    localStorage.setItem(key(USER_PREFIX, userId), JSON.stringify(user));
  },
  clearUser(userId) {
    localStorage.removeItem(key(USER_PREFIX, userId));
  },

  // ---- Profile lifecycle ----
  clearProfile(userId) {
    this.clearAccessToken(userId);
    this.clearRefreshToken(userId);
    this.clearUser(userId);

    // se estava ativo, remove ativo (quem decide próximo é o AuthContext)
    if (this.getActiveUserId() === Number(userId)) {
      this.clearActiveUserId();
    }
  },

  // ---- Helpers ----
  listProfileUserIds() {
    // Lista userIds existentes com base nas chaves de user
    const ids = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(USER_PREFIX)) {
        const idStr = k.slice(USER_PREFIX.length);
        const id = Number(idStr);
        if (Number.isFinite(id)) ids.push(id);
      }
    }
    ids.sort((a, b) => a - b);
    return ids;
  },

  getActiveAccessToken() {
    const uid = this.getActiveUserId();
    if (!uid) return null;
    return this.getAccessToken(uid);
  },
  getActiveRefreshToken() {
    const uid = this.getActiveUserId();
    if (!uid) return null;
    return this.getRefreshToken(uid);
  },
  getActiveUser() {
    const uid = this.getActiveUserId();
    if (!uid) return null;
    return this.getUser(uid);
  },
};
