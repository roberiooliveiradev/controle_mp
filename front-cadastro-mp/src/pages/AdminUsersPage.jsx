// src/pages/AdminUsersPage.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import { adminListUsersApi, adminUpdateUserApi } from "../app/api/usersApi";

const ROLE = {
  ADMIN: 1,
  ANALYST: 2,
  USER: 3,
};

function roleLabel(roleId) {
  if (roleId === 1) return "ADMIN";
  if (roleId === 2) return "ANALYST";
  return "USER";
}

export default function AdminUsersPage() {
  const nav = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.role_id === ROLE.ADMIN;

  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [limit, setLimit] = useState(30);
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) nav("/"); // bloqueia no front
  }, [user, isAdmin, nav]);

  async function load() {
    setError("");
    setBusy(true);
    try {
      const data = await adminListUsersApi({ limit, offset, include_deleted: includeDeleted });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Falha ao listar usuários.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, limit, offset, includeDeleted]);

  async function onChangeRole(u, nextRoleId) {
    setError("");
    try {
      const updated = await adminUpdateUserApi({ user_id: u.id, role_id: nextRoleId });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Falha ao atualizar role.";
      setError(msg);
    }
  }

  async function onToggleDeleted(u) {
    setError("");
    try {
      const updated = await adminUpdateUserApi({ user_id: u.id, is_deleted: !u.is_deleted });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Falha ao atualizar status.";
      setError(msg);
    }
  }

  if (!isAdmin) return null;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Admin · Usuários</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setOffset(0);
              setIncludeDeleted(e.target.checked);
            }}
          />
          Incluir desativados
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Itens por página:
          <select
            value={limit}
            onChange={(e) => {
              setOffset(0);
              setLimit(Number(e.target.value));
            }}
          >
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            disabled={busy || offset === 0}
          >
            ◀
          </button>
          <span>
            Página {page} / {pages} · Total {total}
          </span>
          <button
            onClick={() => setOffset((o) => (o + limit < total ? o + limit : o))}
            disabled={busy || offset + limit >= total}
          >
            ▶
          </button>

          <button onClick={load} disabled={busy}>
            {busy ? "Carregando..." : "Recarregar"}
          </button>
        </div>
      </div>

      {error && <div style={{ marginTop: 12, color: "var(--danger)" }}>{error}</div>}

      <div
        style={{
          marginTop: 12,
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "rgba(0,0,0,0.03)" }}>
              <th style={{ padding: 10 }}>ID</th>
              <th style={{ padding: 10 }}>Nome</th>
              <th style={{ padding: 10 }}>Email</th>
              <th style={{ padding: 10 }}>Role</th>
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: 10, width: 70 }}>{u.id}</td>
                <td style={{ padding: 10 }}>{u.full_name}</td>
                <td style={{ padding: 10 }}>{u.email}</td>

                <td style={{ padding: 10, width: 160 }}>
                  <select
                    value={u.role_id}
                    onChange={(e) => onChangeRole(u, Number(e.target.value))}
                    disabled={busy}
                  >
                    {[ROLE.ADMIN, ROLE.ANALYST, ROLE.USER].map((rid) => (
                      <option key={rid} value={rid}>
                        {roleLabel(rid)}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={{ padding: 10, width: 140 }}>
                  {u.is_deleted ? "DESATIVADO" : "ATIVO"}
                </td>

                <td style={{ padding: 10, width: 200 }}>
                  <button onClick={() => onToggleDeleted(u)} disabled={busy}>
                    {u.is_deleted ? "Ativar" : "Desativar"}
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 14, opacity: 0.8 }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
