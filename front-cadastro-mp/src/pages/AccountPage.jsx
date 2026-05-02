// src/pages/AccountPage.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import { updateUserApi } from "../app/api/usersApi";
import "./AccountPage.css";

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

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    setFullName(initial.full_name);
    setEmail(initial.email);
  }, [initial.full_name, initial.email]);

  function validatePassword(pwd) {
    if (pwd.length < 8) {
      return "A nova senha deve ter no mínimo 8 caracteres.";
    }

    return "";
  }

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

    if (password || password2) {
      const pwdError = validatePassword(password);

      if (pwdError) {
        setError(pwdError);
        return;
      }

      if (password !== password2) {
        setError("As senhas não conferem.");
        return;
      }
    }

    const fullNameToSend = fullName.trim();
    const emailToSend = email.trim();

    if (!fullNameToSend) {
      setError("Nome é obrigatório.");
      return;
    }

    if (!emailToSend) {
      setError("Email é obrigatório.");
      return;
    }

    setBusy(true);

    try {
      const payload = {
        user_id: activeUserId,
        current_password: cp,
        full_name: fullNameToSend,
        email: emailToSend,
      };

      if (password.trim()) {
        payload.password = password;
      }

      const updated = await updateUserApi(payload);
      updateActiveUserProfile(updated);

      setPassword("");
      setPassword2("");
      setCurrentPassword("");
      setOk("Dados atualizados com sucesso.");
    } catch (err) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Falha ao atualizar usuário.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cmp-account-page">
      <header className="cmp-account-page__header">
        <div>
          <h2 className="cmp-account-page__title">Minha conta</h2>
          <p className="cmp-account-page__subtitle">
            Atualize seus dados de acesso ao Controle MP.
          </p>
        </div>
      </header>

      <form onSubmit={onSave} className="cmp-account-page__card">
        <div className="cmp-account-page__field">
          <label>Nome</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            disabled={busy}
          />
        </div>

        <div className="cmp-account-page__field">
          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            disabled={busy}
          />
        </div>

        <hr className="cmp-account-page__divider" />

        <div className="cmp-account-page__field">
          <label>Senha atual (obrigatória para salvar)</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Digite sua senha atual"
            disabled={busy}
          />
        </div>

        <div className="cmp-account-page__field">
          <label>Nova senha (opcional)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Deixe em branco para não alterar"
            disabled={busy}
          />
        </div>

        <div className="cmp-account-page__field">
          <label>Repetir nova senha</label>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
        </div>

        {error ? <div className="cmp-account-page__alert cmp-account-page__alert--error">{error}</div> : null}
        {ok ? <div className="cmp-account-page__alert cmp-account-page__alert--success">{ok}</div> : null}

        <div className="cmp-account-page__actions">
          <button
            type="button"
            onClick={() => nav(-1)}
            disabled={busy}
            className="cmp-account-page__button cmp-account-page__button--secondary"
          >
            Voltar
          </button>

          <button
            type="submit"
            disabled={busy}
            className="cmp-account-page__button cmp-account-page__button--primary"
          >
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </section>
  );
}