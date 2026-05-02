// src/pages/AdminUsersPage.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth/AuthContext";
import { adminListUsersApi, adminUpdateUserApi } from "../app/api/usersApi";
import "./AdminUsersPage.css";

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
  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit]
  );

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) nav("/");
  }, [user, isAdmin, nav]);

  async function load() {
    setError("");
    setBusy(true);

    try {
      const data = await adminListUsersApi({
        limit,
        offset,
        include_deleted: includeDeleted,
      });

      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Falha ao listar usuários.";
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
      const updated = await adminUpdateUserApi({
        user_id: u.id,
        role_id: nextRoleId,
      });

      setItems((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Falha ao atualizar role.";
      setError(msg);
    }
  }

  async function onToggleDeleted(u) {
    setError("");

    try {
      const updated = await adminUpdateUserApi({
        user_id: u.id,
        is_deleted: !u.is_deleted,
      });

      setItems((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Falha ao atualizar status.";
      setError(msg);
    }
  }

  if (!isAdmin) return null;

  return (
    <section className="cmp-admin-users-page">
      <header className="cmp-admin-users-page__header">
        <div>
          <h2 className="cmp-admin-users-page__title">Admin · Usuários</h2>
          <p className="cmp-admin-users-page__subtitle">
            Gerencie papéis e ativação dos usuários do Controle MP.
          </p>
        </div>
      </header>

      <div className="cmp-admin-users-page__toolbar">
        <label className="cmp-admin-users-page__check">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setOffset(0);
              setIncludeDeleted(e.target.checked);
            }}
          />
          <span>Incluir desativados</span>
        </label>

        <label className="cmp-admin-users-page__limit">
          <span>Itens por página</span>

          <select
            value={limit}
            onChange={(e) => {
              setOffset(0);
              setLimit(Number(e.target.value));
            }}
            className="cmp-admin-users-page__select"
          >
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="cmp-admin-users-page__pager">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            disabled={busy || offset === 0}
            className="cmp-admin-users-page__button cmp-admin-users-page__button--icon"
            title="Página anterior"
          >
            ◀
          </button>

          <span className="cmp-admin-users-page__pager-label">
            Página {page} / {pages} · Total {total}
          </span>

          <button
            type="button"
            onClick={() => setOffset((o) => (o + limit < total ? o + limit : o))}
            disabled={busy || offset + limit >= total}
            className="cmp-admin-users-page__button cmp-admin-users-page__button--icon"
            title="Próxima página"
          >
            ▶
          </button>

          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="cmp-admin-users-page__button"
          >
            {busy ? "Carregando..." : "Recarregar"}
          </button>
        </div>
      </div>

      {error ? <div className="cmp-admin-users-page__error">{error}</div> : null}

      <div className="cmp-admin-users-page__table-card">
        <table className="cmp-admin-users-page__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="cmp-admin-users-page__empty-cell">
                  {busy ? "Carregando..." : "Nenhum usuário encontrado."}
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr
                  key={u.id}
                  className={
                    u.is_deleted
                      ? "cmp-admin-users-page__row cmp-admin-users-page__row--deleted"
                      : "cmp-admin-users-page__row"
                  }
                >
                  <td>
                    <span className="cmp-admin-users-page__id">{u.id}</span>
                  </td>

                  <td>
                    <span className="cmp-admin-users-page__name">
                      {u.full_name || "—"}
                    </span>
                  </td>

                  <td>
                    <span className="cmp-admin-users-page__email">
                      {u.email || "—"}
                    </span>
                  </td>

                  <td>
                    <select
                      value={u.role_id}
                      onChange={(e) => onChangeRole(u, Number(e.target.value))}
                      disabled={busy}
                      className="cmp-admin-users-page__role-select"
                    >
                      {[ROLE.ADMIN, ROLE.ANALYST, ROLE.USER].map((rid) => (
                        <option key={rid} value={rid}>
                          {roleLabel(rid)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <span
                      className={
                        u.is_deleted
                          ? "cmp-admin-users-page__status cmp-admin-users-page__status--deleted"
                          : "cmp-admin-users-page__status cmp-admin-users-page__status--active"
                      }
                    >
                      {u.is_deleted ? "DESATIVADO" : "ATIVO"}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => onToggleDeleted(u)}
                      disabled={busy}
                      className={
                        u.is_deleted
                          ? "cmp-admin-users-page__action"
                          : "cmp-admin-users-page__action cmp-admin-users-page__action--danger"
                      }
                    >
                      {u.is_deleted ? "Ativar" : "Desativar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}