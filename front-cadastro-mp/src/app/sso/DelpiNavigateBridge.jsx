/**
 * Bridge genérico Minha DELPI → app embedded (postMessage DELPI_NAVIGATE).
 * Contrato: metadata.deepPath na notificação + listener no filho.
 * Ver delpi-central/docs/05-portal/embedded-app-deep-links.md
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ALLOWED_PARENT_ORIGINS = [
  import.meta.env.VITE_DELPI_PARENT_ORIGIN,
  "https://minhadelpi.com.br",
  "https://www.minhadelpi.com.br",
].filter(Boolean);

function isAllowedParentOrigin(origin) {
  return ALLOWED_PARENT_ORIGINS.includes(origin);
}

function normalizePath(path) {
  if (!path) return null;
  const value = String(path).trim();
  if (!value) return null;
  return value.startsWith("/") ? value : `/${value}`;
}

export function DelpiNavigateBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleNavigate(event) {
      if (!isAllowedParentOrigin(event.origin)) return;
      if (event.data?.type !== "DELPI_NAVIGATE") return;

      const path = normalizePath(event.data?.path);
      if (!path) return;

      navigate(path, { replace: true });
    }

    window.addEventListener("message", handleNavigate);
    return () => window.removeEventListener("message", handleNavigate);
  }, [navigate]);

  return null;
}
