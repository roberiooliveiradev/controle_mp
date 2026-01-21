// src/pages/RegisterPage.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import { createUserApi } from "../app/api/usersApi";

export default function RegisterPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busyCreate, setBusyCreate] = useState(false);
  const [error, setError] = useState("");

  async function onCreate(e) {
    e.preventDefault();
    setError("");

    if (password !== password2) {
      setError("As senhas não conferem.");
      return;
    }

    setBusyCreate(true);
    try {
      // ✅ cria usuário na API correta (/api/users via httpClient)
      await createUserApi({
        full_name: fullName,
        email,
        password,
      });

      // ✅ login automático (já usa axios/httpClient por dentro)
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

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={onCreate}
        style={{
          width: 360,
          padding: 20,
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Criar conta</h2>

        <label>Nome</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <label>Repetir Senha</label>
        <input
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          autoComplete="new-password"
        />

        {error && (
          <div style={{ color: "var(--danger)", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button disabled={busyCreate}>
          {busyCreate ? "Criando..." : "Criar"}
        </button>

        <button
          type="button"
          onClick={() => nav("/login")}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
          }}
        >
          Voltar para login
        </button>
      </form>
    </div>
  );
}
