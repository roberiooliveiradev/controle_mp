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

const MESSAGE_TYPE_TEXT = 1;
const MESSAGE_TYPE_REQUEST = 2;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hasFiles(e) {
  const types = e.dataTransfer?.types;
  return types && Array.from(types).includes("Files");
}


// -------------------------
// Conversations ordering helpers
// - Use updated_at when not null; otherwise created_at
// - Sort by most recent activity first
// -------------------------
function convLastActivityIso(conv) {
  return conv?.updated_at ?? conv?.created_at ?? null;
}

function convLastActivityTs(conv) {
  const iso = convLastActivityIso(conv);
  const ts = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
}

function sortConversationsByLastActivity(list) {
  const arr = Array.isArray(list) ? [...list] : [];
  arr.sort((a, b) => convLastActivityTs(b) - convLastActivityTs(a));
  return arr;
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

  // drag & drop anexos
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const [incomingFiles, setIncomingFiles] = useState([]);

  const selectedId = id ? Number(id) : null;
  const myUserId = user?.id;

  const selectedConversation = useMemo(
    () => (selectedId ? conversations.find((c) => c.id === selectedId) : null),
    [conversations, selectedId]
  );

  function bumpConversation(conversationId, activityIso) {
    const cid = Number(conversationId);
    if (!cid) return;
    const iso = activityIso || new Date().toISOString();

    setConversations((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex((c) => c.id === cid);
      if (idx < 0) return list;

      // updated_at só existe quando houve atividade após criação
      list[idx] = { ...list[idx], updated_at: iso };
      return sortConversationsByLastActivity(list);
    });
  }

  // -------------------------
  // Create conversation
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

      // atualiza lista (tenta refetch; fallback local)
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
      if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
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
  // Load chat when selecting conversation
  // -------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!selectedId) {
        setConv(null);
        setMessages([]);
        setChatError("");
        setIncomingFiles([]);
        setIsDraggingFiles(false);
        dragDepthRef.current = 0;
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

        const unreadCount = items.filter(isUnreadFromOthers).length;
        persistUnreadCounts((prev) => ({ ...(prev ?? {}), [selectedId]: unreadCount }));

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
  // SOCKET LISTENERS
  // -------------------------
  useEffect(() => {
    if (!activeUserId) return;

    const onConnect = () => {
      const cid = selectedIdRef.current;
      if (cid) joinConversationRoom(cid);
      // eslint-disable-next-line no-console
      console.log("[socket] connected", socket.id);
    };

    const onDisconnect = (r) => {
      // eslint-disable-next-line no-console
      console.log("[socket] disconnected", r);
    };

    const onConnectError = (e) => {
      // eslint-disable-next-line no-console
      console.log("[socket] connect_error", e?.message ?? e);
    };

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

      bumpConversation(cid, payload?.created_at_iso);

      const currentSelected = selectedIdRef.current;

      if (!currentSelected || cid !== currentSelected) {
        persistUnreadCounts((prev) => {
          const next = { ...(prev ?? {}) };
          next[cid] = Number(next[cid] ?? 0) + 1;
          return next;
        });
        return;
      }

      try {
        const container = messagesContainerRef.current;
        const shouldAutoScroll = isNearBottom(container, 180);

        const m = await listMessagesApi(currentSelected);
        const items = Array.isArray(m) ? m : m?.items ?? [];
        setMessages(items);

        persistUnreadCounts((prev) => ({ ...(prev ?? {}), [cid]: 0 }));

        if (shouldAutoScroll) scrollToBottom();

        const me = myUserIdRef.current;
        const unreadIds = items.filter((x) => !x.is_read && x.sender?.id !== me).map((x) => x.id);

        if (unreadIds.length) {
          await markReadApi(currentSelected, unreadIds);
          setMessages((prev) => prev.map((x) => (unreadIds.includes(x.id) ? { ...x, is_read: true } : x)));
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

  // -------------------------
  // Send message (inclui REQUEST)
  // -------------------------
  async function handleSend({ text, files, createRequest, requestItems }) {
    if (!selectedId) return;

    const hasText = Boolean((text ?? "").trim());
    const hasFiles = Array.isArray(files) && files.length > 0;
    const hasRequest = Boolean(createRequest);

    if (!hasText && !hasFiles && !hasRequest) return;

    const tempId = `tmp-${Date.now()}`;

    const optimisticFiles = (files || []).map((f, idx) => ({
      id: `tmp-file-${Date.now()}-${idx}`,
      original_name: f.name,
      stored_name: null,
      content_type: f.type || null,
      size_bytes: Number.isFinite(f.size) ? f.size : null,
      sha256: null,
      _local_preview_url: f.type?.startsWith("image/") ? URL.createObjectURL(f) : null,
      _status: "pending",
    }));

    const optimistic = {
      id: tempId,
      conversation_id: selectedId,
      body: hasRequest ? null : (text ?? null),
      created_at: new Date().toISOString(),
      sender: { id: myUserId, full_name: user?.full_name, email: user?.email },
      files: optimisticFiles,
      request: null,
      is_read: true,
      _status: "sending",
      message_type_id: hasRequest ? MESSAGE_TYPE_REQUEST : MESSAGE_TYPE_TEXT,
    };

    const shouldAutoScroll = isNearBottom(messagesContainerRef.current, 180);

    setMessages((prev) => [...prev, optimistic]);

    // ✅ sobe a conversa na lista e atualiza a data/hora pela última mensagem
    bumpConversation(selectedId, optimistic.created_at);

    try {
      const payload = {
        message_type_id: hasRequest ? MESSAGE_TYPE_REQUEST : MESSAGE_TYPE_TEXT,
        body: hasRequest ? null : (text ?? null),
        files: null,
        create_request: hasRequest,
        request_items: hasRequest ? (requestItems ?? []) : null,
      };

      const created = await createMessageApi(selectedId, payload);

      // ✅ garante timestamp oficial do backend
      bumpConversation(selectedId, created?.created_at);

      const merged = {
        ...created,
        files: optimisticFiles,
        _status: "sent",
      };

      setMessages((prev) => prev.map((m) => (m.id === tempId ? merged : m)));

      if (shouldAutoScroll) scrollToBottom();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  }

  function handleAttach(_files) {
    // opcional
  }

  // -------------------------
  // mark read ao chegar no fim do scroll
  // -------------------------
  async function handleScrollMarkRead(e) {
    if (!selectedId) return;

    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!nearBottom) return;

    const unreadIds = messages.filter((m) => !m.is_read && m.sender?.id !== myUserId).map((x) => x.id);
    if (unreadIds.length === 0) return;

    try {
      await markReadApi(selectedId, unreadIds);
      setMessages((prev) => prev.map((x) => (unreadIds.includes(x.id) ? { ...x, is_read: true } : x)));
      persistUnreadCounts((prev) => ({ ...(prev ?? {}), [selectedId]: 0 }));
    } catch {}
  }

  // -------------------------
  // Drag & Drop handlers no painel do chat
  // -------------------------
  function onDragEnterChat(e) {
    if (!selectedId) return;
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function onDragOverChat(e) {
    if (!selectedId) return;
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragLeaveChat(e) {
    if (!selectedId) return;
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
    }
  }

  function onDropChat(e) {
    if (!selectedId) return;
    if (!hasFiles(e)) return;

    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;

    setIncomingFiles(files);
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
        onDragEnter={onDragEnterChat}
        onDragOver={onDragOverChat}
        onDragLeave={onDragLeaveChat}
        onDrop={onDropChat}
        style={{
          border: "1px solid #eee",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "#fff",
          position: "relative",
        }}
      >
        {isDraggingFiles ? (
          <div
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: 14,
              border: "2px dashed #bbb",
              background: "rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 700,
              zIndex: 30,
              pointerEvents: "none",
            }}
          >
            Solte os arquivos para anexar
          </div>
        ) : null}

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

            <ChatComposer
              onSend={handleSend}
              onAttach={handleAttach}
              incomingFiles={incomingFiles}
              onIncomingFilesHandled={() => setIncomingFiles([])}
            />
          </>
        )}
      </section>
    </div>
  );
}
