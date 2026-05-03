// src/app/ui/Topbar.jsx

import { useEffect, useMemo, useState } from "react";
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
    <button
      type="button"
      onClick={onEnable}
      className="cmp-topbar__notification-button"
    >
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const profiles = useMemo(() => listProfiles(), [listProfiles]);

  const isActive = (path) => location.pathname.startsWith(path);
  const linkClass = (path) =>
    isActive(path)
      ? "cmp-topbar__link cmp-topbar__link--active"
      : "cmp-topbar__link";

  const mobileLinkClass = (path) =>
    isActive(path)
      ? "cmp-topbar__mobile-link cmp-topbar__mobile-link--active"
      : "cmp-topbar__mobile-link";

  const isAdmin = Number(user?.role_id) === 1;
  const currentUserName = user?.full_name ?? user?.email ?? "Usuário";
  const currentUserRole = user?.role_id ? roleLabel(user.role_id) : null;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  function renderDesktopLinks() {
    return (
      <>
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
      </>
    );
  }

  function renderMobileLinks() {
    return (
      <>
        <Link
          to="/conversations"
          className={mobileLinkClass("/conversations")}
          onClick={closeMobileMenu}
        >
          <span>Conversas</span>
          {totalUnreadMessages > 0 && (
            <span className="cmp-topbar__badge">{totalUnreadMessages}</span>
          )}
        </Link>

        <Link
          to="/requests"
          className={mobileLinkClass("/requests")}
          onClick={closeMobileMenu}
        >
          <span>Solicitações</span>
          {createdRequestsCount > 0 && (
            <span className="cmp-topbar__badge">{createdRequestsCount}</span>
          )}
        </Link>

        <Link
          to="/products"
          className={mobileLinkClass("/products")}
          onClick={closeMobileMenu}
        >
          Produtos
        </Link>

        {isAdmin && (
          <Link
            to="/audit"
            className={mobileLinkClass("/audit")}
            onClick={closeMobileMenu}
          >
            Auditoria
          </Link>
        )}

        {isAdmin && (
          <Link
            to="/admin/users"
            className={mobileLinkClass("/admin/users")}
            onClick={closeMobileMenu}
          >
            Admin · Usuários
          </Link>
        )}
      </>
    );
  }

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
        {renderDesktopLinks()}
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
          <span className="cmp-topbar__user-name">{currentUserName}</span>
          {currentUserRole ? (
            <span className="cmp-topbar__role">({currentUserRole})</span>
          ) : null}
        </Link>

        {!isSsoSession && (
          <button
            type="button"
            onClick={() => logout()}
            className="cmp-topbar__logout"
          >
            Sair
          </button>
        )}
      </div>

      <button
        type="button"
        className={
          isMobileMenuOpen
            ? "cmp-topbar__menu-button cmp-topbar__menu-button--active"
            : "cmp-topbar__menu-button"
        }
        aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isMobileMenuOpen}
        aria-controls="cmp-mobile-menu"
        onClick={() => setIsMobileMenuOpen((value) => !value)}
      >
        <span className="cmp-topbar__menu-line" />
        <span className="cmp-topbar__menu-line" />
        <span className="cmp-topbar__menu-line" />
      </button>

      {isMobileMenuOpen && (
        <>
          <button
            type="button"
            className="cmp-topbar__mobile-backdrop"
            aria-label="Fechar menu"
            onClick={closeMobileMenu}
          />

          <aside
            id="cmp-mobile-menu"
            className="cmp-topbar__mobile-panel"
            aria-label="Menu mobile"
          >
            <div className="cmp-topbar__mobile-panel-header">
              <img
                src={`${import.meta.env.BASE_URL}logoTransformaMaisDelpi.svg`}
                alt="Transforma Mais DELPI"
                className="cmp-topbar__mobile-logo"
              />

              <button
                type="button"
                className="cmp-topbar__mobile-close"
                aria-label="Fechar menu"
                onClick={closeMobileMenu}
              >
                ×
              </button>
            </div>

            <div className="cmp-topbar__mobile-user-card">
              <span className="cmp-topbar__mobile-user-label">
                Usuário ativo
              </span>

              <strong className="cmp-topbar__mobile-user-name">
                {currentUserName}
              </strong>

              {currentUserRole ? (
                <span className="cmp-topbar__mobile-user-role">
                  {currentUserRole}
                </span>
              ) : null}
            </div>

            {profiles.length > 1 && (
              <label className="cmp-topbar__mobile-profile">
                <span>Perfil</span>

                <select
                  value={activeUserId ?? ""}
                  onChange={(e) => setActiveUserId(Number(e.target.value))}
                  className="cmp-topbar__profile-select cmp-topbar__profile-select--mobile"
                  title="Perfil ativo"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name ?? p.email} ({roleLabel(p.role_id)})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <nav
              className="cmp-topbar__mobile-nav"
              aria-label="Navegação principal mobile"
            >
              {renderMobileLinks()}

              <Link
                to="/account"
                className={mobileLinkClass("/account")}
                onClick={closeMobileMenu}
              >
                Minha conta
              </Link>
            </nav>

            {!isSsoSession && (
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  logout();
                }}
                className="cmp-topbar__mobile-logout"
              >
                Sair
              </button>
            )}
          </aside>
        </>
      )}
    </header>
  );
}