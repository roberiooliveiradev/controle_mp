// src/app/ui/conversations/ConversationCard.jsx

export function ConversationCard({
  conversation,
  selected,
  onClick,
  unreadCount = 0,
  canDelete = false,
  deleting = false,
  onDelete,
}) {
  const lastActivity = conversation.updated_at ?? conversation.created_at;
  const createdAt = lastActivity ? new Date(lastActivity) : null;

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }

  function handleDelete(e) {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(conversation);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 12,
        borderRadius: 12,
        border: selected ? "1px solid var(--border-2)" : "1px solid var(--border)",
        background: selected ? "var(--surface-2)" : "var(--surface)",
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
          title={conversation.title ?? `Conversa #${conversation.id}`}
        >
          {conversation.title ?? `Conversa #${conversation.id}`}
        </strong>

        {unreadCount > 0 && (
          <span
            title={`${unreadCount} não ${unreadCount > 1 ? "lidas" : "lida"}`}
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 999,
              background: "var(--danger-bg)",
              color: "var(--text)",
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

        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            title="Excluir conversa"
            aria-label="Excluir conversa"
            style={{
              border: "1px solid var(--border)",
              background: deleting ? "var(--surface-2)" : "transparent",
              color: "var(--danger, #b42318)",
              borderRadius: 8,
              cursor: deleting ? "not-allowed" : "pointer",
              padding: "4px 8px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {deleting ? "..." : "Excluir"}
          </button>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
        <div>
          <span style={{ fontWeight: 600 }}>De:</span>{" "}
          {conversation.created_by?.full_name ?? conversation.created_by?.email ?? "-"}
        </div>

        {conversation.assigned_to ? (
          <div>
            <span style={{ fontWeight: 600 }}>Atribuída:</span>{" "}
            {conversation.assigned_to?.full_name ?? "—"}
          </div>
        ) : null}

        <div>{createdAt ? createdAt.toLocaleString("pt-BR") : ""}</div>
      </div>
    </div>
  );
}