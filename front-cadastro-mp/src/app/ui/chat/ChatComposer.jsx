// src/app/ui/chat/ChatComposer.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AttachmentTray } from "./AttachmentTray";
import { RequestComposerModal } from "./RequestComposerModal";

// ✅ mantenha alinhado com o backend (ALLOWED_MIME_TYPES)
const ALLOWED_MIME_TYPES = new Set([
  // PDFs
  "application/pdf",

  // Imagens
  "image/png",
  "image/jpeg",
  "image/jpg",

  // Texto
  "text/plain",
  "text/csv",

  // Excel
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx

  // Word
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx

  // PowerPoint
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
]);

// ✅ fallback por extensão (quando o browser não fornece type)
const EXT_TO_MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function getExt(name) {
  if (!name) return "";
  const parts = String(name).split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase().trim();
}

function guessMimeFromFile(file) {
  const t = (file?.type || "").trim();
  if (t) return t;
  const ext = getExt(file?.name);
  return EXT_TO_MIME[ext] || "";
}

function formatAllowedList() {
  // lista amigável para o usuário
  const exts = Object.keys(EXT_TO_MIME)
    .map((x) => `.${x}`)
    .sort();
  return exts.join(", ");
}

function validateFiles(files) {
  const accepted = [];
  const rejected = [];

  for (const f of files || []) {
    if (!f) continue;

    const size = Number(f.size) || 0;
    if (size > MAX_FILE_BYTES) {
      rejected.push({
        file: f,
        reason: `Arquivo muito grande (máx ${MAX_FILE_SIZE_MB}MB).`,
      });
      continue;
    }

    const mime = guessMimeFromFile(f);
    if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
      rejected.push({
        file: f,
        reason: `Tipo não permitido (${mime || "desconhecido"}). Permitidos: ${formatAllowedList()}`,
      });
      continue;
    }

    accepted.push(f);
  }

  return { accepted, rejected };
}

export function ChatComposer({ onSend, onAttach, incomingFiles, onIncomingFilesHandled }) {
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]); // File[]
  const [fileError, setFileError] = useState("");
  const fileRef = useRef(null);

  // actions dropdown
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsBtnRef = useRef(null);
  const actionsMenuRef = useRef(null);

  // request modal
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const previews = useMemo(() => {
    const map = {};
    pendingFiles.forEach((f, idx) => {
      if (f?.type?.startsWith("image/")) map[idx] = URL.createObjectURL(f);
    });
    return map;
  }, [pendingFiles]);

  useEffect(() => {
    return () => Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  useEffect(() => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    // ✅ valida incoming files (drag & drop)
    const { accepted, rejected } = validateFiles(incomingFiles);

    if (rejected.length) {
      const first = rejected[0];
      setFileError(`${first.file?.name || "Arquivo"}: ${first.reason}`);
    } else {
      setFileError("");
    }

    if (accepted.length) {
      setPendingFiles((prev) => [...prev, ...accepted]);
      onAttach?.(accepted);
    }

    onIncomingFilesHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingFiles?.length]);

  // fecha dropdown clicando fora
  useEffect(() => {
    function onDocClick(e) {
      if (!actionsOpen) return;

      const btn = actionsBtnRef.current;
      const menu = actionsMenuRef.current;

      if (btn && btn.contains(e.target)) return;
      if (menu && menu.contains(e.target)) return;

      setActionsOpen(false);
    }

    function onEsc(e) {
      if (e.key === "Escape") setActionsOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [actionsOpen]);

  function pickFiles() {
    setFileError("");
    fileRef.current?.click();
  }

  function addFiles(files) {
    if (!files?.length) return;

    const { accepted, rejected } = validateFiles(files);

    if (rejected.length) {
      const first = rejected[0];
      setFileError(`${first.file?.name || "Arquivo"}: ${first.reason}`);
    } else {
      setFileError("");
    }

    if (!accepted.length) return;

    setPendingFiles((prev) => [...prev, ...accepted]);
    onAttach?.(accepted);
  }

  function removeFileAt(index) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearFiles() {
    setPendingFiles([]);
  }

  async function submit(e) {
    e.preventDefault();
    const hasText = Boolean(text.trim());
    const hasFiles = pendingFiles.length > 0;
    if (!hasText && !hasFiles) return;

    await onSend({ text, files: pendingFiles, createRequest: false, requestItems: null });
    setText("");
    setPendingFiles([]);
    setFileError("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  }

  async function onSubmitRequestDraft(draft) {
    await onSend({
      text: null,
      files: pendingFiles,
      createRequest: true,
      requestItems: draft.requestItems,
    });

    setRequestModalOpen(false);
    setActionsOpen(false);
    setText("");
    setPendingFiles([]);
    setFileError("");
  }

  return (
    <div style={{ borderTop: "1px solid var(--border-2)" }}>
      <AttachmentTray files={pendingFiles} previews={previews} onRemove={removeFileAt} onClear={clearFiles} />

      <form
        onSubmit={submit}
        style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-end", position: "relative" }}
      >
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Digite sua mensagem... (Shift+Enter para quebrar linha)"
            rows={5}
            style={{
              width: "100%",
              padding: 12,
              resize: "none",
              borderRadius: 10,
              border: "1px solid var(--border-2)",
              lineHeight: 1.4,
            }}
          />

          {fileError ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(220, 20, 60, 0.35)",
                background: "rgba(220, 20, 60, 0.08)",
                color: "crimson",
                fontSize: 12,
              }}
            >
              {fileError}
            </div>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          // ✅ dica pro picker (não é segurança, mas ajuda muito)
          accept={Object.keys(EXT_TO_MIME).map((x) => `.${x}`).join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            const arr = Array.from(e.target.files || []);
            addFiles(arr);
            // permite selecionar o mesmo arquivo de novo
            e.target.value = "";
          }}
        />

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={pickFiles}>
            Anexar
          </button>

          {/* Botão Ações */}
          <div style={{ position: "relative" }}>
            <button
              ref={actionsBtnRef}
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
            >
              Ações ▾
            </button>

            {actionsOpen ? (
              <div
                ref={actionsMenuRef}
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: "calc(100% + 8px)",
                  width: 240,
                  background: "var(--suface)",
                  border: "1px solid var(--border-2)",
                  borderRadius: 12,
                  boxShadow: "0 12px 30px var(--shadow)",
                  padding: 6,
                  zIndex: 50,
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setRequestModalOpen(true)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 10px",
                    textAlignLast: "center",
                    cursor: "pointer",
                  }}
                >
                  Abrir Solicitação
                </button>
              </div>
            ) : null}
          </div>

          <button type="submit">Enviar</button>
        </div>
      </form>

      {/* Modal do carrinho */}
      {requestModalOpen ? (
        <RequestComposerModal onClose={() => setRequestModalOpen(false)} onSubmit={onSubmitRequestDraft} />
      ) : null}
    </div>
  );
}
