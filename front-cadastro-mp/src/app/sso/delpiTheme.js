/**
 * Aplica tema recebido do portal Minha DELPI (DELPI_THEME).
 */

export function applyDelpiTheme(payload) {
  const root = document.documentElement;
  const theme = payload?.theme;
  const resolved = payload?.resolved === "dark" ? "dark" : "light";

  if (theme !== "light" && theme !== "dark" && theme !== "system") {
    return;
  }

  root.dataset.delpiThemeSynced = "true";
  root.dataset.themeMode = theme;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
}

export function clearDelpiThemeSync() {
  const root = document.documentElement;
  delete root.dataset.delpiThemeSynced;
  delete root.dataset.themeMode;
  root.removeAttribute("data-theme");
  root.style.colorScheme = "";
}
