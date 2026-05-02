// src/pages/AuditPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

import { useAuth } from "../app/auth/AuthContext";
import { listAuditLogsApi, getAuditSummaryApi } from "../app/api/auditApi";
import { ROLES } from "../app/constants";
import "./AuditPage.css";

function fmt(iso) {
  if (!iso) return "-";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);

  return d.toLocaleString("pt-BR");
}

function fmtDay(value) {
  if (!value) return "-";

  const raw = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleDateString("pt-BR");
}

function isoFromDateInput(d, endOfDay = false) {
  if (!d) return null;

  const iso = endOfDay ? `${d}T23:59:59` : `${d}T00:00:00`;
  const dt = new Date(iso);

  if (Number.isNaN(dt.getTime())) return null;

  return iso;
}

function num(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
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

function MetricCard({ label, value, hint }) {
  return (
    <article className="cmp-audit-page__metric-card">
      <span className="cmp-audit-page__metric-label">{label}</span>
      <strong className="cmp-audit-page__metric-value">{value}</strong>
      {hint ? <span className="cmp-audit-page__metric-hint">{hint}</span> : null}
    </article>
  );
}

function AuditTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="cmp-audit-page__chart-tooltip">
      <strong>{label}</strong>

      {payload.map((item) => (
        <div key={item.dataKey} className="cmp-audit-page__chart-tooltip-row">
          <span>{item.name || item.dataKey}</span>
          <b>{item.value}</b>
        </div>
      ))}
    </div>
  );
}

function TimelineChart({ rows }) {
  const data = (Array.isArray(rows) ? rows : []).map((row) => ({
    dia: fmtDay(row.day),
    eventos: num(row.count),
  }));

  return (
    <section className="cmp-audit-page__chart-card cmp-audit-page__chart-card--timeline">
      <div className="cmp-audit-page__chart-header">
        <div>
          <h3 className="cmp-audit-page__chart-title">Eventos por dia</h3>
          <p className="cmp-audit-page__chart-subtitle">
            Evolução do volume de eventos no período filtrado.
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="cmp-audit-page__inline-state">Sem eventos no período.</div>
      ) : (
        <div className="cmp-audit-page__recharts-wrap cmp-audit-page__recharts-wrap--large">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 18, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="auditEventsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.04} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />

              <XAxis
                dataKey="dia"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />

              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip content={<AuditTooltip />} />

              <Area
                type="monotone"
                dataKey="eventos"
                name="Eventos"
                stroke="var(--primary)"
                strokeWidth={3}
                fill="url(#auditEventsGradient)"
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function HorizontalBarList({
  title,
  subtitle,
  rows,
  getLabel,
  getMeta,
  getValue,
  emptyText,
}) {
  const data = Array.isArray(rows) ? rows : [];
  const max = Math.max(1, ...data.map((r) => num(getValue(r))));

  function widthFor(value) {
    const n = num(value);
    return `${Math.max(4, Math.round((n / max) * 100))}%`;
  }

  return (
    <section className="cmp-audit-page__chart-card">
      <div className="cmp-audit-page__chart-header">
        <div>
          <h3 className="cmp-audit-page__chart-title">{title}</h3>
          {subtitle ? (
            <p className="cmp-audit-page__chart-subtitle">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="cmp-audit-page__inline-state">
          {emptyText || "Sem dados."}
        </div>
      ) : (
        <div className="cmp-audit-page__bar-list">
          {data.map((row, idx) => {
            const value = num(getValue(row));

            return (
              <div className="cmp-audit-page__bar-row" key={idx}>
                <div className="cmp-audit-page__bar-row-header">
                  <div className="cmp-audit-page__bar-label">
                    {getLabel(row)}

                    {getMeta ? (
                      <span className="cmp-audit-page__bar-meta">
                        {getMeta(row)}
                      </span>
                    ) : null}
                  </div>

                  <strong className="cmp-audit-page__bar-value">{value}</strong>
                </div>

                <div className="cmp-audit-page__bar-track">
                  <div
                    className="cmp-audit-page__bar-fill"
                    style={{ "--cmp-audit-bar-width": widthFor(value) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
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

  const byDay = useMemo(() => summary?.by_day || [], [summary]);
  const byEntityAction = useMemo(
    () => summary?.by_entity_action || [],
    [summary]
  );
  const topUsers = useMemo(() => summary?.top_users || [], [summary]);

  const reportStats = useMemo(() => {
    const totalEvents = byDay.reduce((acc, row) => acc + num(row.count), 0);

    const uniqueEntities = new Set(
      byEntityAction.map((row) => row.entity_name).filter(Boolean)
    ).size;

    const uniqueActions = new Set(
      byEntityAction.map((row) => row.action_name).filter(Boolean)
    ).size;

    const activeUsers = topUsers.length;

    return {
      totalEvents,
      uniqueEntities,
      uniqueActions,
      activeUsers,
    };
  }, [byDay, byEntityAction, topUsers]);

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
    setSummary(null);
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
            Consulte eventos registrados, rastreie alterações e acompanhe a
            atividade do sistema.
          </p>
        </div>

        <Tabs tab={tab} setTab={setTab} />
      </header>

      <div className="cmp-audit-page__filters">
        <input
          placeholder="Entidade, ex: auth, user, message"
          value={entityName}
          onChange={(e) => setEntityName(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--entity"
        />

        <input
          placeholder="Ação, ex: LOGIN, UPDATED"
          value={actionName}
          onChange={(e) => setActionName(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--action"
        />

        <input
          placeholder="Usuário"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--user"
        />

        <input
          placeholder="ID da entidade"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          className="cmp-audit-page__control cmp-audit-page__control--id"
        />

        <input
          placeholder="Buscar nos detalhes"
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
            <Chip>limite={limit}</Chip>
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

                      <td>
                        <span className="cmp-audit-page__entity-name">
                          {r.entity_name}
                        </span>
                      </td>

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
              <div className="cmp-audit-page__metrics-grid">
                <MetricCard
                  label="Eventos"
                  value={reportStats.totalEvents}
                  hint="Total no período"
                />

                <MetricCard
                  label="Entidades"
                  value={reportStats.uniqueEntities}
                  hint="Áreas afetadas"
                />

                <MetricCard
                  label="Ações"
                  value={reportStats.uniqueActions}
                  hint="Tipos de evento"
                />

                <MetricCard
                  label="Usuários"
                  value={reportStats.activeUsers}
                  hint="Com atividade"
                />
              </div>

              <div className="cmp-audit-page__charts-grid">
                <TimelineChart rows={byDay} />

                <HorizontalBarList
                  title="Entidade × Ação"
                  subtitle="Eventos mais frequentes por tipo de entidade e ação."
                  rows={byEntityAction.slice(0, 10)}
                  getLabel={(row) => row.entity_name || "—"}
                  getMeta={(row) => row.action_name || "—"}
                  getValue={(row) => row.count}
                  emptyText="Sem eventos por entidade/ação."
                />

                <HorizontalBarList
                  title="Top usuários"
                  subtitle="Usuários com maior volume de eventos no período."
                  rows={topUsers.slice(0, 10)}
                  getLabel={(row) => row.user_name || "—"}
                  getValue={(row) => row.count}
                  emptyText="Sem usuários no período."
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}