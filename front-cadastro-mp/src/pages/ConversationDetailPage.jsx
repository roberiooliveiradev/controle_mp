// src/pages/ConversationDetailPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import { getConversationApi } from "../app/api/conversationsApi";
import {
  createMessageApi,
  listMessagesApi,
  markReadApi,
} from "../app/api/messagesApi";
import { MessageBubble } from "../app/ui/chat/MessageBubble";
import { ChatComposer } from "../app/ui/chat/ChatComposer";
import "./ConversationDetailPage.css";

export default function ConversationDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const bottomRef = useRef(null);

  const myUserId = user?.id;

  const unreadIds = useMemo(
    () => messages.filter((m) => !m.is_read).map((m) => m.id),
    [messages]
  );

  async function load() {
    setBusy(true);
    setError("");

    try {
      const [conversation, messageResponse] = await Promise.all([
        getConversationApi(id),
        listMessagesApi(id),
      ]);

      const nextMessages = Array.isArray(messageResponse)
        ? messageResponse
        : messageResponse?.items ?? [];

      setConv(conversation);
      setMessages(nextMessages);

      const unread = nextMessages.filter((m) => !m.is_read).map((m) => m.id);

      if (unread.length > 0) {
        await markReadApi(id, unread);

        setMessages((prev) =>
          prev.map((message) =>
            unread.includes(message.id)
              ? { ...message, is_read: true }
              : message
          )
        );
      }
    } catch (err) {
      setError(err?.response?.data?.error ?? "Erro ao carregar conversa.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(payloadOrText) {
    const isObjectPayload =
      payloadOrText && typeof payloadOrText === "object" && !Array.isArray(payloadOrText);

    const text = isObjectPayload ? payloadOrText.text : payloadOrText;
    const files = isObjectPayload ? payloadOrText.files : null;
    const createRequest = isObjectPayload ? payloadOrText.createRequest : false;
    const requestItems = isObjectPayload ? payloadOrText.requestItems : null;

    const payload = {
      message_type_id: 1,
      body: text,
      files: files?.length ? files : null,
      create_request: Boolean(createRequest),
      request_items: requestItems,
    };

    const created = await createMessageApi(id, payload);
    setMessages((prev) => [...prev, created]);
  }

  function handleAttach(files) {
    if (!files?.length) return;
  }

  if (busy) {
    return (
      <section className="cmp-conversation-detail">
        <div className="cmp-conversation-detail__state">Carregando...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cmp-conversation-detail">
        <div className="cmp-conversation-detail__error">{error}</div>
      </section>
    );
  }

  if (!conv) {
    return (
      <section className="cmp-conversation-detail">
        <div className="cmp-conversation-detail__state">
          Conversa não encontrada.
        </div>
      </section>
    );
  }

  return (
    <section className="cmp-conversation-detail">
      <header className="cmp-conversation-detail__header">
        <div className="cmp-conversation-detail__heading">
          <Link to="/conversations" className="cmp-conversation-detail__back">
            ← Conversas
          </Link>

          <div className="cmp-conversation-detail__title-area">
            <h2 className="cmp-conversation-detail__title">
              {conv.title ?? `Conversa #${conv.id}`}
            </h2>

            <div className="cmp-conversation-detail__subtitle">
              {unreadIds.length > 0
                ? `${unreadIds.length} não lida(s)`
                : "Tudo lido"}
            </div>
          </div>
        </div>
      </header>

      <div className="cmp-conversation-detail__messages">
        {messages.length === 0 ? (
          <div className="cmp-conversation-detail__state">Sem mensagens.</div>
        ) : null}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isMine={message.sender?.id === myUserId}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="cmp-conversation-detail__composer">
        <ChatComposer onSend={handleSend} onAttach={handleAttach} />
      </div>
    </section>
  );
}