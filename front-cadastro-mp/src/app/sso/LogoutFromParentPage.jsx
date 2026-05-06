import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";

export function LogoutFromParentPage() {
  const { logout } = useAuth();

  useEffect(() => {
    let mounted = true;

    logout({ silent: true, clearAll: true }).finally(() => {
      if (!mounted) return;

      try {
        window.parent?.postMessage(
          {
            type: "DELPI_CHILD_LOGOUT_DONE",
            app: "controle-mp",
          },
          "*"
        );
      } catch {
        // Logout front-channel não deve quebrar o logout principal.
      }
    });

    return () => {
      mounted = false;
    };
  }, [logout]);

  return null;
}