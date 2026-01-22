// src/app/routes/AppRouter.jsx

import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { Layout } from "../ui/Layout";

import LoginPage from "../../pages/LoginPage";
import ConversationsPage from "../../pages/ConversationsPage";
import RequestsPage from "../../pages/RequestsPage";
import { RealtimeProvider } from "../realtime/RealtimeContext";
import RegisterPage from "../../pages/RegisterPage";
import ProductsPage from "../../pages/ProductsPage";
import AccountPage from "../../pages/AccountPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RealtimeProvider>
                <Layout />
              </RealtimeProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/conversations" replace />} />

          <Route path="conversations" element={<ConversationsPage />} />
          <Route path="conversations/:id" element={<ConversationsPage />} />

          <Route path="requests" element={<RequestsPage />} />
          <Route path="products" element={<ProductsPage />} />

          <Route path="account" element={<AccountPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
