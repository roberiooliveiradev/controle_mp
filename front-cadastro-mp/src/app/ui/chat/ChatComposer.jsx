// src/app/ui/chat/ChatComposer.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AttachmentTray } from "./AttachmentTray";
import { RequestComposerModal } from "./RequestComposerModal";
import "./ChatComposer.css";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

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
  const type = (file?.type || "").trim();
  if (type) return type;

  const ext = getExt(file?.name);
  return EXT_TO_MIME[ext] || "";
}

function formatAllowedList() {
  return Object.keys(EXT_TO_MIME)
    .map((ext) => `.${ext}`)
    .sort()
    .join(", ");
}

function validateFiles(files) {
  const accepted = [];
  const rejected = [];

  for (const file of files || []) {
    if (!file) continue;

    const size = Number(file.size) || 0;

    if (size > MAX_FILE_BYTES) {
      rejected.push({
        file,
        reason: `Arquivo muito grande (máx ${MAX_FILE_SIZE_MB}MB).`,
      });
      continue;
    }

    const mime = guessMimeFromFile(file);

    if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
      rejected.push({
        file,
        reason: `Tipo não permitido (${mime || "desconhecido"}). Permitidos: ${formatAllowedList()}`,
      });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}

export function ChatComposer({
  onSend,
  onAttach,
  incomingFiles,
  onIncomingFilesHandled,
}) {
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [sending, setSending] = useState(false);

  const fileRef = useRef(null);
  const actionsBtnRef = useRef(null);
  const actionsMenuRef = useRef(null);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const previews = useMemo(() => {
    const map = {};

    pendingFiles.forEach((file, idx) => {
      if (file?.type?.startsWith("image/")) {
        map[idx] = URL.createObjectURL(file);
      }
    });

    return map;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  useEffect(() => {
    if (!incomingFiles || incomingFiles.length === 0) return;

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
    if (sending) return;

    try {
      setSending(true);
      await onSend({
        text,
        files: pendingFiles,
        createRequest: false,
        requestItems: null,
      });

      setText("");
      setPendingFiles([]);
      setFileError("");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  }

  async function onSubmitRequestDraft(draft) {
    if (sending) return;

    try {
      setSending(true);

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
    } finally {
      setSending(false);
    }
  }

  const canSend = Boolean(text.trim()) || pendingFiles.length > 0;

  return (
    <div className="cmp-chat-composer">
      <AttachmentTray
        files={pendingFiles}
        previews={previews}
        onRemove={removeFileAt}
        onClear={clearFiles}
      />

      <form onSubmit={submit} className="cmp-chat-composer__form">
        <div className="cmp-chat-composer__input-area">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Digite sua mensagem... (Shift+Enter para quebrar linha)"
            rows={4}
            className="cmp-chat-composer__textarea"
          />

          {fileError ? (
            <div className="cmp-chat-composer__error">{fileError}</div>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept={Object.keys(EXT_TO_MIME).map((ext) => `.${ext}`).join(",")}
          className="cmp-chat-composer__file-input"
          onChange={(e) => {
            const arr = Array.from(e.target.files || []);
            addFiles(arr);
            e.target.value = "";
          }}
        />

        <div className="cmp-chat-composer__actions">
          <button
            type="button"
            onClick={pickFiles}
            className="cmp-chat-composer__button"
          >
            Anexar
          </button>

          <div className="cmp-chat-composer__menu-wrap">
            <button
              ref={actionsBtnRef}
              type="button"
              onClick={() => setActionsOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              className="cmp-chat-composer__button"
            >
              Ações ▾
            </button>

            {actionsOpen ? (
              <div
                ref={actionsMenuRef}
                role="menu"
                className="cmp-chat-composer__menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setRequestModalOpen(true)}
                  className="cmp-chat-composer__menu-item"
                >
                  Abrir solicitação
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSend || sending}
            className="cmp-chat-composer__send"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>

      {requestModalOpen ? (
        <RequestComposerModal
          onClose={() => setRequestModalOpen(false)}
          onSubmit={onSubmitRequestDraft}
        />
      ) : null}
    </div>
  );
}