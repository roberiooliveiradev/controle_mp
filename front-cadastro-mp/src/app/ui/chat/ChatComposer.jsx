// src/app/ui/chat/ChatComposer.jsx

import { useRef, useState } from "react";

export function ChatComposer({ onSend, onAttach }) {
  const [text, setText] = useState("");
  const fileRef = useRef(null);

  function pickFiles() {
    fileRef.current?.click();
  }

  async function submit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    await onSend(trimmed);
    setText("");
  }

  return (
    <form
      onSubmit={submit}
      style={{
        borderTop: "1px solid #eee",
        padding: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Digite sua mensagem..."
        style={{ flex: 1, padding: 10 }}
      />

      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => onAttach?.(Array.from(e.target.files || []))}
      />

      <button type="button" onClick={pickFiles}>
        Anexar
      </button>

      <button type="submit">Enviar</button>
    </form>
  );
}
