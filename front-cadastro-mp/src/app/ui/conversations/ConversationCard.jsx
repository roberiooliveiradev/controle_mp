// src/app/ui/conversations/ConversationCard.jsx

export function ConversationCard({ conversation, selected, onClick, unreadCount = 0 }) {
  const createdAt = conversation.created_at ? new Date(conversation.created_at) : null;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 12,
        borderRadius: 12,
        border: selected ? "1px solid #cfcfcf" : "1px solid #eee",
        background: selected ? "#f6f6f6" : "#fff",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {conversation.title ?? `Conversa #${conversation.id}`}
        </strong>

        {unreadCount > 0 && (
          <span
            title={`${unreadCount} não lida(s)`}
            style={{
              minWidth: 22,
              height: 22,
              padding: "0 8px",
              borderRadius: 999,
              border: "1px solid #ddd",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              background: "#fff",
            }}
          >
            {unreadCount}
          </span>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
        <div>
          <span style={{ fontWeight: 600 }}>De:</span>{" "}
          {conversation.created_by?.full_name ?? conversation.created_by?.email ?? "-"}
        </div>
        <div>
          <span style={{ fontWeight: 600 }}>Atribuída:</span>{" "}
          {conversation.assigned_to?.full_name ?? "—"}
        </div>
        <div>{createdAt ? createdAt.toLocaleString("pt-BR") : ""}</div>
      </div>
    </button>
  );
}
