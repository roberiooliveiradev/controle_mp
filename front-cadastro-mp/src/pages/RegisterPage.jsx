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
  const isPasswordValid = password.length >= 8;
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection:"column", justifyContent:"center", alignItems:"center" }}>
      <div>
        <img src="/logoTransformaMaisDelpi.svg" alt="Transforma mais DELPI" style={{maxHeight:"140px"}} />
      </div>
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
        {password && password.length < 8 && (
          <div style={{ color: "var(--danger)", fontSize: 12 }}>
            Mínimo de 8 caracteres.
          </div>
        )}

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

        <button disabled={busyCreate || !isPasswordValid}>
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
