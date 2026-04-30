// src/app/ui/conversations/ConversationCard.jsx
import "./ConversationCard.css";

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

  function handleDelete(e) {
    e.stopPropagation();

    if (deleting) return;

    const title = conversation.title ?? `Conversa #${conversation.id}`;
    const confirmed = window.confirm(
      `Deseja excluir a conversa "${title}"?\n\nEssa ação não poderá ser desfeita.`
    );

    if (!confirmed) return;

    onDelete?.(conversation.id);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "cmp-conversation-card cmp-conversation-card--selected"
          : "cmp-conversation-card"
      }
    >
      <div className="cmp-conversation-card__header">
        <strong className="cmp-conversation-card__title">
          {conversation.title ?? `Conversa #${conversation.id}`}
        </strong>

        {unreadCount > 0 && (
          <span
            className="cmp-conversation-card__badge"
            title={`${unreadCount} não ${unreadCount > 1 ? "lidas" : "lida"}`}
          >
            {unreadCount}
          </span>
        )}

        {canDelete && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleDelete}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleDelete(e);
            }}
            className="cmp-conversation-card__delete"
            aria-label="Excluir conversa"
            title="Excluir conversa"
          >
            {deleting ? "..." : "Excluir"}
          </span>
        )}
      </div>

      <div className="cmp-conversation-card__meta">
        <div className="cmp-conversation-card__line">
          <span className="cmp-conversation-card__label">De:</span>{" "}
          <span className="cmp-conversation-card__value">
            {conversation.created_by?.full_name ??
              conversation.created_by?.email ??
              "-"}
          </span>
        </div>

        {conversation.assigned_to ? (
          <div className="cmp-conversation-card__line">
            <span className="cmp-conversation-card__label">Atribuída:</span>{" "}
            <span className="cmp-conversation-card__value">
              {conversation.assigned_to?.full_name ?? "—"}
            </span>
          </div>
        ) : null}

        <div className="cmp-conversation-card__date">
          {createdAt ? createdAt.toLocaleString("pt-BR") : ""}
        </div>
      </div>
    </button>
  );
}