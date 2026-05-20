import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { decodeJwt } from "../auth/jwt";
import { navigateAfterAuth } from "./delpiEmbeddedNavigation";

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

function normalizeEmail(value) {
  return value ? String(value).trim().toLowerCase() : "";
}

function getTokenEmail(token) {
  const payload = decodeJwt(token);
  return normalizeEmail(payload?.email);
}

export function DelpiSsoBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, syncSsoSession, logout } = useAuth();

  const handledTokenRef = useRef(null);
  const inFlightTokenRef = useRef(null);
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
        inFlightTokenRef.current = null;

        logout({ silent: true, clearAll: true }).finally(() => {
          if (!mountedRef.current) return;
          navigate("/login", { replace: true });
        });

        return;
      }

      if (event.data?.type !== "DELPI_AUTH") return;

      const centralAccessToken = event.data?.token;
      if (!centralAccessToken) return;

      const centralEmail = getTokenEmail(centralAccessToken);
      const currentEmail = normalizeEmail(user?.email);

      const alreadySynced =
        isAuthenticated &&
        handledTokenRef.current === centralAccessToken &&
        !!centralEmail &&
        !!currentEmail &&
        centralEmail === currentEmail;

      if (alreadySynced) {
        navigateAfterAuth(navigate, location.pathname);
        return;
      }

      if (inFlightTokenRef.current === centralAccessToken) return;
      inFlightTokenRef.current = centralAccessToken;

      syncSsoSession({ centralAccessToken })
        .then(() => {
          handledTokenRef.current = centralAccessToken;

          if (!mountedRef.current) return;

          navigateAfterAuth(navigate, location.pathname);
        })
        .catch((error) => {
          console.error("Falha no SSO Minha DELPI:", error);

          handledTokenRef.current = null;

          if (!mountedRef.current) return;
          navigate("/login", { replace: true });
        })
        .finally(() => {
          if (inFlightTokenRef.current === centralAccessToken) {
            inFlightTokenRef.current = null;
          }
        });
    }

    window.addEventListener("message", handleMessage);

    requestToken();
    const retry = window.setTimeout(requestToken, 800);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(retry);
    };
  }, [user, isAuthenticated, syncSsoSession, logout, navigate, location.pathname]);

  return null;
}