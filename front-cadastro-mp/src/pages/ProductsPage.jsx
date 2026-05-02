// src/pages/ProductsPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import {
  listProductsApi,
  getProductApi,
  setProductFieldFlagApi,
} from "../app/api/productsApi";
import { RequestItemFields } from "../app/ui/requests/RequestItemFields";
import { ModalShell } from "../app/ui/common/ModalShell";

import { useAuth } from "../app/auth/AuthContext";
import { isModerator } from "../app/constants";
import { socket } from "../app/realtime/socket";

import { fieldsToFormState, TAGS } from "../app/ui/requests/requestItemFields.logic";
import "./ProductsPage.css";

function fmt(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
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
          <div className="cmp-products-footer-meta">
            Criado em: {fmt(product.created_at)} • Atualizado em: {fmt(product.updated_at)}
          </div>
        ) : null
      }
    >
      {busy ? (
        <div className="cmp-products-inline-state">Carregando...</div>
      ) : error ? (
        <div className="cmp-products-error">{error}</div>
      ) : !product ? (
        <div className="cmp-products-inline-state">Produto não encontrado.</div>
      ) : (
        <div className="cmp-products-fields">
          <div className="cmp-products-fields__header">
            <div className="cmp-products-fields__title">Campos do Produto</div>
            <div className="cmp-products-fields__meta">
              Código atual: {valuesByTag?.[TAGS.codigo_atual] || "—"} • Descrição: {valuesByTag?.[TAGS.descricao] || "—"}
            </div>
          </div>

          <RequestItemFields
            variant="fields"
            readOnly={true}
            isProduct={true}
            byTag={byTag}
            canEditFlags={canEditFlags}
            onSetFieldFlag={(fieldId, nextFlag) =>
              handleSetProductFieldFlag(fieldId, nextFlag)
            }
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
  const [flagFilter, setFlagFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtersTimerRef = useRef(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const reloadTimerRef = useRef(null);

  async function load({ resetOffset = false, nextOffsetOverride = null } = {}) {
    try {
      setBusy(true);
      setError("");

      const nextOffset = nextOffsetOverride ?? (resetOffset ? 0 : offset);

      const data = await listProductsApi({
        limit,
        offset: nextOffset,
        q: q?.trim() || null,
        flag: flagFilter,
        date_from: dateFrom || null,
        date_to: dateTo || null,
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset]);

  useEffect(() => {
    if (filtersTimerRef.current) clearTimeout(filtersTimerRef.current);

    filtersTimerRef.current = setTimeout(() => {
      load({ resetOffset: true, nextOffsetOverride: 0 });
    }, 350);

    return () => {
      if (filtersTimerRef.current) clearTimeout(filtersTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, flagFilter, dateFrom, dateTo]);

  function clearFilters() {
    setQ("");
    setFlagFilter("all");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  }

  useEffect(() => {
    function scheduleReload() {
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
  }, [limit, offset, q, flagFilter, dateFrom, dateTo]);

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
    <div className="cmp-products-page">
      <div className="cmp-products-page__header">
        <h2 className="cmp-products-page__title">Produtos</h2>

        <div className="cmp-products-page__filters">
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            className="cmp-products-page__control"
          >
            <option value="all">Flags: Todos</option>
            <option value="with">Flags: Com flag</option>
            <option value="without">Flags: Sem flag</option>
          </select>

          <input
            placeholder="Buscar (código/descrição)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="cmp-products-page__control cmp-products-page__control--search"
          />

          <div className="cmp-products-page__date-group">
            <span className="cmp-products-page__date-label">De</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="cmp-products-page__control cmp-products-page__control--date"
            />
            <span className="cmp-products-page__date-label">Até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="cmp-products-page__control cmp-products-page__control--date"
            />
          </div>

          <button
            type="button"
            onClick={clearFilters}
            disabled={busy && rows.length === 0}
            className="cmp-products-page__button"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {error ? <div className="cmp-products-error">{error}</div> : null}

      <div className="cmp-products-page__table-card">
        <table className="cmp-products-page__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Atualizado</th>
              <th>Flags</th>
              <th>Abrir</th>
            </tr>
          </thead>

          <tbody>
            {busy ? (
              <tr>
                <td colSpan={6} className="cmp-products-page__empty-cell">
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="cmp-products-page__empty-cell">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="cmp-products-page__id">{r.id}</span>
                  </td>
                  <td>{r.codigo_atual ?? "—"}</td>
                  <td>{r.descricao ?? "—"}</td>
                  <td>{fmt(r.updated_at || r.created_at)}</td>
                  <td>
                    {Number(r.flags_count ?? 0) > 0 ? (
                      <b>🚩{Number(r.flags_count)}</b>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => openDetails(r.id)}
                      className="cmp-products-page__table-button"
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="cmp-products-page__pagination">
        <span className="cmp-products-page__pagination-info">
          Mostrando {pageInfo.start}-{pageInfo.end} de {total}
        </span>

        <div className="cmp-products-page__pagination-actions">
          <button
            type="button"
            disabled={busy || offset <= 0}
            onClick={() => setOffset((v) => Math.max(0, v - limit))}
            className="cmp-products-page__button"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={busy || offset + limit >= total}
            onClick={() => setOffset((v) => v + limit)}
            className="cmp-products-page__button"
          >
            Próxima
          </button>
        </div>
      </div>

      <ProductDetailsModal
        open={detailsOpen}
        productId={selectedId}
        onClose={closeDetails}
      />
    </div>
  );
}