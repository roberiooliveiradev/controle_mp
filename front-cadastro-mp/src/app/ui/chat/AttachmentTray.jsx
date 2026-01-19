// src/app/ui/chat/AttachmentTray.jsx
function formatBytes(n) {
  if (!Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function AttachmentTray({ files = [], previews = {}, onRemove, onClear }) {
  if (!files.length) return null;

  return (
    <div style={{ borderTop: "1px solid #eee", padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <strong style={{ fontSize: 12, opacity: 0.8 }}>Anexos ({files.length})</strong>

        <button
          type="button"
          onClick={onClear}
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          Limpar
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {files.map((f, idx) => {
          const url = previews[idx];
          const isImage = f.type?.startsWith("image/");
          const isPdf = f.type === "application/pdf";
          const label = isImage ? "IMG" : isPdf ? "PDF" : (f.name?.split(".").pop() || "ARQ").toUpperCase();

          return (
            <div
              key={`${f.name}-${f.size}-${idx}`}
              style={{
                width: 160,
                border: "1px solid #eee",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
              }}
              title={f.name}
            >
              <div
                style={{
                  height: 96,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f7f7f7",
                }}
              >
                {url && isImage ? (
                  <img src={url} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>{label}</div>
                )}
              </div>

              <div style={{ padding: 8, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.name}
                </div>

                <div style={{ fontSize: 11, opacity: 0.65 }}>
                  {formatBytes(f.size)} {f.type ? `• ${f.type}` : ""}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove?.(idx)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontSize: 12,
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
