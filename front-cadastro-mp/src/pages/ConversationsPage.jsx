// src/pages/ConversationsPage.jsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listConversationsApi } from "../app/api/conversationsApi";

export default function ConversationsPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await listConversationsApi();
        if (!alive) return;
        setItems(Array.isArray(data) ? data : data?.items ?? []);
      } catch (err) {
        const msg = err?.response?.data?.error ?? "Erro ao carregar conversas.";
        if (alive) setError(msg);
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (busy) return <div>Carregando...</div>;
  if (error) return <div style={{ color: "crimson" }}>{error}</div>;

  return (
    <div>
      <h2>Conversas</h2>
      {items.length === 0 ? (
        <p>Nenhuma conversa encontrada.</p>
      ) : (
        <ul>
          {items.map((c) => (
            <li key={c.id}>
              <Link to={`/conversations/${c.id}`}>{c.title ?? `#${c.id}`}</Link>
              {c.has_flag ? " 🚩" : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
