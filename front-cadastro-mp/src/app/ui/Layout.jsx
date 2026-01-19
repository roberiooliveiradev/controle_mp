// src/app/ui/Layout.jsx

import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";

export function Layout() {
  return (
    <div style={{ minHeight: "calc(100dvh)" }}>
      <Topbar />
      <main style={{ maxWidth: "calc(100dvw - 100px)", margin: "0 auto", padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}
