// src/pages/AuditPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../app/auth/AuthContext";
import { listAuditLogsApi, getAuditSummaryApi } from "../app/api/auditApi";
import { ROLES } from "../app/constants";

function fmt(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function isoFromDateInput(d, endOfDay = false) {
  // input: "YYYY-MM-DD"
  if (!d) return null;
  const iso = endOfDay ? `${d}T23:59:59` : `${d}T00:00:00`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  // mantém sem timezone explícito (backend usa fromisoformat)
  return iso;
}

function Chip({ children }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "3px 8px",
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}
    >
      {children}
    </span>
  );
}

function Tabs({ tab, setTab }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        onClick={() => setTab("logs")}
        style={{
          borderRadius: 10,
          padding: "8px 12px",
          border: "1px solid var(--border)",
          background: tab === "logs" ? "var(--surface-2)" : "var(--surface)",
          fontWeight: tab === "logs" ? 800 : 600,
        }}
      >
        Logs
      </button>
      <button
        onClick={() => setTab("reports")}
        style={{
          borderRadius: 10,
          padding: "8px 12px",
          border: "1px solid var(--border)",
          background: tab === "reports" ? "var(--surface-2)" : "var(--surface)",
          fontWeight: tab === "reports" ? 800 : 600,
        }}
      >
        Relatórios
      </button>
    </div>
  );
}

export default function AuditPage() {
  const { user } = useAuth();
  const isAdmin = Number(user?.role_id) === ROLES.ADMIN;

  const [tab, setTab] = useState("logs");

  // logs
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // filtros (logs + reports)
  const [entityName, setEntityName] = useState("");
  const [actionName, setActionName] = useState("");
  const [userName, setUserName] = useState("");
  const [entityId, setEntityId] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState("");     // YYYY-MM-DD

  const debounceRef = useRef(null);

  // reports
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


  // guard: admin-only
  useEffect(() => {
    if (!isAdmin) {
      setBusy(false);
      setError("Acesso restrito: apenas ADMIN.");
    }
  }, [isAdmin]);

  // logs: recarrega quando offset muda
  useEffect(() => {
    if (!isAdmin) return;
    if (tab !== "logs") return;
    loadLogs({ resetOffset: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, tab]);

  // logs: filtros (debounced)
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
  }, [entityName, actionName, userName, entityId, q, dateFrom, dateTo, tab, isAdmin]);

  // reports: carrega quando troca para aba
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Auditoria</h2>
        <Tabs tab={tab} setTab={setTab} />
      </div>

      {/* filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="entity_name (ex: tbRequestItem)"
          value={entityName}
          onChange={(e) => setEntityName(e.target.value)}
          style={{ width: 230 }}
        />
        <input
          placeholder="action_name (ex: UPDATED)"
          value={actionName}
          onChange={(e) => setActionName(e.target.value)}
          style={{ width: 190 }}
        />
        <input placeholder="usuário (nome)" value={userName} onChange={(e) => setUserName(e.target.value)} style={{ width: 180 }} />
        <input
          placeholder="entity_id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          style={{ width: 110 }}
        />
        <input placeholder="buscar (details)" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />

        <span style={{ opacity: 0.7, fontSize: 12 }}>Período:</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="De" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Até" />

        <button onClick={clearFilters}>Limpar</button>

        {tab === "reports" ? (
          <button onClick={loadReports} disabled={repBusy}>
            {repBusy ? "Atualizando..." : "Atualizar relatórios"}
          </button>
        ) : null}
      </div>

      {/* erros */}
      {error && tab === "logs" ? (
        <div style={{ padding: 10, border: "1px solid var(--danger-border)", background: "var(--danger-bg)", borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      {repError && tab === "reports" ? (
        <div style={{ padding: 10, border: "1px solid var(--danger-border)", background: "var(--danger-bg)", borderRadius: 8 }}>
          {repError}
        </div>
      ) : null}

      {/* conteúdo */}
      {tab === "logs" ? (
        <>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Mostrando {pageInfo.start}-{pageInfo.end} de {total} • <Chip>limit={limit}</Chip>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Quando</th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Entidade</th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Ação</th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>entity_id</th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Usuário</th>
                  <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {busy ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 12 }}>
                      Carregando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 12 }}>
                      Nenhum log encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                        {fmt(r.occurred_at)}
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.entity_name}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                        <Chip>{r.action_name}</Chip>
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.entity_id ?? "—"}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.user_name ?? "—"}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--border)", maxWidth: 520 }}>
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.details || "—"}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <span style={{ opacity: 0.8 }}>
              Mostrando {pageInfo.start}-{pageInfo.end} de {total}
            </span>

            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy || offset <= 0} onClick={() => setOffset((v) => Math.max(0, v - limit))}>
                Anterior
              </button>
              <button disabled={busy || offset + limit >= total} onClick={() => setOffset((v) => v + limit)}>
                Próxima
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {repBusy ? (
            <div>Carregando relatórios...</div>
          ) : !summary ? (
            <div style={{ opacity: 0.8 }}>Sem dados (ajuste filtros e clique “Atualizar relatórios”).</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>Eventos por dia</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)" }}>
                        <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Dia</th>
                        <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(summary.by_day || []).map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{fmt(r.day)}</td>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.count}</td>
                        </tr>
                      ))}
                      {(summary.by_day || []).length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ padding: 10 }}>
                            —
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>Entidade × Ação</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)" }}>
                        <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Entidade</th>
                        <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Ação</th>
                        <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(summary.by_entity_action || []).slice(0, 50).map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.entity_name}</td>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                            <Chip>{r.action_name}</Chip>
                          </td>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.count}</td>
                        </tr>
                      ))}
                      {(summary.by_entity_action || []).length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: 10 }}>
                            —
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>Top usuários</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)" }}>
                        <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Usuário</th>
                        <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(summary.top_users || []).map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.user_name}</td>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.count}</td>
                        </tr>
                      ))}
                      {(summary.top_users || []).length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ padding: 10 }}>
                            —
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Dica: se você quiser mostrar nome/e-mail em vez de só user_id, eu ajusto o backend para dar join em tbUsers.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
