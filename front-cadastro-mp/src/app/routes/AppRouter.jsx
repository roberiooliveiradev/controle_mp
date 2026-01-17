// src/app/routes/AppRouter.jsx

import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { Layout } from "../ui/Layout";

import LoginPage from "../../pages/LoginPage";
import ConversationsPage from "../../pages/ConversationsPage";
import ConversationDetailPage from "../../pages/ConversationDetailPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/conversations" replace />} />
          <Route path="conversations" element={<ConversationsPage />} />
          <Route path="conversations/:id" element={<ConversationDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
