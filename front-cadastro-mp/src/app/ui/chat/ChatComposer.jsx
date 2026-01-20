// src/app/ui/chat/ChatComposer.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AttachmentTray } from "./AttachmentTray";
import { RequestComposerModal } from "./RequestComposerModal";

export function ChatComposer({ onSend, onAttach, incomingFiles, onIncomingFilesHandled }) {
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]); // File[]
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
    setPendingFiles((prev) => [...prev, ...incomingFiles]);
    onAttach?.(incomingFiles);
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
    fileRef.current?.click();
  }

  function addFiles(files) {
    if (!files?.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
    onAttach?.(files);
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
  }

  return (
    <div style={{ borderTop: "1px solid var(--border-2)" }}>
      <AttachmentTray files={pendingFiles} previews={previews} onRemove={removeFileAt} onClear={clearFiles} />

      <form
        onSubmit={submit}
        style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-end", position: "relative" }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Digite sua mensagem... (Shift+Enter para quebrar linha)"
          rows={5}
          style={{ flex: 1, padding: 12, resize: "none", borderRadius: 10, border: "1px solid var(--border-2)", lineHeight: 1.4 }}
        />

        <input
          ref={fileRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => addFiles(Array.from(e.target.files || []))}
        />

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
                  textAlignLast:"center",
                  cursor: "pointer",
                }}
              >
                Abrir Solicitação
              </button>
            </div>
          ) : null}
        </div>

        <button type="submit">Enviar</button>
      </form>

      {/* Modal do carrinho */}
      {requestModalOpen ? (
        <RequestComposerModal onClose={() => setRequestModalOpen(false)} onSubmit={onSubmitRequestDraft} />
      ) : null}
    </div>
  );
}
