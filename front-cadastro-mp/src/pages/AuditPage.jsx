// src/pages/AuditPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../app/auth/AuthContext";
import { listAuditLogsApi, getAuditSummaryApi } from "../app/api/auditApi";
import { ROLES } from "../app/constants";
import "./AuditPage.css";

function fmt(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function isoFromDateInput(d, endOfDay = false) {
  if (!d) return null;

  const iso = endOfDay ? `${d}T23:59:59` : `${d}T00:00:00`;
  const dt = new Date(iso);

  if (Number.isNaN(dt.getTime())) return null;

  return iso;
}

function Chip({ children }) {
  return <span className="cmp-audit-page__chip">{children}</span>;
}

function Tabs({ tab, setTab }) {
  return (
    <div className="cmp-audit-page__tabs">
      <button
        type="button"
        onClick={() => setTab("logs")}
        className={
          tab === "logs"
            ? "cmp-audit-page__tab cmp-audit-page__tab--active"
            : "cmp-audit-page__tab"
        }
      >
        Logs
      </button>

      <button
        type="button"
        onClick={() => setTab("reports")}
        className={
          tab === "reports"
            ? "cmp-audit-page__tab cmp-audit-page__tab--active"
            : "cmp-audit-page__tab"
        }
      >
        Relatórios
      </button>
    </div>
  );
}

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="cmp-audit-page__empty-cell">
        {children}
      </td>
    </tr>
  );
}

