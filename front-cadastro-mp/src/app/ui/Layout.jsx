// src/app/ui/Layout.jsx

import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";

export function Layout() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Topbar />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}
