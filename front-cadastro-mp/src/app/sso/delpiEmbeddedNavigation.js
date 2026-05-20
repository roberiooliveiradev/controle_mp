/** Rota interna pendente (notificação DELPI_NAVIGATE antes/depois do SSO). */
export const CHILD_PENDING_NAV_KEY = "delpi.child.pending_navigate";

export function stashChildPendingNavigate(path) {
  if (!path) return;
  sessionStorage.setItem(CHILD_PENDING_NAV_KEY, path);
}

export function peekChildPendingNavigate() {
  return sessionStorage.getItem(CHILD_PENDING_NAV_KEY);
}

export function consumeChildPendingNavigate() {
  const value = peekChildPendingNavigate();
  if (!value) return null;
  sessionStorage.removeItem(CHILD_PENDING_NAV_KEY);
  return value;
}

export function isAuthEntryPath(pathname) {
  const path = String(pathname || "");
  return path === "/" || path === "/login" || path.startsWith("/login/");
}

export function isEmbeddedInPortal() {
  if (typeof window === "undefined") return false;
  try {
    return window.parent !== window;
  } catch {
    return false;
  }
}

/**
 * Rota interna após SSO bem-sucedido (login ou raiz).
 * Respeita deep link pendente (DELPI_NAVIGATE); senão vai para /conversations.
 */
export function resolveRouteAfterAuth(pathname) {
  const pending = consumeChildPendingNavigate();
  if (pending) return pending;

  if (!isAuthEntryPath(pathname)) {
    return null;
  }

  return "/conversations";
}

/**
 * Navega para a rota pós-auth ou agenda deep link tardio do portal.
 * @returns {boolean} true se disparou navegação (ou agendamento)
 */
export function navigateAfterAuth(navigate, pathname) {
  const next = resolveRouteAfterAuth(pathname);
  if (next) {
    navigate(next, { replace: true });
    return true;
  }

  if (!isEmbeddedInPortal() || !peekChildPendingNavigate()) {
    return false;
  }

  window.setTimeout(() => {
    const late = consumeChildPendingNavigate();
    if (late) {
      navigate(late, { replace: true });
    }
  }, 500);

  return true;
}
