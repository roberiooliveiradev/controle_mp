/**
 * Bridge genérico Minha DELPI → app embedded (postMessage DELPI_NAVIGATE).
 * Contrato: metadata.deepPath na notificação + listener no filho.
 * Ver delpi-central/docs/05-portal/embedded-app-deep-links.md
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  shouldApplyDelpiNavigate,
  stashChildPendingNavigate,
} from "./delpiEmbeddedNavigation";
import { isAllowedDelpiParentOrigin } from "./delpiParentOrigins";

function normalizePath(path) {
  if (!path) return null;
  const value = String(path).trim();
  if (!value) return null;
  return value.startsWith("/") ? value : `/${value}`;
}

export function DelpiNavigateBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function handleNavigate(event) {
      if (!isAllowedDelpiParentOrigin(event.origin)) return;
      if (event.data?.type !== "DELPI_NAVIGATE") return;

      const path = normalizePath(event.data?.path);
      if (!path) return;
      if (!shouldApplyDelpiNavigate(path, location.pathname)) return;

      stashChildPendingNavigate(path);
      navigate(path, { replace: true });
    }

    window.addEventListener("message", handleNavigate);
    return () => window.removeEventListener("message", handleNavigate);
  }, [navigate, location.pathname]);

  return null;
}
