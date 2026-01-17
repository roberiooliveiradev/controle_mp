// src/pages/ConversationDetailPage.jsx

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getConversationApi } from "../app/api/conversationsApi";
import { listMessagesApi } from "../app/api/messagesApi";

export default function ConversationDetailPage() {
  const { id } = useParams();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [c, m] = await Promise.all([
          getConversationApi(id),
          listMessagesApi(id),
        ]);
        if (!alive) return;

        setConv(c);
        setMessages(Array.isArray(m) ? m : m?.items ?? []);
      } catch (err) {
        const msg =
          err?.response?.data?.error ?? "Erro ao carregar conversa/mensagens.";
        if (alive) setError(msg);
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  if (busy) return <div>Carregando...</div>;
  if (error) return <div style={{ color: "crimson" }}>{error}</div>;
  if (!conv) return <div>Conversa não encontrada.</div>;

  return (
    <div>
      <h2>{conv.title ?? `Conversa #${conv.id}`}</h2>

      <h3>Mensagens</h3>
      {messages.length === 0 ? (
        <p>Sem mensagens.</p>
      ) : (
        <ul>
          {messages.map((m) => (
            <li key={m.id} style={{ marginBottom: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {m.created_at ?? m.createdAt ?? ""} — sender {m.sender_id ?? m.senderId}
              </div>
              <div>{m.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
