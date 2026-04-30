// src/app/ui/Topbar.jsx

import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useRealtime } from "../realtime/RealtimeContext";
import { toastSuccess, toastWarning, toastError } from "../ui/toast";
import "./Topbar.css";

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

    if (res?.ok) {
      toastSuccess("Notificações do navegador ativadas.");
    } else if (res?.reason === "denied") {
      toastError("Permissão de notificações negada no navegador.");
    } else {
      toastWarning("Não foi possível ativar as notificações agora.");
    }
  }

  return (
    <button type="button" onClick={onEnable} className="cmp-topbar__notification-button">
      Ativar notificações
    </button>
  );
}

export function Topbar() {
  const {
    user,
    logout,
    activeUserId,
    setActiveUserId,
    listProfiles,
    isSsoSession,
  } = useAuth();

  const location = useLocation();
  const { totalUnreadMessages, createdRequestsCount } = useRealtime();

  const profiles = useMemo(() => listProfiles(), [listProfiles]);

  const isActive = (path) => location.pathname.startsWith(path);
  const linkClass = (path) =>
    isActive(path) ? "cmp-topbar__link cmp-topbar__link--active" : "cmp-topbar__link";

  const isAdmin = Number(user?.role_id) === 1;

  return (
    <header className="cmp-topbar">
      <div className="cmp-topbar__brand">
        <img
          src={`${import.meta.env.BASE_URL}logoTransformaMaisDelpi.svg`}
          alt="Transforma Mais DELPI"
          className="cmp-topbar__logo"
        />
      </div>

      <nav className="cmp-topbar__nav" aria-label="Navegação principal">
        <Link to="/conversations" className={linkClass("/conversations")}>
          <span>Conversas</span>
          {totalUnreadMessages > 0 && (
            <span className="cmp-topbar__badge">{totalUnreadMessages}</span>
          )}
        </Link>

        <Link to="/requests" className={linkClass("/requests")}>
          <span>Solicitações</span>
          {createdRequestsCount > 0 && (
            <span className="cmp-topbar__badge">{createdRequestsCount}</span>
          )}
        </Link>

        <Link to="/products" className={linkClass("/products")}>
          Produtos
        </Link>

        {isAdmin && (
          <Link to="/audit" className={linkClass("/audit")}>
            Auditoria
          </Link>
        )}

        {isAdmin && (
          <Link to="/admin/users" className={linkClass("/admin/users")}>
            Admin · Usuários
          </Link>
        )}
      </nav>

      <div className="cmp-topbar__user-area">
        {profiles.length > 1 && (
          <select
            value={activeUserId ?? ""}
            onChange={(e) => setActiveUserId(Number(e.target.value))}
            className="cmp-topbar__profile-select"
            title="Perfil ativo"
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
          <span className="cmp-topbar__user-name">
            {user?.full_name ?? user?.email}
          </span>
          {user?.role_id ? (
            <span className="cmp-topbar__role">({roleLabel(user.role_id)})</span>
          ) : null}
        </Link>

        {!isSsoSession && (
          <button type="button" onClick={() => logout()} className="cmp-topbar__logout">
            Sair
          </button>
        )}
      </div>
    </header>
  );
}