function ReportTable({ title, columns, rows, renderRow, minWidth = 420 }) {
  return (
    <section className="cmp-audit-page__report-card">
      <h3 className="cmp-audit-page__report-title">{title}</h3>

      <div className="cmp-audit-page__table-card">
        <table
          className="cmp-audit-page__table"
          style={{ "--cmp-audit-table-min-width": `${minWidth}px` }}
        >
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={columns.length}>—</EmptyRow>
            ) : (
              rows.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AuditPage() {
  const { user } = useAuth();
  const isAdmin = Number(user?.role_id) === ROLES.ADMIN;

  const [tab, setTab] = useState("logs");

  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [entityName, setEntityName] = useState("");
  const [actionName, setActionName] = useState("");
  const [userName, setUserName] = useState("");
  const [entityId, setEntityId] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debounceRef = useRef(null);

  const [repBusy, setRepBusy] = useState(false);
  const [repError, setRepError] = useState("");
  const [summary, setSummary] = useState(null);

  const fromIso = useMemo(() => isoFromDateInput(dateFrom, false), [dateFrom]);
  const toIso = useMemo(() => isoFromDateInput(dateTo, true), [dateTo]);

  async function loadLogs({ resetOffset = false } = {}) {
    try {
      setBusy(true);
      setError("");

      const nextOffset = resetOffset ? 0 : offset;

      const data = await listAuditLogsApi({
        limit,
        offset: nextOffset,
        entity_name: entityName.trim() || null,
        action_name: actionName.trim() || null,
        user_name: userName.trim() || null,
        entity_id: entityId.trim() ? Number(entityId.trim()) : null,
        q: q.trim() || null,
        from: fromIso,
        to: toIso,
      });

      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total ?? 0));

      if (resetOffset && offset !== 0) setOffset(0);
    } catch (err) {
      setError(err?.response?.data?.error ?? "Erro ao carregar auditoria.");
    } finally {
      setBusy(false);
    }
  }

  async function loadReports() {
    try {
      setRepBusy(true);
      setRepError("");

      const data = await getAuditSummaryApi({
        entity_name: entityName.trim() || null,
        action_name: actionName.trim() || null,
        user_name: userName.trim() || null,
        from: fromIso,
        to: toIso,
        top_users_limit: 10,
      });

      setSummary(data || null);
    } catch (err) {
      setRepError(err?.response?.data?.error ?? "Erro ao carregar relatórios.");
    } finally {
      setRepBusy(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      setBusy(false);
      setError("Acesso restrito: apenas ADMIN.");
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab !== "logs") return;

    loadLogs({ resetOffset: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, tab]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab !== "logs") return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      loadLogs({ resetOffset: true });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entityName,
    actionName,
    userName,
    entityId,
    q,
    dateFrom,
    dateTo,
    tab,
    isAdmin,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab !== "reports") return;

    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function clearFilters() {
    setEntityName("");
    setActionName("");
    setUserName("");
    setEntityId("");
    setQ("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);

    if (tab === "reports") {
      setSummary(null);
      loadReports();
    }
  }

  const pageInfo = useMemo(() => {
    const start = total === 0 ? 0 : offset + 1;
    const end = Math.min(offset + limit, total);
    return { start, end };
  }, [offset, limit, total]);

  return (
    <section className="cmp-audit-page">
      <header className="cmp-audit-page__header">
        <div>
          <h2 className="cmp-audit-page__title">Auditoria</h2>
          <p className="cmp-audit-page__subtitle">
            Consulte eventos registrados e relatórios de atividade.
          </p>
        </div>

        <Tabs tab={tab} setTab={setTab} />
      </header>

      <div className="cmp-audit-page__filters">
        <input
          placeholder="entity_name (ex: tbRequestItem)"
          value={entityName}
          onChange={(e) => setEntityName(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--entity"
        />

        <input
          placeholder="action_name (ex: UPDATED)"
          value={actionName}
          onChange={(e) => setActionName(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--action"
        />

        <input
          placeholder="usuário (nome)"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--user"
        />

        <input
          placeholder="entity_id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--id"
        />

        <input
          placeholder="buscar (details)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--search"
        />

        <div className="cmp-audit-page__period">
          <span className="cmp-audit-page__period-label">Período</span>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="De"
            className="cmp-audit-page__control cmp-audit-page__control--date"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Até"
            className="cmp-audit-page__control cmp-audit-page__control--date"
          />
        </div>

        <button
          type="button"
          onClick={clearFilters}
          className="cmp-audit-page__button"
        >
          Limpar
        </button>

        {tab === "reports" ? (
          <button
            type="button"
            onClick={loadReports}
            disabled={repBusy}
            className="cmp-audit-page__button cmp-audit-page__button--primary"
          >
            {repBusy ? "Atualizando..." : "Atualizar relatórios"}
          </button>
        ) : null}
      </div>

      {error && tab === "logs" ? (
        <div className="cmp-audit-page__error">{error}</div>
      ) : null}

      {repError && tab === "reports" ? (
        <div className="cmp-audit-page__error">{repError}</div>
      ) : null}

      {tab === "logs" ? (
        <>
          <div className="cmp-audit-page__summary">
            Mostrando {pageInfo.start}-{pageInfo.end} de {total} •{" "}
            <Chip>limit={limit}</Chip>
          </div>

          <div className="cmp-audit-page__table-card cmp-audit-page__table-card--logs">
            <table
              className="cmp-audit-page__table"
              style={{ "--cmp-audit-table-min-width": "1120px" }}
            >
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Entidade</th>
                  <th>Ação</th>
                  <th>entity_id</th>
                  <th>Usuário</th>
                  <th>Detalhes</th>
                </tr>
              </thead>

              <tbody>
                {busy ? (
                  <EmptyRow colSpan={6}>Carregando...</EmptyRow>
                ) : rows.length === 0 ? (
                  <EmptyRow colSpan={6}>Nenhum log encontrado.</EmptyRow>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="cmp-audit-page__nowrap">
                        {fmt(r.occurred_at)}
                      </td>
                      <td>{r.entity_name}</td>
                      <td>
                        <Chip>{r.action_name}</Chip>
                      </td>
                      <td>{r.entity_id ?? "—"}</td>
                      <td>{r.user_name ?? "—"}</td>
                      <td className="cmp-audit-page__details-cell">
                        <div>{r.details || "—"}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="cmp-audit-page__pagination">
            <span className="cmp-audit-page__pagination-info">
              Mostrando {pageInfo.start}-{pageInfo.end} de {total}
            </span>

            <div className="cmp-audit-page__pagination-actions">
              <button
                type="button"
                disabled={busy || offset <= 0}
                onClick={() => setOffset((v) => Math.max(0, v - limit))}
                className="cmp-audit-page__button"
              >
                Anterior
              </button>

              <button
                type="button"
                disabled={busy || offset + limit >= total}
                onClick={() => setOffset((v) => v + limit)}
                className="cmp-audit-page__button"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="cmp-audit-page__reports">
          {repBusy ? (
            <div className="cmp-audit-page__inline-state">
              Carregando relatórios...
            </div>
          ) : !summary ? (
            <div className="cmp-audit-page__inline-state">
              Sem dados. Ajuste os filtros e clique em “Atualizar relatórios”.
            </div>
          ) : (
            <>
              <ReportTable
                title="Eventos por dia"
                columns={["Dia", "Qtd"]}
                rows={summary.by_day || []}
                minWidth={420}
                renderRow={(r, idx) => (
                  <tr key={idx}>
                    <td>{fmt(r.day)}</td>
                    <td>{r.count}</td>
                  </tr>
                )}
              />

              <ReportTable
                title="Entidade × Ação"
                columns={["Entidade", "Ação", "Qtd"]}
                rows={(summary.by_entity_action || []).slice(0, 50)}
                minWidth={620}
                renderRow={(r, idx) => (
                  <tr key={idx}>
                    <td>{r.entity_name}</td>
                    <td>
                      <Chip>{r.action_name}</Chip>
                    </td>
                    <td>{r.count}</td>
                  </tr>
                )}
              />

              <ReportTable
                title="Top usuários"
                columns={["Usuário", "Qtd"]}
                rows={summary.top_users || []}
                minWidth={420}
                renderRow={(r, idx) => (
                  <tr key={idx}>
                    <td>{r.user_name}</td>
                    <td>{r.count}</td>
                  </tr>
                )}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}