// src/pages/AccountPage.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import { updateUserApi } from "../app/api/usersApi";

export default function AccountPage() {
  const nav = useNavigate();
  const { user, activeUserId, updateActiveUserProfile } = useAuth();

  const initial = useMemo(() => {
    return {
      full_name: user?.full_name ?? "",
      email: user?.email ?? "",
    };
  }, [user?.full_name, user?.email]);

  const [fullName, setFullName] = useState(initial.full_name);
  const [email, setEmail] = useState(initial.email);

  const [currentPassword, setCurrentPassword] = useState(""); // ✅ novo obrigatório
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    setFullName(initial.full_name);
    setEmail(initial.email);
  }, [initial.full_name, initial.email]);

  async function onSave(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!activeUserId) {
      setError("Usuário não autenticado.");
      return;
    }

    const cp = currentPassword.trim();
    if (!cp) {
      setError("Informe a senha atual para salvar alterações.");
      return;
    }

    if ((password || password2) && password !== password2) {
      setError("As senhas não conferem.");
      return;
    }

    const full_name_to_send = fullName.trim();
    const email_to_send = email.trim();

    if (!full_name_to_send) {
      setError("Nome é obrigatório.");
      return;
    }
    if (!email_to_send) {
      setError("Email é obrigatório.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        user_id: activeUserId,
        current_password: cp, // ✅ obrigatório
        full_name: full_name_to_send,
        email: email_to_send,
      };

      // só envia senha se foi preenchida
      if (password.trim()) payload.password = password;

      const updated = await updateUserApi(payload);
      updateActiveUserProfile(updated);

      setPassword("");
      setPassword2("");
      setCurrentPassword(""); // limpa por segurança
      setOk("Dados atualizados com sucesso.");
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Falha ao atualizar usuário.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 520 }}>
      <h2 style={{ marginTop: 0 }}>Minha conta</h2>

      <form
        onSubmit={onSave}
        style={{
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label>Nome</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>

        <hr style={{ width: "100%", border: 0, borderTop: "1px solid var(--border)" }} />

        {/* ✅ obrigatório */}
        <div style={{ display: "grid", gap: 6 }}>
          <label>Senha atual (obrigatória para salvar)</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Digite sua senha atual"
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Nova senha (opcional)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Deixe em branco para não alterar"
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Repetir nova senha</label>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        {ok && <div style={{ color: "var(--success)" }}>{ok}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => nav(-1)}
            style={{ background: "transparent", border: "1px solid var(--border)" }}
            disabled={busy}
          >
            Voltar
          </button>

          <button disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}
