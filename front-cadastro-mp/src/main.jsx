// src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./app/auth/AuthContext";
import { RealtimeProvider } from "./app/realtime/RealtimeContext";
import { AppRouter } from "./app/routes/AppRouter";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RealtimeProvider>
        <AppRouter />

        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: "var(--surface-elevated)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
              borderRadius: "var(--radius-md)",
            },
          }}
        />
      </RealtimeProvider>
    </AuthProvider>
  </React.StrictMode>
);