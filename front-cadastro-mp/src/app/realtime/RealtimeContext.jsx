// src/app/realtime/RealtimeContext.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import { listConversationsApi } from "../api/conversationsApi";
import { useAuth } from "../auth/AuthContext";
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

function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function isTabFocused() {
  // document.hasFocus() pode ser melhor em alguns browsers
  return !document.hidden && (document.hasFocus?.() ?? true);
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

  const [conversations, setConversations] = useState([]);

  // ✅ Unread por perfil
  const unreadKey = useMemo(
    () => `cadmp_unread_counts:${activeUserId ?? "na"}`,
    [activeUserId]
  );

  const [unreadCounts, setUnreadCounts] = useState(() => {
    try {
      const raw = localStorage.getItem(unreadKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
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

  const activeConvRef = useRef(null);

  function bumpConversation(conversationId, iso) {
    const cid = Number(conversationId);
    if (!cid) return;

    setConversations((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex((c) => Number(c.id) === cid);
      if (idx === -1) return list;

      list[idx] = { ...list[idx], updated_at: iso };
      list.sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime()
      );

      return list;
    });
  }

  // -----------------------------
  // ✅ Controle de acesso
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
    if (isPrivileged) return true;
    return allowedConvIdsRef.current.has(Number(cid));
  }

  // -----------------------------
  // ✅ helpers payload
  // -----------------------------
  function stableText(v) {
    if (v == null) return "";
    return String(v).trim();
  }

  function bodyCut(payload) {
    const body = payload?.body ?? payload?.text ?? payload?.message?.body ?? payload?.message?.text ?? "";
    return stableText(body).slice(0, 80);
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
    const cid = payload?.conversation_id ?? payload?.conversationId ?? payload?.conversation?.id ?? payload?.id;
    const n = Number(cid);
    return Number.isFinite(n) ? n : 0;
  }

  function requestItemIdOf(payload) {
    const rid = payload?.request_item_id ?? payload?.item_id ?? payload?.requestItemId;
    const n = Number(rid);
    return Number.isFinite(n) ? n : 0;
  }

  // -----------------------------
  // ✅ DEDUPE OR (id + assinatura estável)
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
  // ✅ Notificação do navegador
  // -----------------------------
  const notifPermissionAskedRef = useRef(false);

  async function ensureNotificationPermissionOnce() {
    if (!canUseBrowserNotifications()) return false;

    // já decidido
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    // evita pedir permissão repetidamente
    if (notifPermissionAskedRef.current) return false;

    // evita pedir toda hora entre reloads
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

    // só quando não está focado (pra não duplicar a UX)
    if (isTabFocused()) return;

    const ok = await ensureNotificationPermissionOnce();
    if (!ok) return;

    try {
      // sem ícone por padrão; se quiser, me diga o caminho do logo
      const n = new Notification(title, { body });
      // fecha automaticamente
      setTimeout(() => n.close(), 6000);
    } catch {
      // ignore
    }
  }

  // -----------------------------
  // efeito principal
  // -----------------------------
  useEffect(() => {
    if (!activeUserId) return;

    let cancelled = false;

    async function loadInitial() {
      const data = await listConversationsApi({ limit: 50, offset: 0 });
      if (cancelled) return;

      const list = Array.isArray(data) ? data : data?.items ?? [];
      setConversations(list);
      prevConvIdsRef.current = new Set(list.map((c) => Number(c.id)).filter(Boolean));
    }

    async function reloadAndToastIfUserCanSeeNewConversation() {
      const data = await listConversationsApi({ limit: 50, offset: 0 });
      if (cancelled) return;

      const list = Array.isArray(data) ? data : data?.items ?? [];
      const newIds = new Set(list.map((c) => Number(c.id)).filter(Boolean));

      let hasNew = false;
      for (const id of newIds) {
        if (!prevConvIdsRef.current.has(id)) {
          hasNew = true;
          break;
        }
      }

      setConversations(list);
      prevConvIdsRef.current = newIds;

      if (hasNew) {
        toastSuccess("Nova conversa criada.");
        // notificação do navegador (apenas se não estiver focado)
        showBrowserNotification({
          title: "Controle MP",
          body: "Nova conversa criada.",
        });
      }
    }

    loadInitial();

    const onMessageNew = (payload) => {
      const cid = conversationIdOf(payload);
      if (!cid) return;

      const sid = senderIdOf(payload);
      const mid = msgIdOf(payload);

      // ✅ dedupe OR (mata global + room mesmo com payload diferente)
      const fp = `message:new|fp:${cid}|${sid}|${bodyCut(payload)}`;
      const keys = [mid ? `message:new|mid:${mid}` : "", fp];
      if (markSeenAny(keys)) return;

      // ✅ permissão
      if (isUserOnly && !canAccessConversationId(cid)) return;

      bumpConversation(cid, payload?.created_at_iso ?? payload?.created_at ?? new Date().toISOString());

      // ✅ não notificar msg minha
      const isMine = sid && Number(activeUserId) === sid;

      // ✅ se estou dentro da conversa, nada
      if (activeConvRef.current === cid) return;
      if (isMine) return;

      toastSuccess("Nova mensagem recebida.");
      setUnreadCounts((prev) => ({
        ...(prev ?? {}),
        [cid]: Number((prev ?? {})[cid] ?? 0) + 1,
      }));

      // ✅ notificação do navegador (somente fora de foco)
      showBrowserNotification({
        title: "Controle MP",
        body: "Nova mensagem recebida.",
      });
    };

    const onConversationNew = async (payload) => {
      const cid = conversationIdOf(payload);
      const title = stableText(payload?.title ?? payload?.subject ?? "");
      const fp = `conversation:new|fp:${title || bodyCut(payload)}`;
      const keys = [cid ? `conversation:new|cid:${cid}` : "", fp];
      if (markSeenAny(keys)) return;

      if (isPrivileged) {
        toastSuccess("Nova conversa criada.");
        showBrowserNotification({
          title: "Controle MP",
          body: "Nova conversa criada.",
        });
        await loadInitial();
      } else {
        await reloadAndToastIfUserCanSeeNewConversation();
      }
    };

    const onRequestCreated = (payload) => {
      // mantém dedupe simples por id ou fallback
      const reqId = Number(payload?.request_id ?? payload?.requestId ?? payload?.id);
      const sid = Number(payload?.created_by ?? payload?.user_id ?? payload?.owner_id) || senderIdOf(payload);
      const fp = `request:created|fp:${sid}|${conversationIdOf(payload)}`;
      const keys = [Number.isFinite(reqId) && reqId ? `request:created|rid:${reqId}` : "", fp];
      if (markSeenAny(keys)) return;

      if (isUserOnly && sid && sid !== Number(activeUserId)) return;

      toastSuccess("Solicitação criada.");
      showBrowserNotification({
        title: "Controle MP",
        body: "Solicitação criada.",
      });
    };

    const onRequestItemChanged = (payload) => {
      const itemId = requestItemIdOf(payload);
      const statusId = Number(payload?.request_status_id ?? payload?.status_id);
      const sid = Number(payload?.created_by ?? payload?.user_id ?? payload?.owner_id) || senderIdOf(payload);
      const fp = `request:item_changed|fp:${sid}|${conversationIdOf(payload)}|${stableText(payload?.change_kind)}|${statusId}`;
      const keys = [itemId ? `request:item_changed|item:${itemId}|st:${statusId}` : "", fp];
      if (markSeenAny(keys)) return;

      console.log(payload)

      if (isUserOnly && sid !== Number(activeUserId)) return;
      // if (payload.user_id !== payload.created_by)
      // {
      //   alert("Entrou aqui")
      //   return;
      // }
      // 🔒 Notificação APENAS para o criador da solicitação
      // if (Number(sid) !== Number(activeUserId)) {
      //   return;
      // }


      if (statusId === 3) toastSuccess("Item finalizado.");
      else if (statusId === 5) toastWarning("Item devolvido (RETURNED).");
      else if (statusId === 6) toastError("Item rejeitado (REJECTED).");
      else if (statusId === 4) toastError("Falha ao processar item (FAILED).");
      else toastWarning("Solicitação atualizada.");

      showBrowserNotification({
        title: "Controle MP",
        body: "Solicitação atualizada.",
      });
    };

    socket.on("message:new", onMessageNew);
    socket.on("conversation:new", onConversationNew);
    socket.on("request:created", onRequestCreated);
    socket.on("request:item_changed", onRequestItemChanged);

    return () => {
      cancelled = true;
      socket.off("message:new", onMessageNew);
      socket.off("conversation:new", onConversationNew);
      socket.off("request:created", onRequestCreated);
      socket.off("request:item_changed", onRequestItemChanged);
    };
  }, [activeUserId, isPrivileged, isUserOnly]);

  return (
    <RealtimeContext.Provider
      value={{
        conversations,
        setConversations,
        unreadCounts,
        setUnreadCounts,
        activeConvRef,
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
