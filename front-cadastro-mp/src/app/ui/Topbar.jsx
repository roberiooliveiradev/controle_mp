// src/app/ui/Topbar.jsx

import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

import { useRealtime } from "../realtime/RealtimeContext";
import { toastSuccess, toastWarning, toastError } from "../ui/toast";

function roleLabel(roleId) {
  if (roleId === 1) return "ADMIN";
  if (roleId === 2) return "ANALYST";
  return "USER";
}

export function EnableNotificationsButton() {
  const rt = useRealtime();

  async function onEnable() {
    if (!rt.isSecureForNotifications?.()) {
      toastWarning("No Chrome, notificações precisam de HTTPS (ou localhost).");
      return;
    }

    const res = await rt.requestBrowserNotificationsPermission?.();
    if (res?.ok) toastSuccess("Notificações do navegador ativadas.");
    else if (res?.reason === "denied") toastError("Permissão de notificações negada no navegador.");
    else toastWarning("Não foi possível ativar as notificações agora.");
  }

  return (
    <button type="button" onClick={onEnable} style={{ padding: "8px 10px", borderRadius: 10 }}>
      Ativar notificações
    </button>
  );
}

export function Topbar() {
  const { user, logout, activeUserId, setActiveUserId, listProfiles } = useAuth();
  const location = useLocation();

  const profiles = useMemo(() => listProfiles(), [listProfiles]);

  const isActive = (path) => location.pathname.startsWith(path);
  const linkClass = (path) => (isActive(path) ? "select" : "");

  const isAdmin = user?.role_id === 1;

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border, #eee)",
        padding: "12px 0px",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        gap: 12,
        flexShrink: 0
      }}
    >
      <div>
        <img src="/logoTransformaMaisDelpi.svg" alt="Transforma mais DELPI" style={{maxHeight:"80px"}} />
      </div>
      <nav
        style={{
          display: "flex",
          gap: 20,
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <Link to="/conversations" className={linkClass("/conversations")}>
          Conversas
        </Link>

        <Link to="/requests" className={linkClass("/requests")}>
          Solicitações
        </Link>

        <Link to="/products" className={linkClass("/products")}>
          Produtos
        </Link>

        {isAdmin && (
          <Link to="/admin/users" className={linkClass("/admin/users")}>
            Admin · Usuários
          </Link>
        )}
      </nav>

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

        <Link
          to="/account"
          className={linkClass("/account")}
          title="Editar meus dados"
        >
          {user?.full_name ?? user?.email}
          {user?.role_id ? ` (${roleLabel(user.role_id)})` : ""}
        </Link>

        <button onClick={logout} id="btn-logout">Sair</button>
      </div>
    </header>
  );
}
