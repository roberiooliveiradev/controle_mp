// src/app/ui/Layout.jsx

import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";

export function Layout() {
  return (
    <div style={{display:"flex", flexDirection:"column", height:"100%"}}>
      <Topbar />
      <main style={{ Width: "calc(100vw)", height:"100%", flexShrink:1, padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}
