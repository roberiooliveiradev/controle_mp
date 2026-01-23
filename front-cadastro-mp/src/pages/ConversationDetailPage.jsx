// src/pages/ConversationDetailPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import { getConversationApi } from "../app/api/conversationsApi";
import { createMessageApi, listMessagesApi, markReadApi } from "../app/api/messagesApi";
import { MessageBubble } from "../app/ui/chat/MessageBubble";
import { ChatComposer } from "../app/ui/chat/ChatComposer";

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
      const [c, m] = await Promise.all([getConversationApi(id), listMessagesApi(id)]);
      setConv(c);
      setMessages(Array.isArray(m) ? m : m?.items ?? []);

      // marca como lidas (se houver)
      const unread = (Array.isArray(m) ? m : m?.items ?? []).filter((x) => !x.is_read).map((x) => x.id);
      if (unread.length > 0) {
        await markReadApi(id, unread);
        // atualiza localmente
        setMessages((prev) => prev.map((x) => (unread.includes(x.id) ? { ...x, is_read: true } : x)));
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

  async function handleSend(text) {
    const payload = {
      message_type_id: 1, // TEXT (ajuste se seu tbMessageTypes for diferente)
      body: text,
      files: null,
      create_request: false,
    };

    const created = await createMessageApi(id, payload);
    setMessages((prev) => [...prev, created]);
  }

  function handleAttach(files) {
    // UI pronta — mas depende de endpoint de upload binário ainda não existente
    alert(
      `Você selecionou ${files.length} arquivo(s). O upload ainda não está implementado no backend.`
    );
  }

  if (busy) return <div>Carregando...</div>;
  if (error) return <div style={{ color: "crimson" }}>{error}</div>;
  if (!conv) return <div>Conversa não encontrada.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 70px)", background:"red" }}>
      <div style={{ padding: "12px 0" }}>
        <h2 style={{ margin: 0 }}>{conv.title ?? `Conversa #${conv.id}`}</h2>
        <div style={{ opacity: 0.7, marginTop: 4 }}>
          {unreadIds.length > 0 ? `${unreadIds.length} não lida(s)` : "Tudo lido"}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", paddingRight: 6 }}>
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} isMine={m.sender?.id === myUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      <ChatComposer onSend={handleSend} onAttach={handleAttach} />
    </div>
  );
}
