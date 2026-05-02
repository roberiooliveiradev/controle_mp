// src/pages/LoginPage.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import "./AuthPages.css";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busyLogin, setBusyLogin] = useState(false);
  const [error, setError] = useState("");

  async function onLogin(e) {
    e.preventDefault();
    setError("");
    setBusyLogin(true);

    try {
      await login({ email, password });
      nav("/conversations");
    } catch (err) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Falha no login. Verifique suas credenciais.";
      setError(msg);
    } finally {
      setBusyLogin(false);
    }
  }

  return (
    <main className="cmp-auth-page">
      <section className="cmp-auth-card" aria-labelledby="login-title">
        <div className="cmp-auth-card__brand">
          <img
            src={`${import.meta.env.BASE_URL}logoTransformaMaisDelpi.svg`}
            alt="Transforma Mais DELPI"
            className="cmp-auth-card__logo"
          />
        </div>

        <form onSubmit={onLogin} className="cmp-auth-card__form">
          <div className="cmp-auth-card__heading">
            <h1 id="login-title" className="cmp-auth-card__title">
              Entrar
            </h1>
            <p className="cmp-auth-card__subtitle">
              Acesse o Controle MP com suas credenciais.
            </p>
          </div>

          <label className="cmp-auth-card__field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              disabled={busyLogin}
            />
          </label>

          <label className="cmp-auth-card__field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busyLogin}
            />
          </label>

          {error ? <div className="cmp-auth-card__error">{error}</div> : null}

          <div className="cmp-auth-card__actions">
            <button
              type="submit"
              disabled={busyLogin}
              className="cmp-auth-card__button cmp-auth-card__button--primary"
            >
              {busyLogin ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => nav("/register")}
              disabled={busyLogin}
              className="cmp-auth-card__button cmp-auth-card__button--secondary"
            >
              Criar conta
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}