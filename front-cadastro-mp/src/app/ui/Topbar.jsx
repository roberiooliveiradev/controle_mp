// src/app/ui/Topbar.jsx

import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";

function roleLabel(roleId) {
  if (roleId === 1) return "ADMIN";
  if (roleId === 2) return "ANALYST";
  return "USER";
}

export function Topbar() {
  const { user, logout, activeUserId, setActiveUserId, listProfiles } = useAuth();

  const profiles = useMemo(() => listProfiles(), [listProfiles]);

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <strong>Controle MP</strong>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {profiles.length > 1 && (
          <select
            value={activeUserId ?? ""}
            onChange={(e) => setActiveUserId(Number(e.target.value))}
            style={{ padding: 6 }}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email} ({roleLabel(p.role_id)})
              </option>
            ))}
          </select>
        )}

        <span style={{ opacity: 0.8 }}>
          {user?.full_name ?? user?.email}{" "}
          {user?.role_id ? `(${roleLabel(user.role_id)})` : ""}
        </span>

        <button onClick={logout}>Sair</button>
      </div>
    </header>
  );
}
