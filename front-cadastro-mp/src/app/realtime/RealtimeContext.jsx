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

function isTabFocused() {
  // document.hasFocus() pode ser melhor em alguns browsers
  return !document.hidden && (document.hasFocus?.() ?? true);
}

function productIdOf(payload) {
  const pid = payload?.product_id ?? payload?.productId ?? payload?.id;
  const n = Number(pid);
  return Number.isFinite(n) ? n : 0;
}

function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function isSecureForNotifications() {
  // Chrome exige contexto seguro p/ Notification:
  // https://, localhost, 127.0.0.1 (isSecureContext = true)
  return typeof window !== "undefined" && window.isSecureContext === true;
}

// -----------------------------
// ✅ Notificação do navegador (Chrome-safe)
// -----------------------------
async function requestBrowserNotificationsPermission() {
  if (!canUseBrowserNotifications()) return { ok: false, reason: "unsupported" };
  if (!isSecureForNotifications()) return { ok: false, reason: "insecure_context" };

  if (Notification.permission === "granted") return { ok: true };
  if (Notification.permission === "denied") return { ok: false, reason: "denied" };

  // ⚠️ IMPORTANTE: isso deve ser chamado por clique do usuário
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

async function showBrowserNotification({ title, body }) {
  // só quando não está focado (pra não duplicar a UX)
  if (isTabFocused()) return;

  // ✅ não tenta pedir permissão aqui (evento de socket no Chrome costuma falhar)
  if (!canShowBrowserNotificationNow()) return;

  try {
    const n = new Notification(title, { body });
    setTimeout(() => n.close(), 6000);
  } catch {
    // ignore
  }
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
    return Number.isFinite(n) && n > 0 && n === Number(activeUserId);
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
        toastSuccess("Você recebeu uma nova conversa.");
        showBrowserNotification({ title: "Controle MP", body: "Você recebeu uma nova conversa." });
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

      const who = senderNameOf(payload);
      const title = conversationTitleOf(payload);
      const prev = messagePreviewOf(payload);

      const toastText = title
        ? `Nova mensagem de ${who} • ${title}`
        : `Nova mensagem de ${who}`;

      toastSuccess(toastText);

      setUnreadCounts((prevCounts) => ({
        ...(prevCounts ?? {}),
        [cid]: Number((prevCounts ?? {})[cid] ?? 0) + 1,
      }));

      showBrowserNotification({
        title: title ? `Mensagem • ${title}` : "Nova mensagem",
        body: prev ? `${who}: ${prev}` : `${who} enviou uma mensagem.`,
      });

    };

    const onConversationNew = async (payload) => {
      const cid = conversationIdOf(payload);
      const title = stableText(payload?.title ?? payload?.subject ?? "");
      const fp = `conversation:new|fp:${title || bodyCut(payload)}`;
      const keys = [cid ? `conversation:new|cid:${cid}` : "", fp];
      if (markSeenAny(keys)) return;

      if (isPrivileged) {

        const title = conversationTitleOf(payload);
        const creator = payload?.creator?.full_name ?? payload?.creator?.name ?? "Alguém";
        const assignedToMe = isConversationAssignedToMe(payload);

        const toastText = title
          ? `Nova conversa: ${title}${assignedToMe ? " • atribuída a você" : ""}`
          : `Nova conversa criada${assignedToMe ? " • atribuída a você" : ""}`;

        toastSuccess(toastText);

        showBrowserNotification({
          title: "Nova conversa",
          body: title
            ? `${title}${assignedToMe ? " (atribuída a você)" : ""}`
            : `Criada por ${creator}${assignedToMe ? " (atribuída a você)" : ""}`,
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

      const changedBy = Number(payload?.changed_by ?? senderIdOf(payload));
      const requestOwnerId = Number(payload?.request?.created_by);
      const currentUserId = Number(activeUserId);

      const fp = `request:item_changed|fp:${changedBy}|${conversationIdOf(payload)}|${stableText(payload?.change_kind)}|${statusId}`;
      const keys = [itemId ? `request:item_changed|item:${itemId}|st:${statusId}` : "", fp];
      if (markSeenAny(keys)) return;

      // 🔐 regra de visibilidade de toast
      const shouldNotify =
        currentUserId === changedBy || // quem alterou
        currentUserId === requestOwnerId; // criador da solicitação

      if (!shouldNotify && !(statusId===2) && !(statusId===1)) {
        return; // ❌ sai silenciosamente
      }

      // ✅ payload completo disponível
      const fullRequest = payload?.request;
      const fullItem = payload?.item;

      if (statusId === 3) toastSuccess("Item finalizado.");
      else if (statusId === 5) toastWarning("Item devolvido atualizado.");
      else if (statusId === 6) toastError("Item rejeitado atualizado.");
      else if (statusId === 4) toastError("Falha ao processar item.");
      else toastWarning("Solicitação atualizada.");

      showBrowserNotification({
        title: "Controle MP",
        body: "Solicitação atualizada.",
      });
    };

    const onProductCreated = (payload) => {
      const pid = productIdOf(payload);
      if (!pid) return;

      const fp = `product:created|fp:${pid}|${stableText(payload?.created_at)}`;
      const keys = [`product:created|pid:${pid}`, fp];
      if (markSeenAny(keys)) return;

      const code = stableText(payload?.codigo_atual);
      const desc = stableText(payload?.descricao);

      toastSuccess(`Produto criado: #${pid}${code ? ` • ${code}` : ""}`);
      showBrowserNotification({
        title: "Produto criado",
        body: desc ? `#${pid} • ${desc}` : `Produto #${pid} criado.`,
      });
    };

    const onProductUpdated = (payload) => {
      const pid = productIdOf(payload);
      if (!pid) return;

      const fp = `product:updated|fp:${pid}|${stableText(payload?.updated_at)}`;
      const keys = [`product:updated|pid:${pid}`, fp];
      if (markSeenAny(keys)) return;

      const code = stableText(payload?.codigo_atual);
      const desc = stableText(payload?.descricao);

      toastWarning(`Produto atualizado: #${pid}${code ? ` • ${code}` : ""}`);
      showBrowserNotification({
        title: "Produto atualizado",
        body: desc ? `#${pid} • ${desc}` : `Produto #${pid} atualizado.`,
      });
    };

    const onProductFlagChanged = (payload) => {
      const pid = productIdOf(payload);
      const fid = Number(payload?.field_id);
      if (!pid || !fid) return;

      const flag = stableText(payload?.field_flag);
      const tag = stableText(payload?.field_tag);

      const fp = `product:flag_changed|fp:${pid}|${fid}|${tag}|${flag}`;
      const keys = [`product:flag_changed|pid:${pid}|fid:${fid}|flag:${flag}`, fp];
      if (markSeenAny(keys)) return;

      // toastWarning(`Flag alterada no produto #${pid}${tag ? ` • ${tag}` : ""}`);
      // showBrowserNotification({
      //   title: "Flag alterada",
      //   body: `Produto #${pid}${tag ? ` • ${tag}` : ""}${flag ? ` • 🚩 ${flag}` : " • flag removida"}`,
      // });
    };

    socket.on("message:new", onMessageNew);
    socket.on("conversation:new", onConversationNew);
    socket.on("request:created", onRequestCreated);
    socket.on("request:item_changed", onRequestItemChanged);

    socket.on("product:created", onProductCreated);
    socket.on("product:updated", onProductUpdated);
    socket.on("product:flag_changed", onProductFlagChanged);

    return () => {
      cancelled = true;
      socket.off("message:new", onMessageNew);
      socket.off("conversation:new", onConversationNew);
      socket.off("request:created", onRequestCreated);
      socket.off("request:item_changed", onRequestItemChanged);
      socket.off("product:created", onProductCreated);
      socket.off("product:updated", onProductUpdated);
      socket.off("product:flag_changed", onProductFlagChanged);
    };
  }, [activeUserId, isPrivileged, isUserOnly]);

  const totalUnreadMessages = useMemo(() => {
    return Object.values(unreadCounts ?? {}).reduce(
      (sum, n) => sum + Number(n || 0),
      0
    );
  }, [unreadCounts]);

  return (
    <RealtimeContext.Provider
      value={{
        conversations,
        setConversations,
        unreadCounts,
        totalUnreadMessages,
        setUnreadCounts,
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


