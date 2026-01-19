// src/app/ui/chat/MessageBubble.jsx

function myStatusLabel(status) {
  if (status === "sending") return "🕓 Enviando";
  if (status === "sent") return "✓ Enviado";
  return "";
}

export function MessageBubble({ message, isMine }) {
  const dt = message.created_at ? new Date(message.created_at) : null;

  const status = message._status ?? (isMine ? "sent" : "received");

  return (
    <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: 720,
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid #eee",
          background: isMine ? "#f6f6f6" : "#fff",
          opacity: status === "sending" ? 0.75 : 1,
        }}
      >
        {!isMine && (
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            {message.sender?.full_name ?? message.sender?.email}
          </div>
        )}

        {message.body && <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div>}

        {/* anexos / request continuam iguais */}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, opacity: 0.65, marginTop: 8 }}>
          <span>{dt ? dt.toLocaleString("pt-BR") : ""}</span>

          {/* ✅ status só nas minhas mensagens */}
          {isMine ? <span>{myStatusLabel(status)}</span> : null}
        </div>
      </div>
    </div>
  );
}
