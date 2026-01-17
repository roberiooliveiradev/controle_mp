// src/app/ui/Topbar.jsx

import { useAuth } from "../auth/AuthContext";

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        borderBottom: "1px solid #eee",
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <strong>Cadastro MP</strong>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ opacity: 0.8 }}>{user?.full_name ?? user?.email}</span>
        <button onClick={logout}>Sair</button>
      </div>
    </header>
  );
}
