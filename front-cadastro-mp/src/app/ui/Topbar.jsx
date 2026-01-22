import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function roleLabel(roleId) {
  if (roleId === 1) return "ADMIN";
  if (roleId === 2) return "ANALYST";
  return "USER";
}

export function Topbar() {
  const { user, logout, activeUserId, setActiveUserId, listProfiles } = useAuth();
  const location = useLocation();

  const profiles = useMemo(() => listProfiles(), [listProfiles]);

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border, #eee)",
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <strong>Controle MP</strong>

      {/* Navegação principal */}
      <nav
        style={{
          display: "flex",
          gap: 20,
          alignItems: "center",
          justifyContent: "end",
          width: "75dvw",
        }}
      >
        <Link
          to="/conversations"
          style={{
            textDecoration: "none",
            fontWeight: isActive("/conversations") ? 700 : 500,
          }}
        >
          Conversas
        </Link>

        <Link
          to="/requests"
          style={{
            textDecoration: "none",
            fontWeight: isActive("/requests") ? 700 : 500,
          }}
        >
          Solicitações
        </Link>

        <Link
          to="/products"
          style={{
            textDecoration: "none",
            fontWeight: isActive("/products") ? 700 : 500,
          }}
        >
          Produtos
        </Link>

        {/* ✅ novo link */}

      </nav>

      {/* Área do usuário */}
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

        {/* ✅ nome do usuário como link para Minha Conta */}
        <Link
          to="/account"
          style={{
            textDecoration: "none",
            opacity: 0.85,
            fontWeight: isActive("/account") ? 700 : 500,
          }}
          title="Editar meus dados"
        >
          {user?.full_name ?? user?.email}
          {user?.role_id ? ` (${roleLabel(user.role_id)})` : ""}
        </Link>

        <button onClick={logout}>Sair</button>
      </div>
    </header>
  );
}
