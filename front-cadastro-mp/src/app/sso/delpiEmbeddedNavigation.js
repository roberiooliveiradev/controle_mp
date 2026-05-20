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
function normalizeEmbeddedPath(path) {
  const value = String(path || "").trim();
  if (!value) return "/";
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

function isPathAncestor(ancestor, child) {
  const parent = normalizeEmbeddedPath(ancestor);
  const current = normalizeEmbeddedPath(child);
  if (parent === current) return false;
  if (parent === "/") return current !== "/";
  return current.startsWith(`${parent}/`);
}

/**
 * Evita que DELPI_NAVIGATE do portal volte para /conversations enquanto o usuário
 * já está em /conversations/:id (sendAuth / retentativas de SSO).
 */
export function shouldApplyDelpiNavigate(nextPath, currentPathname) {
  const next = normalizeEmbeddedPath(nextPath);
  const current = normalizeEmbeddedPath(currentPathname);
  if (!next || next === current) return false;
  if (isPathAncestor(next, current)) return false;
  return true;
}

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
