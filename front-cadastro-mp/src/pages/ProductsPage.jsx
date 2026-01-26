// src/pages/ProductsPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { listProductsApi, getProductApi, setProductFieldFlagApi } from "../app/api/productsApi";
import { RequestItemFields } from "../app/ui/requests/RequestItemFields";

import { useAuth } from "../app/auth/AuthContext";
import { isModerator } from "../app/constants";
import { socket } from "../app/realtime/socket";

import { fieldsToFormState, TAGS } from "../app/ui/requests/requestItemFields.logic";

function fmt(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "min(86vh, 900px)",
          overflow: "hidden",
          background: "var(--surface)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ fontWeight: 800 }}>{title}</div>
          <button onClick={onClose}>Fechar</button>
        </div>

        <div style={{ overflow: "auto", padding: 12 }}>{children}</div>

        {footer ? (
          <div
            style={{
              padding: 12,
              borderTop: "1px solid var(--border)",
              background: "var(--surface-2)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductDetailsModal({ open, productId, onClose }) {
  const { user } = useAuth();
  const canEditFlags = isModerator(user?.role_id);

  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);

  const [valuesByTag, setValuesByTag] = useState({});
  const [fornecedoresRows, setFornecedoresRows] = useState([]);
  const [byTag, setByTag] = useState({});

  async function handleSetProductFieldFlag(fieldId, nextFlag) {
    await setProductFieldFlagApi(fieldId, nextFlag);

    // recarrega o produto pra refletir (simples e consistente)
    const p = await getProductApi(productId);
    setProduct(p);
    const st = fieldsToFormState(p?.fields || []);
    setValuesByTag(st.values);
    setFornecedoresRows(st.fornecedoresRows);
    setByTag(st.byTag);
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!open || !productId) return;
      try {
        setBusy(true);
        setError("");
        const p = await getProductApi(productId);
        if (!alive) return;

        setProduct(p);

        const st = fieldsToFormState(p?.fields || []);
        setValuesByTag(st.values);
        setFornecedoresRows(st.fornecedoresRows);
        setByTag(st.byTag);
      } catch (err) {
        if (!alive) return;
        setError(err?.response?.data?.error ?? "Erro ao carregar produto.");
      } finally {
        if (alive) setBusy(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [open, productId]);

  if (!open) return null;

  return (
    <ModalShell
      title={`Produto #${productId}`}
      onClose={onClose}
      footer={
        product ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Criado em: {fmt(product.created_at)} • Atualizado em: {fmt(product.updated_at)}
          </div>
        ) : null
      }
    >
      {busy ? (
        <div>Carregando...</div>
      ) : error ? (
        <div style={{ padding: 10, border: "1px solid var(--danger-border)", background: "var(--danger-bg)", borderRadius: 8 }}>
          {error}
        </div>
      ) : !product ? (
        <div style={{ opacity: 0.8 }}>Produto não encontrado.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>Campos do Produto</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Código atual: {valuesByTag?.[TAGS.codigo_atual] || "—"} • Descrição: {valuesByTag?.[TAGS.descricao] || "—"}
            </div>
          </div>

          <RequestItemFields
            variant="fields"
            readOnly={true}
            isProduct={true}

            // flags
            byTag={byTag}
            canEditFlags={canEditFlags}
            onSetFieldFlag={(fieldId, nextFlag) => handleSetProductFieldFlag(fieldId, nextFlag)}

            valuesByTag={valuesByTag}
            onChangeTagValue={() => {}}
            fornecedoresRows={fornecedoresRows}
            onChangeFornecedores={() => {}}
            errors={{ fields: {}, suppliers: {} }}
          />
        </div>
      )}
    </ModalShell>
  );
}

export default function ProductsPage() {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");

  const [flagFilter, setFlagFilter] = useState("all"); // all | with | without


  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const reloadTimerRef = useRef(null);

  async function load({ resetOffset = false } = {}) {
    try {
      setBusy(true);
      setError("");

      const nextOffset = resetOffset ? 0 : offset;

      const data = await listProductsApi({
        limit,
        offset: nextOffset,
        q: q?.trim() || null,
        flag: flagFilter,
      });

      const items = Array.isArray(data?.items) ? data.items : [];
      setRows(items);
      setTotal(Number(data?.total ?? 0));
      if (resetOffset) setOffset(0);
    } catch (err) {
      setError(err?.response?.data?.error ?? "Erro ao carregar produtos.");
    } finally {
      setBusy(false);
    }
  }

  // Carregamento normal por paginação
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset, flagFilter]);

  // ✅ Recarregar listagem quando chegar evento realtime de produto
  useEffect(() => {
    function scheduleReload() {
      // debounce simples (evita vários reloads em sequência)
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        load({ resetOffset: false });
      }, 250);
    }

    const onCreated = () => scheduleReload();
    const onUpdated = () => scheduleReload();
    const onFlagChanged = () => scheduleReload();

    socket.on("product:created", onCreated);
    socket.on("product:updated", onUpdated);
    socket.on("product:flag_changed", onFlagChanged);

    return () => {
      socket.off("product:created", onCreated);
      socket.off("product:updated", onUpdated);
      socket.off("product:flag_changed", onFlagChanged);

      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset, q]);

  const pageInfo = useMemo(() => {
    const start = total === 0 ? 0 : offset + 1;
    const end = Math.min(offset + limit, total);
    return { start, end };
  }, [offset, limit, total]);

  function openDetails(id) {
    setSelectedId(id);
    setDetailsOpen(true);
  }

  function closeDetails() {
    setDetailsOpen(false);
    setSelectedId(null);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Produtos</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select value={flagFilter} onChange={(e) => setFlagFilter(e.target.value)}>
            <option value="all">Filtro flag todos</option>
            <option value="with">Com flag</option>
            <option value="without">Sem flag</option>
          </select>
          <input
            placeholder="Buscar (código/descrição)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260 }}
          />
          <button onClick={() => load({ resetOffset: true })} disabled={busy}>
            Buscar
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 10, border: "1px solid var(--danger-border)", background: "var(--danger-bg)", borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>ID</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Código</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Descrição</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Atualizado</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Flags</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Abrir</th>
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
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                    <b>{r.id}</b>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.codigo_atual ?? "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{r.descricao ?? "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{fmt(r.updated_at || r.created_at)}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                    {Number(r.flags_count ?? 0) > 0 ? <b>🚩{Number(r.flags_count)}</b> : "—"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                    <button onClick={() => openDetails(r.id)}>Abrir</button>
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

      <ProductDetailsModal open={detailsOpen} productId={selectedId} onClose={closeDetails} />
    </div>
  );
}
