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
