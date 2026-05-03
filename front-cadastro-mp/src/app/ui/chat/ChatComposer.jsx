// src/app/ui/chat/ChatComposer.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";

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

function resizeTextarea(textarea) {
  if (!textarea) return;

  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
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
  const textareaRef = useRef(null);
  const actionsBtnRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const emojiMenuRef = useRef(null);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
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
    resizeTextarea(textareaRef.current);
  }, [text]);

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
      const target = e.target;

      if (actionsOpen) {
        const btn = actionsBtnRef.current;
        const menu = actionsMenuRef.current;

        if (!(btn && btn.contains(target)) && !(menu && menu.contains(target))) {
          setActionsOpen(false);
        }
      }

      if (emojiOpen) {
        const btn = emojiBtnRef.current;
        const menu = emojiMenuRef.current;

        if (!(btn && btn.contains(target)) && !(menu && menu.contains(target))) {
          setEmojiOpen(false);
        }
      }
    }

    function onEsc(e) {
      if (e.key === "Escape") {
        setActionsOpen(false);
        setEmojiOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [actionsOpen, emojiOpen]);

  function pickFiles() {
    if (sending) return;

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
    if (sending) return;
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearFiles() {
    if (sending) return;
    setPendingFiles([]);
  }

  function insertEmoji(emoji) {
    if (sending || !emoji) return;

    const textarea = textareaRef.current;
    const current = text || "";

    if (!textarea) {
      setText(`${current}${emoji}`);
      return;
    }

    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;

    setText(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + emoji.length;
      textarea.setSelectionRange(pos, pos);
      resizeTextarea(textarea);
    });
  }

  async function submit(e) {
    e?.preventDefault?.();

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
      setActionsOpen(false);
      setEmojiOpen(false);

      requestAnimationFrame(() => {
        resizeTextarea(textareaRef.current);
        textareaRef.current?.focus();
      });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.nativeEvent?.isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  }

  function openRequestModal() {
    if (sending) return;

    setActionsOpen(false);
    setEmojiOpen(false);
    setRequestModalOpen(true);
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
      setEmojiOpen(false);
      setText("");
      setPendingFiles([]);
      setFileError("");

      requestAnimationFrame(() => {
        resizeTextarea(textareaRef.current);
        textareaRef.current?.focus();
      });
    } finally {
      setSending(false);
    }
  }

  const hasText = Boolean(text.trim());
  const hasFiles = pendingFiles.length > 0;
  const canSend = hasText || hasFiles;
  const fileCount = pendingFiles.length;
  const textLength = text.length;

  return (
    <div className="cmp-chat-composer">
      <AttachmentTray
        files={pendingFiles}
        previews={previews}
        onRemove={removeFileAt}
        onClear={clearFiles}
      />

      <form
        onSubmit={submit}
        className={
          sending
            ? "cmp-chat-composer__form cmp-chat-composer__form--sending"
            : "cmp-chat-composer__form"
        }
      >
        <div className="cmp-chat-composer__input-area">
          <div className="cmp-chat-composer__textarea-shell">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Digite sua mensagem..."
              rows={2}
              disabled={sending}
              className="cmp-chat-composer__textarea"
            />

            <div className="cmp-chat-composer__hint-row">
              <span>Enter envia · Shift+Enter quebra linha</span>

              {textLength > 0 ? (
                <span className="cmp-chat-composer__counter">
                  {textLength}
                </span>
              ) : null}
            </div>
          </div>

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
            disabled={sending}
            className="cmp-chat-composer__button cmp-chat-composer__button--attach"
            title="Anexar arquivos"
          >
            <span className="cmp-chat-composer__button-icon" aria-hidden="true">
              📎
            </span>

            <span>Anexar</span>

            {fileCount > 0 ? (
              <span className="cmp-chat-composer__button-count">{fileCount}</span>
            ) : null}
          </button>

          <div className="cmp-chat-composer__menu-wrap">
            <button
              ref={emojiBtnRef}
              type="button"
              onClick={() => {
                setEmojiOpen((value) => !value);
                setActionsOpen(false);
              }}
              disabled={sending}
              aria-haspopup="dialog"
              aria-expanded={emojiOpen}
              className={
                emojiOpen
                  ? "cmp-chat-composer__button cmp-chat-composer__button--emoji cmp-chat-composer__button--active"
                  : "cmp-chat-composer__button cmp-chat-composer__button--emoji"
              }
              title="Inserir emoji"
            >
              <span className="cmp-chat-composer__button-icon" aria-hidden="true">
                🙂
              </span>

              <span>Emoji</span>
            </button>

            {emojiOpen ? (
              <div
                ref={emojiMenuRef}
                role="dialog"
                aria-label="Selecionar emoji"
                className="cmp-chat-composer__emoji-menu"
              >
                <EmojiPicker
                  theme={Theme.AUTO}
                  emojiStyle={EmojiStyle.NATIVE}
                  searchPlaceholder="Buscar emoji"
                  previewConfig={{ showPreview: false }}
                  lazyLoadEmojis
                  width="100%"
                  height={360}
                  onEmojiClick={(emojiData) => {
                    insertEmoji(emojiData?.emoji);
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="cmp-chat-composer__menu-wrap">
            <button
              ref={actionsBtnRef}
              type="button"
              onClick={() => {
                setActionsOpen((value) => !value);
                setEmojiOpen(false);
              }}
              disabled={sending}
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              className={
                actionsOpen
                  ? "cmp-chat-composer__button cmp-chat-composer__button--actions cmp-chat-composer__button--active"
                  : "cmp-chat-composer__button cmp-chat-composer__button--actions"
              }
            >
              <span className="cmp-chat-composer__button-icon" aria-hidden="true">
                ⚙
              </span>

              <span>Ações</span>

              <span className="cmp-chat-composer__chevron" aria-hidden="true">
                ▾
              </span>
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
                  onClick={openRequestModal}
                  className="cmp-chat-composer__menu-item"
                >
                  <span className="cmp-chat-composer__menu-item-icon" aria-hidden="true">
                    🧾
                  </span>

                  <span>
                    <strong>Abrir solicitação</strong>
                    <small>Cria uma solicitação vinculada a esta conversa.</small>
                  </span>
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