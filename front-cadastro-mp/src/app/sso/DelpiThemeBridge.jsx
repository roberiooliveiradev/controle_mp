/**
 * Sincroniza claro/escuro/sistema do portal Minha DELPI com o Controle MP no iframe.
 * Contrato: postMessage { type: "DELPI_THEME", theme, resolved } do AppHost.
 */
import { useEffect } from "react";
import { applyDelpiTheme, clearDelpiThemeSync } from "./delpiTheme";
import { isAllowedDelpiParentOrigin } from "./delpiParentOrigins";

export function DelpiThemeBridge() {
  useEffect(() => {
    function handleTheme(event) {
      if (!isAllowedDelpiParentOrigin(event.origin)) return;
      if (event.data?.type !== "DELPI_THEME") return;

      applyDelpiTheme(event.data);
    }

    function handleLogout(event) {
      if (!isAllowedDelpiParentOrigin(event.origin)) return;
      if (event.data?.type !== "DELPI_LOGOUT") return;

      clearDelpiThemeSync();
    }

    window.addEventListener("message", handleTheme);
    window.addEventListener("message", handleLogout);

    return () => {
      window.removeEventListener("message", handleTheme);
      window.removeEventListener("message", handleLogout);
    };
  }, []);

  return null;
}
