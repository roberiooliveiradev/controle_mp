// src/app/ui/chat/MessageBubble.jsx

function myStatusLabel(status) {
  if (status === "sending") return "🕓 Enviando";
  if (status === "sent") return "✓ Enviado";
  return "";
}

function fileLabel(originalName) {
  const ext = (originalName || "").split(".").pop();
  if (!ext || ext === originalName) return "ARQ";
  return String(ext).toUpperCase();
}

export function MessageBubble({ message, isMine }) {
  const dt = message.created_at ? new Date(message.created_at) : null;
  const status = message._status ?? (isMine ? "sent" : "received");

  const files = Array.isArray(message.files) ? message.files : [];

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

        {message.body ? <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div> : null}

        {files.length > 0 ? (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {files.map((f, idx) => {
              const isImg = (f.content_type || "").startsWith("image/");
              const preview = f._local_preview_url;

              return (
                <div
                  key={f.id ?? `${f.original_name}-${idx}`}
                  title={f.original_name}
                  style={{
                    width: 160,
                    border: "1px solid #eee",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      height: 96,
                      background: "#f7f7f7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isImg && preview ? (
                      <img
                        src={preview}
                        alt={f.original_name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
                        {fileLabel(f.original_name)}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: 8,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {f.original_name}
                  </div>

                  {f._status ? (
                    <div style={{ padding: "0 8px 8px", fontSize: 11, opacity: 0.65 }}>
                      {f._status === "pending" ? "🕓 Anexo pendente" : ""}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 11,
            opacity: 0.65,
            marginTop: 8,
          }}
        >
          <span>{dt ? dt.toLocaleString("pt-BR") : ""}</span>
          {isMine ? <span>{myStatusLabel(status)}</span> : null}
        </div>
      </div>
    </div>
  );
}
