// src/app/ui/chat/AttachmentTray.jsx
import "./AttachmentTray.css";

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

function fileLabel(file) {
  const isImage = file.type?.startsWith("image/");
  const isPdf = file.type === "application/pdf";

  if (isImage) return "IMG";
  if (isPdf) return "PDF";

  return (file.name?.split(".").pop() || "ARQ").toUpperCase();
}

export function AttachmentTray({ files = [], previews = {}, onRemove, onClear }) {
  if (!files.length) return null;

  return (
    <div className="cmp-attachment-tray">
      <div className="cmp-attachment-tray__header">
        <strong className="cmp-attachment-tray__title">
          Anexos ({files.length})
        </strong>

        <button
          type="button"
          onClick={onClear}
          className="cmp-attachment-tray__clear"
        >
          Limpar
        </button>
      </div>

      <div className="cmp-attachment-tray__scroller">
        {files.map((file, idx) => {
          const url = previews[idx];
          const isImage = file.type?.startsWith("image/");
          const label = fileLabel(file);

          return (
            <article
              key={`${file.name}-${file.size}-${idx}`}
              className="cmp-attachment-tray__item"
              title={file.name}
            >
              <div className="cmp-attachment-tray__preview">
                {url && isImage ? (
                  <img
                    src={url}
                    alt={file.name}
                    className="cmp-attachment-tray__image"
                  />
                ) : (
                  <span className="cmp-attachment-tray__file-label">
                    {label}
                  </span>
                )}
              </div>

              <div className="cmp-attachment-tray__body">
                <div className="cmp-attachment-tray__name">{file.name}</div>

                <div className="cmp-attachment-tray__meta">
                  {formatBytes(file.size)}
                  {file.type ? ` • ${file.type}` : ""}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove?.(idx)}
                  className="cmp-attachment-tray__remove"
                >
                  Remover
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}