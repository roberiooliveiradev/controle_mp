// src/app/ui/chat/AttachmentTray.jsx
import "./AttachmentTray.css";

function formatBytes(n) {
  const value = Number(n);

  if (!Number.isFinite(value) || value <= 0) return "";

  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = value;

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }

  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getExtension(name) {
  const ext = String(name || "").split(".").pop();

  if (!ext || ext === name) return "ARQ";

  return ext.toUpperCase();
}

function getFileKind(file) {
  const type = String(file?.type || "").toLowerCase();
  const ext = getExtension(file?.name);

  if (type.startsWith("image/")) {
    return { label: "IMG", icon: "🖼️", name: "Imagem" };
  }

  if (type === "application/pdf" || ext === "PDF") {
    return { label: "PDF", icon: "📄", name: "PDF" };
  }

  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    ["XLS", "XLSX", "CSV"].includes(ext)
  ) {
    return { label: ext, icon: "📊", name: "Planilha" };
  }

  if (
    type.includes("word") ||
    ["DOC", "DOCX", "TXT"].includes(ext)
  ) {
    return { label: ext, icon: "📝", name: "Documento" };
  }

  if (
    type.includes("presentation") ||
    type.includes("powerpoint") ||
    ["PPT", "PPTX"].includes(ext)
  ) {
    return { label: ext, icon: "📽️", name: "Apresentação" };
  }

  return { label: ext, icon: "📎", name: "Arquivo" };
}

export function AttachmentTray({ files = [], previews = {}, onRemove, onClear }) {
  if (!files.length) return null;

  return (
    <section className="cmp-attachment-tray" aria-label="Anexos da mensagem">
      <div className="cmp-attachment-tray__header">
        <div className="cmp-attachment-tray__heading">
          <strong className="cmp-attachment-tray__title">
            Anexos
          </strong>

          <span className="cmp-attachment-tray__count">
            {files.length} arquivo{files.length === 1 ? "" : "s"}
          </span>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="cmp-attachment-tray__clear"
        >
          Limpar todos
        </button>
      </div>

      <div className="cmp-attachment-tray__scroller">
        {files.map((file, idx) => {
          const url = previews[idx];
          const isImage = file.type?.startsWith("image/");
          const kind = getFileKind(file);
          const size = formatBytes(file.size);

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
                  <div className="cmp-attachment-tray__file-icon">
                    <span className="cmp-attachment-tray__file-emoji" aria-hidden="true">
                      {kind.icon}
                    </span>

                    <span className="cmp-attachment-tray__file-label">
                      {kind.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="cmp-attachment-tray__body">
                <div className="cmp-attachment-tray__name">{file.name}</div>

                <div className="cmp-attachment-tray__meta">
                  <span>{kind.name}</span>
                  {size ? <span>{size}</span> : null}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove?.(idx)}
                  className="cmp-attachment-tray__remove"
                  aria-label={`Remover ${file.name}`}
                >
                  Remover
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}