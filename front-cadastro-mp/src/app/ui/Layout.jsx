// src/app/ui/Layout.jsx

import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";
import "./Layout.css";

export function Layout() {
  return (
    <div className="cmp-shell">
      <Topbar />
      <main className="cmp-shell__main">
        <Outlet />
      </main>
    </div>
  );
}