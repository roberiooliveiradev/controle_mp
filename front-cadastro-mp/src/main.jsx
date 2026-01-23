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
        <Toaster position="top-center" />
      </RealtimeProvider>
    </AuthProvider>
  </React.StrictMode>
);
