/**
 * Sincroniza a rota interna com a barra de URL do portal (postMessage DELPI_EMBEDDED_ROUTE).
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getDelpiParentPostMessageTarget } from "./delpiParentOrigins";

function isEmbeddedInPortal() {
  try {
    return window.parent !== window;
  } catch {
    return false;
  }
}

function normalizePath(pathname) {
  const value = String(pathname || "").trim();
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

export function DelpiRouteSyncBridge() {
  const location = useLocation();

  useEffect(() => {
    if (!isEmbeddedInPortal()) return;

    const path = normalizePath(location.pathname);

    window.parent.postMessage(
      { type: "DELPI_EMBEDDED_ROUTE", path },
      getDelpiParentPostMessageTarget()
    );
  }, [location.pathname, location.search, location.hash]);

  return null;
}
