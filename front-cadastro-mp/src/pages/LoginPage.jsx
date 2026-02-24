// src/pages/LoginPage.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";

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
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection:"column", justifyContent:"center", alignItems:"center" }}>
      <div>
        <img src={`${import.meta.env.BASE_URL}logoTransformaMaisDelpi.svg`} alt="Transforma mais DELPI" style={{maxHeight:"140px"}} />
      </div>
      <form
        onSubmit={onLogin}
        style={{
          width: 360,
          padding: 20,
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Entrar</h2>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />

        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && (
          <div style={{ color: "var(--danger)", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button disabled={busyLogin}>
          {busyLogin ? "Entrando..." : "Entrar"}
        </button>
        <button
          type="button"
          onClick={() => nav("/register")}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
          }}
        >
          Criar conta
        </button>
      </form>
    </div>
  );
}
