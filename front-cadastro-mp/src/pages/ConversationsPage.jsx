// src/pages/ConversationsPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "./ConversationsPage.css";
import { useAuth } from "../app/auth/AuthContext";
import { useRealtime } from "../app/realtime/RealtimeContext";

import {
  listConversationsApi,
  getConversationApi,
  createConversationApi,
  updateConversationApi,
  deleteConversationApi,
} from "../app/api/conversationsApi";
import { listMessagesApi, createMessageApi, markReadApi } from "../app/api/messagesApi";
import { uploadFilesApi } from "../app/api/filesApi";

import { ConversationCard } from "../app/ui/conversations/ConversationCard";
import { MessageBubble } from "../app/ui/chat/MessageBubble";
import { ChatComposer } from "../app/ui/chat/ChatComposer";

import { joinConversationRoom, leaveConversationRoom, socket } from "../app/realtime/socket";

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

// Ordenação por last activity (updated_at se existir, senão created_at)
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
  const location = useLocation();

  const { user, activeUserId } = useAuth();
  const isAdmin = Number(user?.role_id) === 1;
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  // 🔥 Fonte única global (conversas + unread) vem do contexto
  const {
    conversations,
    setConversations,
    unreadCounts,
    setUnreadCounts,
    activeConvRef,
    updateConversationTitle, 
  } = useRealtime();

  // lê messageId para rolar
  const targetMessageId = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    const v = sp.get("messageId");
    const n = v ? Number(v) : null;
    return Number.isFinite(n) ? n : null;
  }, [location.search]);

  const selectedId = id ? Number(id) : null;
  const myUserId = user?.id;

  const selectedConversation = useMemo(
    () => (selectedId ? conversations.find((c) => Number(c.id) === Number(selectedId)) : null),
    [conversations, selectedId]
  );

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
  // Active conversation (Fonte ÚNICA p/ evitar duplicação de unread)
  // -------------------------
  useEffect(() => {
    activeConvRef.current = selectedId ?? null;
    return () => {
      activeConvRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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
  // Helpers: bump conversation (apenas ordenação/updated_at; NÃO mexe em unread)
  // -------------------------
  function bumpConversation(conversationId, activityIso) {
    const cid = Number(conversationId);
    if (!cid) return;
    const iso = activityIso || new Date().toISOString();

    setConversations((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex((c) => Number(c.id) === cid);
      if (idx < 0) return sortConversationsByLastActivity(list);
      list[idx] = { ...list[idx], updated_at: iso };
      return sortConversationsByLastActivity(list);
    });
  }

  // -------------------------
  // Load chat when selecting conversation
  // -------------------------
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const [incomingFiles, setIncomingFiles] = useState([]);

  const messagesContainerRef = useRef(null);
  const bottomRef = useRef(null);

  // -------------------------
  // Editar título (inline)
  // -------------------------
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // sempre que trocar a conversa, fecha o modo edição
  useEffect(() => {
    setEditingTitle(false);
  }, [selectedId]);

  // mantém o draft sincronizado com o título carregado
  useEffect(() => {
    if (conv?.title) setTitleDraft(conv.title);
  }, [conv?.title]);

  async function saveTitle() {
    if (!conv?.id) return setEditingTitle(false);

    const value = titleDraft.trim();
    if (!value || value === conv.title) {
      setEditingTitle(false);
      return;
    }

    try {
      const updated = await updateConversationApi(conv.id, { title: value });

      setConv(updated); // header do chat
      updateConversationTitle(updated.id, updated.title); 
    } catch (err) {
      alert(err?.response?.data?.error ?? "Erro ao atualizar título");
    } finally {
      setEditingTitle(false);
    }
  }
  
  //----------------------------------------------------
  // carregar conversas (com filtro)
  //----------------------------------------------------
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  async function handleSearch(forcedTitle) {
    const raw = typeof forcedTitle === "string"
      ? forcedTitle
      : typeof newTitle === "string"
        ? newTitle
        : "";

    const value = raw.trim();

    try {
      const data = await listConversationsApi({
        title: value,
      });

      const arr = Array.isArray(data) ? data : data?.items ?? [];
      setConversations(sortConversationsByLastActivity(arr));
    } catch (err) {
      console.error("Erro ao filtrar conversas", err);
    }
  }

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

  function scrollToMessage(messageId) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      else scrollToBottom();
    });
  }

  function scrollToFirstUnread(items) {
    const el = messagesContainerRef.current;
    if (!el) return false;

    const me = myUserIdRef.current;
    const firstUnread = (items || []).find((m) => !m.is_read && m.sender?.id !== me);
    if (!firstUnread) return false;

    const target = document.getElementById(`msg-${firstUnread.id}`);
    if (!target) return false;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

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

        // ✅ sincroniza unread do contexto com a verdade do servidor
        const unreadCount = items.filter(isUnreadFromOthers).length;
        setUnreadCounts((prev) => ({ ...(prev ?? {}), [selectedId]: unreadCount }));

        requestAnimationFrame(() => {
          if (!alive) return;

          if (targetMessageId) {
            scrollToMessage(targetMessageId);
            return;
          }

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
  }, [selectedId, activeUserId, targetMessageId]);

  // -------------------------
  // Realtime: atualizar mensagens da conversa ativa (SEM contar unread aqui)
  // -------------------------
  useEffect(() => {
    if (!activeUserId) return;

    const onMessageNew = async (payload) => {
      const cid = Number(payload?.conversation_id);
      if (!cid) return;

      bumpConversation(cid, payload?.created_at_iso ?? new Date().toISOString());

      const currentSelected = selectedIdRef.current;
      if (!currentSelected || cid !== currentSelected) {
        return;
      }

      try {
        const container = messagesContainerRef.current;
        const shouldAutoScroll = isNearBottom(container, 180);

        const m = await listMessagesApi(currentSelected);
        const items = Array.isArray(m) ? m : m?.items ?? [];
        setMessages(items);

        setUnreadCounts((prev) => ({ ...(prev ?? {}), [cid]: 0 }));

        if (shouldAutoScroll) scrollToBottom();

        const me = myUserIdRef.current;
        const unreadIds = items
          .filter((x) => !x.is_read && x.sender?.id !== me)
          .map((x) => x.id);

        if (unreadIds.length) {
          await markReadApi(currentSelected, unreadIds);
          setMessages((prev) =>
            prev.map((x) => (unreadIds.includes(x.id) ? { ...x, is_read: true } : x))
          );
          setUnreadCounts((prev) => ({ ...(prev ?? {}), [cid]: 0 }));
        }
      } catch {
        // ignore
      }
    };

    socket.on("message:new", onMessageNew);
    return () => {
      socket.off("message:new", onMessageNew);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

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

      // atualiza lista global
      try {
        const data = await listConversationsApi();
        const arr = Array.isArray(data) ? data : data?.items ?? [];
        setConversations(sortConversationsByLastActivity(arr));
      } catch {
        setConversations((prev) => sortConversationsByLastActivity([created, ...(prev ?? [])]));
      }

      navigate(`/conversations/${created.id}`);
    } catch (err) {
      setCreateError(err?.response?.data?.error ?? "Erro ao criar conversa.");
    } finally {
      setCreateBusy(false);
    }
  }

  function openConversation(conversationId) {
    navigate(`/conversations/${conversationId}`);
  }

  async function handleDeleteConversation(conversation) {
    if (!conversation?.id) return;
    if (!isAdmin) return;

    const title = conversation.title ?? `Conversa #${conversation.id}`;

    const ok = window.confirm(
      `Deseja realmente excluir a conversa "${title}"?\n\nEssa ação removerá a conversa da listagem.`
    );

    if (!ok) return;

    try {
      setDeleteBusyId(Number(conversation.id));

      await deleteConversationApi(conversation.id);

      setConversations((prev) =>
        (Array.isArray(prev) ? prev : []).filter(
          (item) => Number(item.id) !== Number(conversation.id)
        )
      );

      setUnreadCounts((prev) => {
        const next = { ...(prev ?? {}) };
        delete next[conversation.id];
        return next;
      });

      if (Number(selectedId) === Number(conversation.id)) {
        setConv(null);
        setMessages([]);
        setChatError("");
        navigate("/conversations", { replace: true });
      }
    } catch (err) {
      alert(
        err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Erro ao excluir conversa."
      );
    } finally {
      setDeleteBusyId(null);
    }
  }

  // -------------------------
  // Send message (inclui upload de anexos)
  // -------------------------
  async function handleSend({ text, files, createRequest, requestItems }) {
    if (!selectedId) return;

    const hasText = Boolean((text ?? "").trim());
    const hasFilesArr = Array.isArray(files) && files.length > 0;
    const hasRequest = Boolean(createRequest);

    if (!hasText && !hasFilesArr && !hasRequest) return;

    const tempId = `tmp-${Date.now()}`;

    const optimisticFiles = (files || []).map((f, idx) => ({
      id: `tmp-file-${Date.now()}-${idx}`,
      original_name: f.name,
      stored_name: null,
      content_type: f.type || null,
      size_bytes: Number.isFinite(f.size) ? f.size : null,
      sha256: null,
      _local_preview_url: f.type?.startsWith("image/") ? URL.createObjectURL(f) : null,
      _status: "uploading",
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
    bumpConversation(selectedId, optimistic.created_at);

    try {
      // 1) upload binário (se houver)
      let uploadedMeta = null;
      if (hasFilesArr) {
        uploadedMeta = await uploadFilesApi(files);

        // marca anexos como "uploaded" (ainda falta criar a mensagem)
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== tempId) return m;
            const nextFiles = (m.files || []).map((x) => ({ ...x, _status: "uploaded" }));
            return { ...m, files: nextFiles };
          })
        );
      }

      // 2) cria mensagem com metadata
      const payload = {
        message_type_id: hasRequest ? MESSAGE_TYPE_REQUEST : MESSAGE_TYPE_TEXT,
        body: hasRequest ? null : (text ?? null),
        files: uploadedMeta, // ✅ agora vai populated
        create_request: hasRequest,
        request_items: hasRequest ? (requestItems ?? []) : null,
      };

      const created = await createMessageApi(selectedId, payload);
      bumpConversation(selectedId, created?.created_at);

      // 3) mescla resposta do servidor + mantém preview local (imagem) até reload
      const createdFiles = Array.isArray(created?.files) ? created.files : [];
      const mergedFiles = createdFiles.map((srv, idx) => {
        const opt = optimisticFiles[idx];
        return {
          ...srv,
          _local_preview_url: opt?._local_preview_url ?? null,
          _status: null,
        };
      });

      const merged = {
        ...created,
        files: mergedFiles,
        _status: "sent",
      };

      setMessages((prev) => prev.map((m) => (m.id === tempId ? merged : m)));
      setUnreadCounts((prev) => ({ ...(prev ?? {}), [selectedId]: 0 }));

      if (shouldAutoScroll) scrollToBottom();
    } catch (err) {
      // remove a mensagem otimista
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

    const unreadIds = messages
      .filter((m) => !m.is_read && m.sender?.id !== myUserId)
      .map((x) => x.id);

    if (unreadIds.length === 0) return;

    try {
      await markReadApi(selectedId, unreadIds);
      setMessages((prev) =>
        prev.map((x) => (unreadIds.includes(x.id) ? { ...x, is_read: true } : x))
      );
      setUnreadCounts((prev) => ({ ...(prev ?? {}), [selectedId]: 0 }));
    } catch {
      // ignore
    }
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
      className={
        selectedId
          ? "cmp-conversations cmp-conversations--chat-open"
          : "cmp-conversations"
      }
      style={{ "--cmp-conversations-sidebar-width": `${leftWidth}px` }}
    >
      <aside className="cmp-conversations__sidebar">
        <div className="cmp-conversations__sidebar-header">
          <strong className="cmp-conversations__title">Conversas</strong>
          <div className="cmp-conversations__subtitle">
            Clique para abrir o chat
          </div>

          <form
            onSubmit={handleCreateConversation}
            className="cmp-conversations__form"
          >
            <div className="cmp-conversations__search-wrap">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="Digite para criar ou pesquisar..."
                className="cmp-conversations__search-input"
                disabled={createBusy}
              />

              {newTitle.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setNewTitle("");
                    handleSearch("");
                  }}
                  title="Limpar filtro"
                  className="cmp-conversations__field-action cmp-conversations__field-action--clear"
                >
                  ✕
                </button>
              )}

              <button
                type="button"
                onClick={handleSearch}
                title="Pesquisar conversas"
                className={
                  isSearchFocused
                    ? "cmp-conversations__field-action cmp-conversations__field-action--search cmp-conversations__field-action--active"
                    : "cmp-conversations__field-action cmp-conversations__field-action--search"
                }
              >
                🔍
              </button>
            </div>

            {createError ? (
              <div className="cmp-conversations__form-error">{createError}</div>
            ) : null}

            <button
              type="submit"
              disabled={createBusy || !newTitle.trim()}
              className="cmp-conversations__create-button"
            >
              {createBusy ? "Criando..." : "Criar conversa"}
            </button>
          </form>
        </div>

        <div className="cmp-conversations__list">
          {conversations.length === 0 ? (
            <div className="cmp-conversations__empty">
              Nenhuma conversa encontrada.
            </div>
          ) : null}

          {sortConversationsByLastActivity(conversations).map((c) => (
            <ConversationCard
              key={c.id}
              conversation={c}
              unreadCount={Number(unreadCounts?.[c.id] ?? 0)}
              selected={Number(c.id) === Number(selectedId)}
              onClick={() => openConversation(c.id)}
              canDelete={isAdmin}
              deleting={Number(deleteBusyId) === Number(c.id)}
              onDelete={handleDeleteConversation}
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
        className={
          isDividerHover
            ? "cmp-conversations__divider cmp-conversations__divider--hover"
            : "cmp-conversations__divider"
        }
      >
        <span className="cmp-conversations__divider-line" />
      </div>

      <section
        onDragEnter={onDragEnterChat}
        onDragOver={onDragOverChat}
        onDragLeave={onDragLeaveChat}
        onDrop={onDropChat}
        className="cmp-conversations__chat"
      >
        {isDraggingFiles ? (
          <div className="cmp-conversations__dropzone">
            Solte os arquivos para anexar
          </div>
        ) : null}

        {!selectedId ? (
          <div className="cmp-conversations__placeholder">
            Selecione uma conversa à esquerda para abrir o chat.
          </div>
        ) : (
          <>
            <div className="cmp-conversations__chat-header">
              <button
                type="button"
                className="cmp-conversations__back-button"
                onClick={() => navigate("/conversations")}
              >
                ← Conversas
              </button>

              <div className="cmp-conversations__chat-title-area">
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle();
                      if (e.key === "Escape") {
                        setTitleDraft(conv?.title ?? "");
                        setEditingTitle(false);
                      }
                    }}
                    className="cmp-conversations__title-input"
                  />
                ) : (
                  <strong
                    className="cmp-conversations__chat-title"
                    title="Clique para editar"
                    onClick={() => setEditingTitle(true)}
                  >
                    {conv?.title ?? `Conversa #${selectedId}`}
                  </strong>
                )}

                <div className="cmp-conversations__chat-subtitle">
                  {conv?.created_by?.full_name ?? conv?.created_by?.email ?? ""}
                </div>
              </div>
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={handleScrollMarkRead}
              className="cmp-conversations__messages"
            >
              {chatBusy && (
                <div className="cmp-conversations__state">Carregando chat...</div>
              )}

              {chatError && (
                <div className="cmp-conversations__error">{chatError}</div>
              )}

              {!chatBusy && !chatError && messages.length === 0 ? (
                <div className="cmp-conversations__empty">Sem mensagens.</div>
              ) : null}

              {messages.map((m) => {
                const isMine = m.sender?.id === myUserId;
                return (
                  <div key={m.id} id={`msg-${m.id}`} data-message-id={m.id}>
                    <MessageBubble message={m} isMine={isMine} />
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>

            <div className="cmp-conversations__composer">
              <ChatComposer
                onSend={handleSend}
                onAttach={handleAttach}
                incomingFiles={incomingFiles}
                onIncomingFilesHandled={() => setIncomingFiles([])}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
