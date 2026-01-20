// src/app/ui/conversations/ConversationCard.jsx

export function ConversationCard({ conversation, selected, onClick, unreadCount = 0 }) {
  const lastActivity = conversation.updated_at ?? conversation.created_at;
  const createdAt = lastActivity ? new Date(lastActivity) : null;
  
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
            title={`${unreadCount} não ${unreadCount>1?'lidas':'lida'}`}
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 999,
              background: "#d92d20",
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1px 6px",
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
        {
          conversation.assigned_to?
        <div>
          <span style={{ fontWeight: 600 }}>Atribuída:</span>{" "}
          {conversation.assigned_to?.full_name ?? "—"}
        </div> : null
        }
        <div>{createdAt ? createdAt.toLocaleString("pt-BR") : ""}</div>
      </div>
    </button>
  );
}
