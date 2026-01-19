// src/pages/ConversationsPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../app/auth/AuthContext";
import {
  listConversationsApi,
  getConversationApi,
  createConversationApi,
} from "../app/api/conversationsApi";
import { listMessagesApi, createMessageApi, markReadApi } from "../app/api/messagesApi";

import { ConversationCard } from "../app/ui/conversations/ConversationCard";
import { MessageBubble } from "../app/ui/chat/MessageBubble";
import { ChatComposer } from "../app/ui/chat/ChatComposer";

import { socket, joinConversationRoom, leaveConversationRoom } from "../app/realtime/socket";

const SPLIT_KEY = "cadmp_split_left_width";
const DEFAULT_LEFT = 360;
const MIN_LEFT = 260;
const MAX_LEFT = 620;
const DIVIDER_W = 8;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function ConversationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeUserId } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [listBusy, setListBusy] = useState(true);
  const [listError, setListError] = useState("");

  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  const selectedId = id ? Number(id) : null;
  const myUserId = user?.id;

  const selectedConversation = useMemo(
    () => (selectedId ? conversations.find((c) => c.id === selectedId) : null),
    [conversations, selectedId]
  );

  // -------------------------
  // ✅ Create conversation (sem flag)
  // -------------------------
  const [newTitle, setNewTitle] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  async function handleCreateConversation(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    try {
      setCreateBusy(true);
      setCreateError("");

      const created = await createConversationApi({
        title,
        has_flag: false,
        assigned_to_id: null,
      });

      setNewTitle("");

      // atualiza lista
      try {
        const data = await listConversationsApi({ limit: 50, offset: 0 });
        setConversations(Array.isArray(data) ? data : data?.items ?? []);
      } catch {
        setConversations((prev) => [created, ...(prev ?? [])]);
      }

      navigate(`/conversations/${created.id}`);
    } catch (err) {
      setCreateError(err?.response?.data?.error ?? "Erro ao criar conversa.");
    } finally {
      setCreateBusy(false);
    }
  }

  // -------------------------
  // Unread counts cache (por perfil)
  // -------------------------
  const unreadKey = `cadmp_unread_counts:${activeUserId ?? "na"}`;

  const [unreadCounts, setUnreadCounts] = useState(() => {
    try {
      const raw = localStorage.getItem(unreadKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  function persistUnreadCounts(nextOrUpdater) {
    setUnreadCounts((prev) => {
      const next =
        typeof nextOrUpdater === "function" ? nextOrUpdater(prev ?? {}) : (nextOrUpdater ?? {});
      localStorage.setItem(unreadKey, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(unreadKey);
      setUnreadCounts(raw ? JSON.parse(raw) : {});
    } catch {
      setUnreadCounts({});
    }
  }, [unreadKey]);

  // -------------------------
  // Refs anti-closure
  // -------------------------
  const selectedIdRef = useRef(null);
  const myUserIdRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  // -------------------------
  // Splitter
  // -------------------------
  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const [isDividerHover, setIsDividerHover] = useState(false);

  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem(SPLIT_KEY);
    const parsed = saved ? Number(saved) : DEFAULT_LEFT;
    return Number.isFinite(parsed) ? clamp(parsed, MIN_LEFT, MAX_LEFT) : DEFAULT_LEFT;
  });

  function startDrag(e) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function stopDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    localStorage.setItem(SPLIT_KEY, String(leftWidth));
  }

  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = clamp(e.clientX - rect.left, MIN_LEFT, MAX_LEFT);
      setLeftWidth(next);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stopDrag);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stopDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftWidth]);

  function resetSplit() {
    setLeftWidth(DEFAULT_LEFT);
    localStorage.setItem(SPLIT_KEY, String(DEFAULT_LEFT));
  }

  // -------------------------
  // Scroll / helpers
  // -------------------------
  const messagesContainerRef = useRef(null);
  const bottomRef = useRef(null);

  function isUnreadFromOthers(m) {
    return !m.is_read && m.sender?.id !== myUserIdRef.current;
  }

  function isNearBottom(el, threshold = 160) {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function scrollToFirstUnread(items) {
    const container = messagesContainerRef.current;
    if (!container) return false;

    const firstUnread = items.find((m) => isUnreadFromOthers(m));
    if (!firstUnread) return false;

    requestAnimationFrame(() => {
      const el = container.querySelector(`[data-message-id="${firstUnread.id}"]`);
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      } else {
        requestAnimationFrame(() => {
          const el2 = container.querySelector(`[data-message-id="${firstUnread.id}"]`);
          if (el2) el2.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      }
    });

    return true;
  }

  // -------------------------
  // Load conversations list
  // -------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setListBusy(true);
        setListError("");
        const data = await listConversationsApi({ limit: 50, offset: 0 });
        if (!alive) return;
        setConversations(Array.isArray(data) ? data : data?.items ?? []);
      } catch (err) {
        if (!alive) return;
        setListError(err?.response?.data?.error ?? "Erro ao carregar conversas.");
      } finally {
        if (alive) setListBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // -------------------------
  // Load chat when selecting conversation (regra nova)
  // -------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!selectedId) {
        setConv(null);
        setMessages([]);
        setChatError("");
        return;
      }

      try {
        setChatBusy(true);
        setChatError("");

        const c = await getConversationApi(selectedId);
        const m = await listMessagesApi(selectedId);

        if (!alive) return;

        setConv(c);

        const items = Array.isArray(m) ? m : m?.items ?? [];
        setMessages(items);

        // badge
        const unreadCount = items.filter(isUnreadFromOthers).length;
        persistUnreadCounts((prev) => ({ ...(prev ?? {}), [selectedId]: unreadCount }));

        // ✅ regra:
        // - se houver não lidas: rolar até a primeira não lida
        // - senão: rolar para o fim
        requestAnimationFrame(() => {
          if (!alive) return;
          const hasUnread = items.some(isUnreadFromOthers);
          if (hasUnread) {
            const did = scrollToFirstUnread(items);
            if (!did) scrollToBottom();
          } else {
            scrollToBottom();
          }
        });
      } catch (err) {
        if (!alive) return;
        setChatError(err?.response?.data?.error ?? "Erro ao carregar chat.");
      } finally {
        if (alive) setChatBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeUserId]);

  // -------------------------
  // Join/leave room on conversation select
  // -------------------------
  const prevSelectedIdRef = useRef(null);
  useEffect(() => {
    const prev = prevSelectedIdRef.current;
    if (prev && prev !== selectedId) leaveConversationRoom(prev);
    if (selectedId) joinConversationRoom(selectedId);
    prevSelectedIdRef.current = selectedId;
  }, [selectedId]);

  // -------------------------
  // SOCKET LISTENERS (regra nova de scroll)
  // -------------------------
  useEffect(() => {
    if (!activeUserId) return;

    const onConnect = () => {
      const cid = selectedIdRef.current;
      if (cid) joinConversationRoom(cid);
      console.log("[socket] connected", socket.id);
    };
    const onDisconnect = (r) => console.log("[socket] disconnected", r);
    const onConnectError = (e) => console.log("[socket] connect_error", e?.message ?? e);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    const handleConversationNew = async () => {
      try {
        const data = await listConversationsApi({ limit: 50, offset: 0 });
        setConversations(Array.isArray(data) ? data : data?.items ?? []);
      } catch {}
    };

    const handleMessageNew = async (payload) => {
      const cid = Number(payload?.conversation_id);
      if (!cid) return;

      const currentSelected = selectedIdRef.current;

      // não é a conversa aberta -> só badge
      if (!currentSelected || cid !== currentSelected) {
        persistUnreadCounts((prev) => {
          const next = { ...(prev ?? {}) };
          next[cid] = Number(next[cid] ?? 0) + 1;
          return next;
        });
        return;
      }

      try {
        // ✅ regra:
        // se usuário está perto do fim -> rolar para o fim depois de atualizar
        // senão -> não mexe no scroll
        const container = messagesContainerRef.current;
        const shouldAutoScroll = isNearBottom(container, 180);

        const m = await listMessagesApi(currentSelected);
        const items = Array.isArray(m) ? m : m?.items ?? [];
        setMessages(items);

        persistUnreadCounts((prev) => ({ ...(prev ?? {}), [cid]: 0 }));

        if (shouldAutoScroll) {
          scrollToBottom();
        }

        // opcional: marcar como lidas ao receber
        const me = myUserIdRef.current;
        const unreadIds = items.filter((x) => !x.is_read && x.sender?.id !== me).map((x) => x.id);

        if (unreadIds.length) {
          await markReadApi(currentSelected, unreadIds);
          setMessages((prev) =>
            prev.map((x) => (unreadIds.includes(x.id) ? { ...x, is_read: true } : x))
          );
        }
      } catch {}
    };

    socket.on("conversation:new", handleConversationNew);
    socket.on("message:new", handleMessageNew);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("conversation:new", handleConversationNew);
      socket.off("message:new", handleMessageNew);
    };
  }, [activeUserId]);

  function openConversation(conversationId) {
    navigate(`/conversations/${conversationId}`);
  }

  async function handleSend(text) {
    if (!selectedId) return;

    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversation_id: selectedId,
      body: text,
      created_at: new Date().toISOString(),
      sender: { id: myUserId, full_name: user?.full_name, email: user?.email },
      files: [],
      request: null,
      is_read: true,
      _status: "sending",
      message_type_id: 1,
    };

    setMessages((prev) => [...prev, optimistic]);

    try {
      const payload = {
        message_type_id: 1,
        body: text,
        files: null,
        create_request: false,
      };

      const created = await createMessageApi(selectedId, payload);

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...created, _status: "sent" } : m))
      );

      // minha mensagem enviada -> desce (UX melhor)
      scrollToBottom();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  }

  function handleAttach(files) {
    alert(`Você selecionou ${files.length} arquivo(s). O upload binário ainda precisa de rota no backend.`);
  }

  async function handleScrollMarkRead(e) {
    if (!selectedId) return;

    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!nearBottom) return;

    const unreadIds = messages.filter((m) => !m.is_read && m.sender?.id !== myUserId).map((x) => x.id);
    if (unreadIds.length === 0) return;

    try {
      await markReadApi(selectedId, unreadIds);
      setMessages((prev) =>
        prev.map((x) => (unreadIds.includes(x.id) ? { ...x, is_read: true } : x))
      );
      persistUnreadCounts((prev) => ({ ...(prev ?? {}), [selectedId]: 0 }));
    } catch {}
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "grid",
        gridTemplateColumns: `${leftWidth}px ${DIVIDER_W}px 1fr`,
        gap: 0,
        height: "calc(100vh - 110px)",
      }}
    >
      <aside
        style={{
          border: "1px solid #eee",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #eee" }}>
          <strong>Conversas</strong>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Clique para abrir o chat</div>

          {/* ✅ Nova conversa (sem flag) */}
          <form onSubmit={handleCreateConversation} style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título da nova conversa..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              disabled={createBusy}
            />

            {createError ? <div style={{ color: "crimson", fontSize: 12 }}>{createError}</div> : null}

            <button
              type="submit"
              disabled={createBusy || !newTitle.trim()}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: createBusy ? "not-allowed" : "pointer",
              }}
            >
              {createBusy ? "Criando..." : "Criar conversa"}
            </button>
          </form>
        </div>

        <div style={{ padding: 12, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {listBusy && <div>Carregando...</div>}
          {listError && <div style={{ color: "crimson" }}>{listError}</div>}

          {!listBusy && !listError && conversations.length === 0 && (
            <div style={{ opacity: 0.7 }}>Nenhuma conversa encontrada.</div>
          )}

          {conversations.map((c) => (
            <ConversationCard
              key={c.id}
              conversation={c}
              unreadCount={Number(unreadCounts?.[c.id] ?? 0)}
              selected={c.id === selectedId}
              onClick={() => openConversation(c.id)}
            />
          ))}
        </div>
      </aside>

      <div
        role="separator"
        aria-orientation="vertical"
        title="Arraste para ajustar | Duplo clique para resetar"
        onMouseDown={startDrag}
        onDoubleClick={resetSplit}
        onMouseEnter={() => setIsDividerHover(true)}
        onMouseLeave={() => setIsDividerHover(false)}
        style={{ cursor: "col-resize", position: "relative", background: "transparent" }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 10,
            bottom: 10,
            width: 2,
            transform: "translateX(-50%)",
            background: isDividerHover ? "#cfcfcf" : "#eee",
            borderRadius: 2,
          }}
        />
      </div>

      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "#fff",
        }}
      >
        {!selectedId ? (
          <div style={{ padding: 24, opacity: 0.75 }}>Selecione uma conversa à esquerda para abrir o chat.</div>
        ) : (
          <>
            <div style={{ padding: 12, borderBottom: "1px solid #eee" }}>
              <strong>{conv?.title ?? selectedConversation?.title ?? `Conversa #${selectedId}`}</strong>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                {conv?.created_by?.full_name ?? conv?.created_by?.email ?? ""}
              </div>
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={handleScrollMarkRead}
              style={{ flex: 1, overflow: "auto", padding: 12 }}
            >
              {chatBusy && <div>Carregando chat...</div>}
              {chatError && <div style={{ color: "crimson" }}>{chatError}</div>}

              {!chatBusy && !chatError && messages.length === 0 && <div style={{ opacity: 0.7 }}>Sem mensagens.</div>}

              {messages.map((m) => {
                const isMine = m.sender?.id === myUserId;
                return (
                  <div key={m.id} data-message-id={m.id}>
                    <MessageBubble message={m} isMine={isMine} />
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>

            <ChatComposer onSend={handleSend} onAttach={handleAttach} />
          </>
        )}
      </section>
    </div>
  );
}
