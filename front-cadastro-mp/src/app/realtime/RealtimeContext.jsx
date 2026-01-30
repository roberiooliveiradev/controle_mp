// src/app/realtime/RealtimeContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  socket,
  connectSocket,
  disconnectSocket,
  setSocketAuthToken,
} from "./socket";

import {
  listConversationsApi,
  getUnreadSummaryApi,
} from "../api/conversationsApi";

import { getRequestsCountApi } from "../api/requestsApi";

import { useAuth } from "../auth/AuthContext";
import { authStorage } from "../auth/authStorage";

import { toastSuccess, toastWarning, toastError } from "../ui/toast";

const RealtimeContext = createContext(null);

const ROLE_ADMIN = 1;
const ROLE_ANALYST = 2;
const ROLE_USER = 3;

// ✅ dedupe global (protege até se tiver Provider duplicado)
function getGlobalDedupeStore() {
  const g = window;
  if (!g.__cadmpDedupe) {
    g.__cadmpDedupe = {
      seen: new Map(),
      ttlMs: 3500,
      max: 4000,
    };
  }
  return g.__cadmpDedupe;
}

function isTabFocused() {
  return !document.hidden && (document.hasFocus?.() ?? true);
}

function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function isSecureForNotifications() {
  return typeof window !== "undefined" && window.isSecureContext === true;
}

// -----------------------------
// ✅ Notificação do navegador
// -----------------------------
export async function requestBrowserNotificationsPermission() {
  if (!canUseBrowserNotifications()) return { ok: false, reason: "unsupported" };
  if (!isSecureForNotifications()) return { ok: false, reason: "insecure_context" };

  if (Notification.permission === "granted") return { ok: true };
  if (Notification.permission === "denied") return { ok: false, reason: "denied" };

  try {
    const res = await Notification.requestPermission();
    return { ok: res === "granted", reason: res };
  } catch {
    return { ok: false, reason: "error" };
  }
}

function canShowBrowserNotificationNow() {
  if (!canUseBrowserNotifications()) return false;
  if (!isSecureForNotifications()) return false;
  return Notification.permission === "granted";
}

async function showBrowserNotificationBase({ title, body }) {
  if (isTabFocused()) return;
  if (!canShowBrowserNotificationNow()) return;

  try {
    const n = new Notification(title, { body });
    setTimeout(() => n.close(), 6000);
  } catch {
    // ignore
  }
}

function productIdOf(payload) {
  const pid = payload?.product_id ?? payload?.productId ?? payload?.id;
  const n = Number(pid);
  return Number.isFinite(n) ? n : 0;
}

