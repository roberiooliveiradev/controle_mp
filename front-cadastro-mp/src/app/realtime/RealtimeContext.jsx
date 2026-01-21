// src/app/realtime/RealtimeContext.js
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import { listConversationsApi } from "../api/conversationsApi";
import { useAuth } from "../auth/AuthContext";

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { activeUserId } = useAuth();

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

  // ✅ quando troca perfil, recarrega do storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(unreadKey);
      setUnreadCounts(raw ? JSON.parse(raw) : {});
    } catch {
      setUnreadCounts({});
    }
  }, [unreadKey]);

  // ✅ sempre persistir no storage
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
  // ✅ DEDUPE de eventos message:new
  // -----------------------------
  const seenRef = useRef({
    order: [], // fila (LRU)
    set: new Set(), // membership
    max: 500, // limite
  });

  function getEventKey(payload) {
    // prioriza IDs reais (o ideal)
    const mid =
      payload?.message_id ??
      payload?.messageId ??
      payload?.id ??
      payload?.message?.id;

    if (mid != null) return `mid:${mid}`;

    // fallback (caso backend não envie message_id)
    const cid = payload?.conversation_id ?? payload?.conversationId ?? "na";
    const ts = payload?.created_at_iso ?? payload?.created_at ?? "na";
    const sid = payload?.sender_id ?? payload?.sender?.id ?? "na";
    const body = payload?.body ?? payload?.text ?? "";
    // evita chave gigante
    const bodyCut = String(body).slice(0, 80);

    return `fp:${cid}|${ts}|${sid}|${bodyCut}`;
  }

  function wasSeenAndMark(key) {
    const box = seenRef.current;
    if (box.set.has(key)) return true;

    box.set.add(key);
    box.order.push(key);

    // trim
    while (box.order.length > box.max) {
      const old = box.order.shift();
      if (old != null) box.set.delete(old);
    }

    return false;
  }

  useEffect(() => {
    if (!activeUserId) return;

    async function loadInitial() {
      const data = await listConversationsApi({ limit: 50, offset: 0 });
      setConversations(Array.isArray(data) ? data : data?.items ?? []);
    }

    loadInitial();

    const onMessageNew = (payload) => {
      const cid = Number(payload?.conversation_id);
      if (!cid) return;

      // ✅ ignora duplicados (room + global, etc.)
      const key = getEventKey(payload);
      if (wasSeenAndMark(key)) return;

      bumpConversation(cid, payload?.created_at_iso ?? new Date().toISOString());

      // ✅ Só incrementa se NÃO estiver com a conversa aberta
      if (activeConvRef.current !== cid) {
        setUnreadCounts((prev) => ({
          ...(prev ?? {}),
          [cid]: Number((prev ?? {})[cid] ?? 0) + 1,
        }));
      }
    };

    const onConversationNew = () => {
      loadInitial();
    };

    socket.on("message:new", onMessageNew);
    socket.on("conversation:new", onConversationNew);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("conversation:new", onConversationNew);
    };
  }, [activeUserId]);

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
