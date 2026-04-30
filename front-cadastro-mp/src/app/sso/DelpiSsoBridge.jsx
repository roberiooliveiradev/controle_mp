import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const ALLOWED_PARENT_ORIGINS = [
  import.meta.env.VITE_DELPI_PARENT_ORIGIN,
  "https://minhadelpi.com.br",
  "https://www.minhadelpi.com.br",
].filter(Boolean);

function getDefaultParentOrigin() {
  return import.meta.env.VITE_DELPI_PARENT_ORIGIN || "https://minhadelpi.com.br";
}

function isAllowedParentOrigin(origin) {
  return ALLOWED_PARENT_ORIGINS.includes(origin);
}

export function DelpiSsoBridge() {
  const navigate = useNavigate();
  const { isAuthenticated, ssoLogin, logout } = useAuth();

  const handledTokenRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    function requestToken() {
      if (!window.parent || window.parent === window) return;

      window.parent.postMessage(
        { type: "DELPI_AUTH_READY" },
        getDefaultParentOrigin()
      );
    }

    function handleMessage(event) {
      if (!isAllowedParentOrigin(event.origin)) return;

      if (event.data?.type === "DELPI_LOGOUT") {
        handledTokenRef.current = null;

        logout({ silent: true, clearAll: true }).finally(() => {
          if (!mountedRef.current) return;
          navigate("/login", { replace: true });
        });

        return;
      }

      if (event.data?.type !== "DELPI_AUTH") return;

      const centralAccessToken = event.data?.token;
      if (!centralAccessToken) return;

      if (handledTokenRef.current === centralAccessToken) return;
      handledTokenRef.current = centralAccessToken;

      if (isAuthenticated) return;

      ssoLogin({ centralAccessToken })
        .then(() => {
          if (!mountedRef.current) return;
          navigate("/conversations", { replace: true });
        })
        .catch((error) => {
          console.error("Falha no SSO Minha DELPI:", error);

          // Não solicitar refresh em loop para erros de audience, issuer, JWKS ou backend.
          // O AppHost reenviará novo token em reload/foco quando necessário.
          handledTokenRef.current = centralAccessToken;
        });
    }

    window.addEventListener("message", handleMessage);

    requestToken();
    const retry = window.setTimeout(requestToken, 800);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(retry);
    };
  }, [isAuthenticated, ssoLogin, logout, navigate]);

  return null;
}