export function RealtimeProvider({ children }) {
  const auth = useAuth();
  const activeUserId = auth?.activeUserId;

  const roleId =
    Number(auth?.user?.role_id) ||
    Number(auth?.user?.roleId) ||
    Number(auth?.user?.role?.id) ||
    Number(auth?.currentUser?.role_id) ||
    Number(auth?.currentUser?.role?.id) ||
    ROLE_USER;

  const isPrivileged = roleId === ROLE_ADMIN || roleId === ROLE_ANALYST;
  const isUserOnly = roleId === ROLE_USER;

  // refs anti-closure (evita handlers ficarem com user antigo após logout/login)
  const activeUserIdRef = useRef(activeUserId ?? null);
  const isPrivilegedRef = useRef(isPrivileged);
  const isUserOnlyRef = useRef(isUserOnly);

  useEffect(() => {
    activeUserIdRef.current = activeUserId ?? null;
  }, [activeUserId]);

  useEffect(() => {
    isPrivilegedRef.current = isPrivileged;
    isUserOnlyRef.current = isUserOnly;
  }, [isPrivileged, isUserOnly]);

  const [conversations, setConversations] = useState([]);
  const [createdRequestsCount, setCreatedRequestsCount] = useState(0);

  // -----------------------------
  // ✅ Token "reativo"
  // -----------------------------
  const [accessToken, setAccessToken] = useState(() => {
    try {
      return String(authStorage?.getActiveAccessToken?.() ?? "").trim();
    } catch {
      return "";
    }
  });

  useEffect(() => {
    // outra aba / alguns fluxos disparam storage
    function onStorage() {
      try {
        const t = String(authStorage?.getActiveAccessToken?.() ?? "").trim();
        setAccessToken((prev) => (prev === t ? prev : t));
      } catch {
        setAccessToken((prev) => (prev === "" ? prev : ""));
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    // mesmo tab: polling leve
    const id = setInterval(() => {
      try {
        const t = String(authStorage?.getActiveAccessToken?.() ?? "").trim();
        setAccessToken((prev) => (prev === t ? prev : t));
      } catch {
        setAccessToken((prev) => (prev === "" ? prev : ""));
      }
    }, 800);

    return () => clearInterval(id);
  }, []);

  // -----------------------------
  // ✅ Unread por perfil
  // -----------------------------
  const unreadKey = useMemo(
    () => `cadmp_unread_counts:${activeUserId ?? "na"}`,
    [activeUserId]
  );

  const [unreadCounts, setUnreadCounts] = useState({});
  const lastUnreadKeyRef = useRef(null);

  useEffect(() => {
    if (lastUnreadKeyRef.current === unreadKey) return;
    lastUnreadKeyRef.current = unreadKey;

    try {
      const raw = localStorage.getItem(unreadKey);
      setUnreadCounts(raw ? JSON.parse(raw) : {});
    } catch {
      setUnreadCounts({});
    }
  }, [unreadKey]);

  useEffect(() => {
    try {
      localStorage.setItem(unreadKey, JSON.stringify(unreadCounts ?? {}));
    } catch {
      // ignore
    }
  }, [unreadKey, unreadCounts]);

  const totalUnreadMessages = useMemo(() => {
    return Object.values(unreadCounts ?? {}).reduce(
      (sum, n) => sum + Number(n || 0),
      0
    );
  }, [unreadCounts]);

  // conversa ativa (controlada pela página)
  const activeConvRef = useRef(null);

  // -----------------------------
  // ✅ Controle de acesso (para USER)
  // -----------------------------
  const allowedConvIdsRef = useRef(new Set());
  const prevConvIdsRef = useRef(new Set());

  useEffect(() => {
    allowedConvIdsRef.current = new Set(
      (conversations ?? []).map((c) => Number(c.id)).filter(Boolean)
    );
  }, [conversations]);

  function canAccessConversationId(cid) {
    if (!cid) return false;
    if (isPrivilegedRef.current) return true;
    return allowedConvIdsRef.current.has(Number(cid));
  }

  // -----------------------------
  // helpers payload
  // -----------------------------
  function stableText(v) {
    if (v == null) return "";
    return String(v).trim();
  }

  function bodyCut(payload) {
    const body =
      payload?.body ??
      payload?.text ??
      payload?.message?.body ??
      payload?.message?.text ??
      "";
    return stableText(body).slice(0, 80);
  }

  function senderNameOf(payload) {
    const n =
      payload?.sender?.full_name ??
      payload?.sender?.name ??
      payload?.message?.sender?.full_name ??
      payload?.message?.sender?.name ??
      payload?.sender_name;
    return stableText(n) || "Alguém";
  }

  function conversationTitleOf(payload) {
    const t =
      payload?.conversation?.title ??
      payload?.conversation_title ??
      payload?.title ??
      payload?.subject;
    return stableText(t);
  }

  function messagePreviewOf(payload) {
    const p =
      payload?.preview ??
      payload?.message?.preview ??
      payload?.message?.msg?.body ??
      payload?.message?.msg?.text ??
      payload?.message?.body ??
      payload?.body;
    return stableText(p).slice(0, 90);
  }

  function isConversationAssignedToMe(payload) {
    const assigneeId =
      payload?.conversation?.assigned_to ??
      payload?.conversation?.assignee?.id ??
      payload?.assigned_to;
    const n = Number(assigneeId);
    return Number.isFinite(n) && n > 0 && n === Number(activeUserIdRef.current);
  }

  function senderIdOf(payload) {
    const sid =
      payload?.sender_id ??
      payload?.sender?.id ??
      payload?.created_by ??
      payload?.user_id ??
      payload?.message?.sender_id ??
      payload?.message?.sender?.id;
    const n = Number(sid);
    return Number.isFinite(n) ? n : 0;
  }

  function msgIdOf(payload) {
    const mid =
      payload?.message_id ??
      payload?.messageId ??
      payload?.id ??
      payload?.message?.id;
    return mid == null ? "" : String(mid);
  }

  function conversationIdOf(payload) {
    const cid =
      payload?.conversation_id ??
      payload?.conversationId ??
      payload?.conversation?.id ??
      payload?.id;
    const n = Number(cid);
    return Number.isFinite(n) ? n : 0;
  }

  function requestItemIdOf(payload) {
    const rid = payload?.request_item_id ?? payload?.item_id ?? payload?.requestItemId;
    const n = Number(rid);
    return Number.isFinite(n) ? n : 0;
  }

  function bumpConversation(conversationId, iso) {
    const cid = Number(conversationId);
    if (!cid) return;

    const activityIso = iso || new Date().toISOString();

    setConversations((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex((c) => Number(c.id) === cid);
      if (idx === -1) return list;

      list[idx] = { ...list[idx], updated_at: activityIso };
      list.sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime()
      );
      return list;
    });
  }

  function updateConversationTitle(conversationId, title) {
    const cid = Number(conversationId);
    if (!cid) return;

    setConversations((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex((c) => Number(c.id) === cid);
      if (idx < 0) return list;

      list[idx] = {
        ...list[idx],
        title,
        updated_at: new Date().toISOString(),
      };
      return list;
    });
  }

  // -----------------------------
  // ✅ DEDUPE
  // -----------------------------
  function markSeenAny(keys) {
    const store = getGlobalDedupeStore();
    const now = Date.now();

    for (const k of keys) {
      if (!k) continue;
      const last = store.seen.get(k);
      if (last != null && now - last < store.ttlMs) return true;
    }

    for (const k of keys) {
      if (!k) continue;
      store.seen.set(k, now);
    }

    if (store.seen.size > store.max) {
      for (const [k, t] of store.seen) {
        if (now - t > store.ttlMs) store.seen.delete(k);
        if (store.seen.size <= store.max) break;
      }
    }

    return false;
  }

  // -----------------------------
  // ✅ Browser notification (throttle)
  // -----------------------------
  const notifPermissionAskedRef = useRef(false);

  async function ensureNotificationPermissionOnce() {
    if (!canUseBrowserNotifications()) return false;

    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    if (notifPermissionAskedRef.current) return false;

    const askedKey = "cadmp_notif_permission_asked";
    const alreadyAsked = localStorage.getItem(askedKey) === "1";
    if (alreadyAsked) {
      notifPermissionAskedRef.current = true;
      return false;
    }

    notifPermissionAskedRef.current = true;
    localStorage.setItem(askedKey, "1");

    try {
      const res = await Notification.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }

  async function showBrowserNotification({ title, body }) {
    if (!canUseBrowserNotifications()) return;
    if (isTabFocused()) return;

    const ok = await ensureNotificationPermissionOnce();
    if (!ok) return;

    await showBrowserNotificationBase({ title, body });
  }

  // -----------------------------
  // loads (API)
  // -----------------------------
  async function loadConversations() {
    const data = await listConversationsApi({ limit: 50, offset: 0 });
    const list = Array.isArray(data) ? data : data?.items ?? [];
    setConversations(list);
    prevConvIdsRef.current = new Set(list.map((c) => Number(c.id)).filter(Boolean));
  }

  async function loadUnreadSummary() {
    try {
      const summary = await getUnreadSummaryApi();
      setUnreadCounts(summary ?? {});
    } catch {
      setUnreadCounts({});
    }
  }

  async function loadCreatedRequestsCount() {
    try {
      const total = await getRequestsCountApi({ status_id: 1 });
      setCreatedRequestsCount(Number(total || 0));
    } catch {
      setCreatedRequestsCount(0);
    }
  }

  // ✅ “refreshAll” central (login/refresh/reconnect/voltar pra aba)
  async function refreshAll() {
    await Promise.allSettled([
      loadConversations(),
      loadUnreadSummary(),
      loadCreatedRequestsCount(),
    ]);
  }

  // debounce de sync (pra não floodar a API quando chegam muitas msgs)
  const syncTimerRef = useRef(null);
  function scheduleSyncAll(delayMs = 300) {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      refreshAll();
    }, delayMs);
  }

  // -----------------------------
  // ✅ efeito principal
  // -----------------------------
  useEffect(() => {
    let cancelled = false;

    // logout (ou refresh sem token)
    if (!accessToken) {
      try {
        disconnectSocket({ clearAuth: true });
      } catch {
        // ignore
      }

      setConversations([]);
      setUnreadCounts({});
      setCreatedRequestsCount(0);

      prevConvIdsRef.current = new Set();
      allowedConvIdsRef.current = new Set();
      activeConvRef.current = null;

      return () => {
        cancelled = true;
      };
    }

    // login/refresh com token
    setSocketAuthToken(accessToken);
    connectSocket(accessToken);

    const onConnect = async () => {
      if (cancelled) return;
      await refreshAll();
    };

    const onReconnect = async () => {
      if (cancelled) return;
      await refreshAll();
    };

    socket.on("connect", onConnect);
    socket.io.on?.("reconnect", onReconnect);

    // primeira carga (não depende do connect)
    (async () => {
      await refreshAll();
    })();

    // quando volta pra aba (muito comum ficar stale)
    const onVisibility = () => {
      if (!document.hidden) scheduleSyncAll(100);
    };
    document.addEventListener("visibilitychange", onVisibility);

    // -----------------------------
    // handlers realtime
    // -----------------------------
    const onMessageNew = (payload) => {
      const cid = conversationIdOf(payload);
      if (!cid) return;

      const sid = senderIdOf(payload);
      const mid = msgIdOf(payload);

      const fp = `message:new|fp:${cid}|${sid}|${bodyCut(payload)}`;
      const keys = [mid ? `message:new|mid:${mid}` : "", fp];
      if (markSeenAny(keys)) return;

      if (isUserOnlyRef.current && !canAccessConversationId(cid)) return;

      bumpConversation(
        cid,
        payload?.created_at_iso ?? payload?.created_at ?? new Date().toISOString()
      );

      const currentUserId = Number(activeUserIdRef.current);
      const isMine = sid && currentUserId === sid;

      // se estou dentro da conversa ou msg minha, não conta como unread aqui
      if (activeConvRef.current === cid) {
        // mesmo assim: mantém o backend como fonte da verdade
        scheduleSyncAll(250);
        return;
      }
      if (isMine) return;

      const who = senderNameOf(payload);
      const title = conversationTitleOf(payload);
      const prev = messagePreviewOf(payload);

      toastSuccess(
        title ? `Nova mensagem de ${who} • ${title}` : `Nova mensagem de ${who}`
      );

      // ✅ feedback instantâneo no badge
      setUnreadCounts((prevCounts) => ({
        ...(prevCounts ?? {}),
        [cid]: Number((prevCounts ?? {})[cid] ?? 0) + 1,
      }));

      // ✅ e sincroniza com o servidor (fonte da verdade)
      scheduleSyncAll(350);

      showBrowserNotification({
        title: title ? `Mensagem • ${title}` : "Nova mensagem",
        body: prev ? `${who}: ${prev}` : `${who} enviou uma mensagem.`,
      });
    };

    const onConversationNew = async (payload) => {
      const cid = conversationIdOf(payload);
      const t = stableText(payload?.title ?? payload?.subject ?? "");
      const fp = `conversation:new|fp:${t || bodyCut(payload)}`;
      const keys = [cid ? `conversation:new|cid:${cid}` : "", fp];
      if (markSeenAny(keys)) return;

      if (isPrivilegedRef.current) {
        const title = conversationTitleOf(payload);
        const creator =
          payload?.creator?.full_name ?? payload?.creator?.name ?? "Alguém";
        const assignedToMe = isConversationAssignedToMe(payload);

        toastSuccess(
          title
            ? `Nova conversa: ${title}${assignedToMe ? " • atribuída a você" : ""}`
            : `Nova conversa criada${assignedToMe ? " • atribuída a você" : ""}`
        );

        showBrowserNotification({
          title: "Nova conversa",
          body: title
            ? `${title}${assignedToMe ? " (atribuída a você)" : ""}`
            : `Criada por ${creator}${assignedToMe ? " (atribuída a você)" : ""}`,
        });
      }

      scheduleSyncAll(150);
    };

    const onRequestCreated = async (payload) => {
      const reqId = Number(payload?.request_id ?? payload?.requestId ?? payload?.id);
      const sid =
        Number(payload?.created_by ?? payload?.user_id ?? payload?.owner_id) ||
        senderIdOf(payload);

      const fp = `request:created|fp:${sid}|${conversationIdOf(payload)}`;
      const keys = [reqId ? `request:created|rid:${reqId}` : "", fp];
      if (markSeenAny(keys)) return;

      const currentUserId = Number(activeUserIdRef.current);
      if (isUserOnlyRef.current && sid && sid !== currentUserId) return;

      // ✅ atualiza contagem imediatamente + sync
      await loadCreatedRequestsCount();
      scheduleSyncAll(250);

      toastSuccess("Solicitação criada.");
      showBrowserNotification({ title: "Controle MP", body: "Solicitação criada." });
    };

    const onRequestItemChanged = async (payload) => {
      const itemId = requestItemIdOf(payload);
      const statusId = Number(payload?.request_status_id ?? payload?.status_id);

      const changedBy = Number(payload?.changed_by ?? senderIdOf(payload));
      const requestOwnerId = Number(payload?.request?.created_by);
      const currentUserId = Number(activeUserIdRef.current);

      const fp = `request:item_changed|fp:${changedBy}|${conversationIdOf(payload)}|${stableText(payload?.change_kind)}|${statusId}`;
      const keys = [
        itemId ? `request:item_changed|item:${itemId}|st:${statusId}` : "",
        fp,
      ];
      if (markSeenAny(keys)) return;

      const shouldNotify =
        currentUserId === changedBy || currentUserId === requestOwnerId;

      if (!shouldNotify && statusId !== 2 && statusId !== 1) return;

      if (statusId === 3) toastSuccess("Item finalizado.");
      else if (statusId === 5) toastWarning("Item devolvido.");
      else if (statusId === 6) toastError("Item rejeitado.");
      else if (statusId === 4) toastError("Falha ao processar item.");
      else toastWarning("Solicitação atualizada.");

      // ✅ mantém badge correto (principalmente após refresh/login)
      await loadCreatedRequestsCount();
      scheduleSyncAll(250);

      showBrowserNotification({ title: "Controle MP", body: "Solicitação atualizada." });
    };

    const onProductCreated = (payload) => {
      const pid = productIdOf(payload);
      if (!pid) return;

      const fp = `product:created|fp:${pid}|${stableText(payload?.created_at)}`;
      const keys = [`product:created|pid:${pid}`, fp];
      if (markSeenAny(keys)) return;

      toastSuccess(`Produto criado: #${pid}`);
    };

    const onProductUpdated = (payload) => {
      const pid = productIdOf(payload);
      if (!pid) return;

      const fp = `product:updated|fp:${pid}|${stableText(payload?.updated_at)}`;
      const keys = [`product:updated|pid:${pid}`, fp];
      if (markSeenAny(keys)) return;

      toastWarning(`Produto atualizado: #${pid}`);
    };

    socket.on("message:new", onMessageNew);
    socket.on("conversation:new", onConversationNew);
    socket.on("request:created", onRequestCreated);
    socket.on("request:item_changed", onRequestItemChanged);
    socket.on("product:created", onProductCreated);
    socket.on("product:updated", onProductUpdated);

    return () => {
      cancelled = true;

      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;

      document.removeEventListener("visibilitychange", onVisibility);

      socket.off("connect", onConnect);
      socket.io.off?.("reconnect", onReconnect);

      socket.off("message:new", onMessageNew);
      socket.off("conversation:new", onConversationNew);
      socket.off("request:created", onRequestCreated);
      socket.off("request:item_changed", onRequestItemChanged);
      socket.off("product:created", onProductCreated);
      socket.off("product:updated", onProductUpdated);
    };
  }, [accessToken]); // 🔥 intencional: handlers usam refs anti-closure

  return (
    <RealtimeContext.Provider
      value={{
        conversations,
        setConversations,

        unreadCounts,
        totalUnreadMessages,
        setUnreadCounts,

        createdRequestsCount,
        setCreatedRequestsCount,

        activeConvRef,
        updateConversationTitle,

        requestBrowserNotificationsPermission,
        canShowBrowserNotificationNow,
        isSecureForNotifications,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime deve ser usado dentro de RealtimeProvider");
  return ctx;
}
