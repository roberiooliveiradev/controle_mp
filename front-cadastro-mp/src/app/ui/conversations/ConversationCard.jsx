// src/app/ui/conversations/ConversationCard.jsx

import "./ConversationCard.css";

function fmtDateTime(iso) {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("pt-BR");
}

function getUserLabel(user) {
  if (!user) return "";
  return user.full_name || user.email || "";
}

function getPreview(conversation) {
  const value =
    conversation?.last_message_preview ??
    conversation?.last_message_body ??
    conversation?.last_message?.body ??
    conversation?.latest_message?.body ??
    conversation?.message_preview ??
    "";

  if (!value) return "";

  return String(value).replace(/\s+/g, " ").trim();
}

export function ConversationCard({
  conversation,
  unreadCount = 0,
  selected = false,
  onClick,
  canDelete = false,
  deleting = false,
  onDelete,
}) {
  const title = conversation?.title || `Conversa #${conversation?.id ?? ""}`;
  const creator = getUserLabel(conversation?.created_by);
  const assignedTo = getUserLabel(conversation?.assigned_to);
  const lastActivity = conversation?.updated_at ?? conversation?.created_at;
  const preview = getPreview(conversation);
  const hasUnread = Number(unreadCount) > 0;

  function handleDelete(event) {
    event.preventDefault();
    event.stopPropagation();

    if (deleting) return;
    onDelete?.(conversation);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={[
        "cmp-conversation-card",
        selected ? "cmp-conversation-card--selected" : "",
        hasUnread ? "cmp-conversation-card--unread" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="cmp-conversation-card__main">
        <div className="cmp-conversation-card__top">
          <strong className="cmp-conversation-card__title">{title}</strong>

          <div className="cmp-conversation-card__badges">
            {conversation?.has_flag ? (
              <span className="cmp-conversation-card__flag" title="Conversa sinalizada">
                ⚑
              </span>
            ) : null}

            {hasUnread ? (
              <span className="cmp-conversation-card__unread">
                {Number(unreadCount) > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </div>
        </div>

        {preview ? (
          <p className="cmp-conversation-card__preview">{preview}</p>
        ) : null}

        <div className="cmp-conversation-card__meta">
          {creator ? (
            <span className="cmp-conversation-card__meta-line">
              <span className="cmp-conversation-card__meta-label">De:</span>{" "}
              {creator}
            </span>
          ) : null}

          {assignedTo ? (
            <span className="cmp-conversation-card__meta-line">
              <span className="cmp-conversation-card__meta-label">Para:</span>{" "}
              {assignedTo}
            </span>
          ) : null}

          {lastActivity ? (
            <time
              className="cmp-conversation-card__date"
              dateTime={lastActivity}
              title={fmtDateTime(lastActivity)}
            >
              {fmtDateTime(lastActivity)}
            </time>
          ) : null}
        </div>
      </div>

      {canDelete ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="cmp-conversation-card__delete"
          title="Excluir conversa"
        >
          {deleting ? "..." : "Excluir"}
        </button>
      ) : null}
    </article>
  );
}