import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const DEFAULT_PARENT_ORIGIN = "https://minhadelpi.com.br";

function getAllowedOrigin() {
  return import.meta.env.VITE_DELPI_PARENT_ORIGIN || DEFAULT_PARENT_ORIGIN;
}

export function DelpiSsoBridge() {
  const navigate = useNavigate();
  const { isAuthenticated, ssoLogin } = useAuth();
  const handledTokenRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) return;

    function requestToken() {
      if (!window.parent || window.parent === window) return;

      window.parent.postMessage(
        { type: "DELPI_AUTH_READY" },
        getAllowedOrigin()
      );
    }

    function handleMessage(event) {
      const allowedOrigin = getAllowedOrigin();

      if (event.origin !== allowedOrigin) return;
      if (event.data?.type !== "DELPI_AUTH") return;

      const centralAccessToken = event.data?.token;
      if (!centralAccessToken) return;

      if (handledTokenRef.current === centralAccessToken) return;
      handledTokenRef.current = centralAccessToken;

      ssoLogin({ centralAccessToken })
        .then(() => {
          navigate("/conversations", { replace: true });
        })
        .catch(() => {
          handledTokenRef.current = null;

          window.parent?.postMessage(
            { type: "DELPI_REFRESH_REQUEST" },
            allowedOrigin
          );
        });
    }

    window.addEventListener("message", handleMessage);

    requestToken();

    const retry = window.setTimeout(requestToken, 800);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(retry);
    };
  }, [isAuthenticated, ssoLogin, navigate]);

  return null;
}