// src/pages/LoginPage.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

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
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: 360,
          padding: 20,
          border: "1px solid #eee",
          borderRadius: 10,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Entrar</h2>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          style={{ width: "100%", marginBottom: 12 }}
        />

        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{ width: "100%", marginBottom: 12 }}
        />

        {error && (
          <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>
        )}

        <button disabled={busy} style={{ width: "100%" }}>
          {busy ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
