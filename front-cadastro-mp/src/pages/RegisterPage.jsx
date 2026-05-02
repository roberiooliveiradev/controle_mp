// src/pages/RegisterPage.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import { createUserApi } from "../app/api/usersApi";
import "./AuthPages.css";

export default function RegisterPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busyCreate, setBusyCreate] = useState(false);
  const [error, setError] = useState("");

  function validatePassword(pwd) {
    if (pwd.length < 8) {
      return "A senha deve ter no mínimo 8 caracteres.";
    }
    return "";
  }

  async function onCreate(e) {
    e.preventDefault();
    setError("");

    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    if (password !== password2) {
      setError("As senhas não conferem.");
      return;
    }

    setBusyCreate(true);

    try {
      await createUserApi({
        full_name: fullName,
        email,
        password,
      });

      await login({ email, password });
      nav("/conversations");
    } catch (err) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Falha ao criar usuário.";
      setError(msg);
    } finally {
      setBusyCreate(false);
    }
  }

  const isPasswordValid = password.length >= 8;

  return (
    <main className="cmp-auth-page">
      <section className="cmp-auth-card" aria-labelledby="register-title">
        <div className="cmp-auth-card__brand">
          <img
            src={`${import.meta.env.BASE_URL}logoTransformaMaisDelpi.svg`}
            alt="Transforma Mais DELPI"
            className="cmp-auth-card__logo"
          />
        </div>

        <form onSubmit={onCreate} className="cmp-auth-card__form">
          <div className="cmp-auth-card__heading">
            <h1 id="register-title" className="cmp-auth-card__title">
              Criar conta
            </h1>
            <p className="cmp-auth-card__subtitle">
              Cadastre-se para acessar o Controle MP.
            </p>
          </div>

          <label className="cmp-auth-card__field">
            <span>Nome</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              disabled={busyCreate}
            />
          </label>

          <label className="cmp-auth-card__field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              disabled={busyCreate}
            />
          </label>

          <label className="cmp-auth-card__field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={busyCreate}
            />
          </label>

          {password && password.length < 8 ? (
            <div className="cmp-auth-card__hint cmp-auth-card__hint--danger">
              Mínimo de 8 caracteres.
            </div>
          ) : null}

          <label className="cmp-auth-card__field">
            <span>Repetir senha</span>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              disabled={busyCreate}
            />
          </label>

          {error ? <div className="cmp-auth-card__error">{error}</div> : null}

          <div className="cmp-auth-card__actions">
            <button
              type="submit"
              disabled={busyCreate || !isPasswordValid}
              className="cmp-auth-card__button cmp-auth-card__button--primary"
            >
              {busyCreate ? "Criando..." : "Criar"}
            </button>

            <button
              type="button"
              onClick={() => nav("/login")}
              disabled={busyCreate}
              className="cmp-auth-card__button cmp-auth-card__button--secondary"
            >
              Voltar para login
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}