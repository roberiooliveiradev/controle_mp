// src/app/ui/chat/RequestComposerModal.jsx
import { useMemo, useState } from "react";
import { RequestItemFields } from "../requests/RequestItemFields";
import {
  newStructuredItem,
  validateStructuredItem,
  structuredItemToRequestPayloadItem,
} from "../requests/requestItemFields.logic";

const styles = {
  subtle: { fontSize: 12, opacity: "var(--text-muted)" },
  pill: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
  },
  itemErrorBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "var(--danger-bg)",
    color: "var(--danger)",
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid var(--danger-border)",
  },
};

export function RequestComposerModal({ onClose, onSubmit }) {
  const [items, setItems] = useState([newStructuredItem()]);
  const [activeIndex, setActiveIndex] = useState(0);

  /**
   * errors shape:
   * {
   *   [itemIndex]: { fields:{}, suppliers:{} }
   * }
   */
  const [errors, setErrors] = useState({});

  const active = items[activeIndex];
  const canSubmit = useMemo(() => items.length > 0, [items.length]);

  const hasUnsavedChanges = useMemo(() => {
    if (items.length > 1) return true;

    const first = items[0];
    if (!first) return false;

    // qualquer campo relevante preenchido
    return Object.entries(first).some(([k, v]) => {
      if (k === "_client_id") return false;
      if (Array.isArray(v)) return v.length > 0;
      return Boolean(v);
    });
  }, [items]);

  function getItemErrors(idx) {
    return errors?.[idx] || { fields: {}, suppliers: {} };
  }

  function itemHasAnyError(idx) {
    const itErr = getItemErrors(idx);
    const fieldsCount = Object.keys(itErr.fields || {}).length;
    const suppliersObj = itErr.suppliers || {};
    const suppliersCount = Object.values(suppliersObj).reduce((acc, row) => acc + Object.keys(row || {}).length, 0);
    return fieldsCount + suppliersCount > 0;
  }

  function clearFieldError(itemIdx, key) {
    setErrors((prev) => {
      const cur = prev?.[itemIdx];
      if (!cur?.fields?.[key]) return prev;

      const nextFields = { ...(cur.fields || {}) };
      delete nextFields[key];
      return { ...prev, [itemIdx]: { fields: nextFields, suppliers: cur.suppliers || {} } };
    });
  }

  function clearSupplierError(itemIdx, rowIdx, key) {
    setErrors((prev) => {
      const cur = prev?.[itemIdx];
      const row = cur?.suppliers?.[rowIdx];
      if (!row?.[key]) return prev;

      const nextRow = { ...(row || {}) };
      delete nextRow[key];

      const nextSuppliers = { ...(cur.suppliers || {}) };
      nextSuppliers[rowIdx] = nextRow;

      return { ...prev, [itemIdx]: { fields: cur.fields || {}, suppliers: nextSuppliers } };
    });
  }

  function setActiveItemField(key, value) {
    setItems((prev) => prev.map((it, idx) => (idx === activeIndex ? { ...it, [key]: value } : it)));
    clearFieldError(activeIndex, key);
  }

  function addItem() {
    setItems((prev) => [...prev, newStructuredItem()]);
    setActiveIndex(items.length);
  }

  function duplicateItem(idx) {
    setItems((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const src = list[idx];
      if (!src) return list;

      // clone profundo suficiente pro formato atual (inclui fornecedores)
      const cloned = {
        ...src,
        _client_id: (crypto?.randomUUID?.() ?? `cid-${Date.now()}-${Math.random()}`), 
        fornecedores: Array.isArray(src.fornecedores)
          ? src.fornecedores.map((r) => ({ ...r }))
          : [],
      };
      // ✅ se for UPDATE, evita disparar TOTVS automaticamente no duplicado
      if (cloned.request_type_code === "UPDATE") {
        cloned.codigo_atual = "";
      }

      // insere logo após o item original
      list.splice(idx + 1, 0, cloned);
      return list;
    });

    // seleciona o item duplicado
    setActiveIndex(idx + 1);

    // não duplica erros: o novo item começa “limpo”
    setErrors((prev) => {
      const next = {};
      Object.keys(prev || {}).forEach((k) => {
        const i = Number(k);
        if (Number.isNaN(i)) return;
        // desloca erros dos itens depois do idx
        next[i > idx ? i + 1 : i] = prev[i];
      });
      return next;
    });
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));

    setErrors((prev) => {
      const next = {};
      Object.keys(prev || {}).forEach((k) => {
        const i = Number(k);
        if (Number.isNaN(i)) return;
        if (i === idx) return;
        const newKey = i > idx ? i - 1 : i;
        next[newKey] = prev[i];
      });
      return next;
    });

    setActiveIndex((prev) => {
      if (idx === prev) return 0;
      if (idx < prev) return prev - 1;
      return prev;
    });
  }

  function validateAll() {
    const nextErrors = {};
    items.forEach((it, idx) => {
      const { fields, suppliers } = validateStructuredItem(it);
      if (Object.keys(fields).length || Object.keys(suppliers).length) nextErrors[idx] = { fields, suppliers };
    });
    return nextErrors;
  }

  function requestClose() {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }

    const ok = window.confirm(
      "Você tem informações preenchidas.\n\nDeseja realmente fechar e perder os dados?"
    );

    if (ok) {
      onClose();
    }
  }

  async function submit() {
    const nextErrors = validateAll();
    setErrors(nextErrors);

    const firstErrorItem = Object.keys(nextErrors)
      .map((x) => Number(x))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b)[0];

    if (firstErrorItem !== undefined) {
      setActiveIndex(firstErrorItem);
      return;
    }

    const requestItems = items.map(structuredItemToRequestPayloadItem);
    await onSubmit({ requestItems });
  }

  const activeErr = getItemErrors(activeIndex);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget ) 
        {
          // Disparar um alerta para evitar fechamento por clique errado e perda de informação
          requestClose();
        }
      }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <strong style={{ fontSize: 16 }}>Nova Request</strong>
            <span style={styles.subtle}>Preencha os itens e envie como um “carrinho”.</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={requestClose} style={{ padding: "8px 12px", borderRadius: 10 }}>
              Cancelar
            </button>
            <button type="button" onClick={submit} disabled={!canSubmit} style={{ padding: "8px 12px", borderRadius: 10, fontWeight: 700 }}>
              Enviar
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{display:"flex", flexDirection: "column", maxHeight:"85dvh"}}>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", overflow:"auto",}}>
          {/* Items list */}
          <aside style={{ borderRight: "1px solid var(--border)", padding: 12, background: "var(--surface-2)", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong>Itens</strong>
              <button type="button" onClick={addItem} style={{ padding: "8px 10px", borderRadius: 10 }}>
                + Item
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((it, idx) => {
                const isActive = idx === activeIndex;
                const hasErr = itemHasAnyError(idx);

                return (
                  <div
                    key={idx}
                    onClick={() => setActiveIndex(idx)}
                    style={{
                      border: hasErr ? "2px solid var(--danger-border)" : isActive ? "2px solid var(--border)" : "1px solid var(--border-2)",
                      borderRadius: 12,
                      padding: 10,
                      cursor: "pointer",
                      background: isActive? "var(--surface)" : "var(--surface-2)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{fontSize:15}}>Item #{idx + 1}</div>
                        {hasErr ? <span title="Há campos obrigatórios faltando" style={styles.itemErrorBadge}>!</span> : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateItem(idx);
                          }}
                          style={{ padding: "6px 10px", borderRadius: 10, fontSize:12}}
                        >
                          Duplicar
                        </button>

                        {items.length > 1 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(idx);
                            }}
                            style={{ padding: "6px 10px", borderRadius: 10, fontSize:12}}
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>

                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={styles.pill}>{it.request_type_code === "UPDATE" ? "ALTERAR" : "CRIAR"}</span>
                      <span style={{ ...styles.subtle, marginTop: 0 }}>
                        {it.descricao ? it.descricao.slice(0, 40) : "Sem descrição"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Active item editor */}
          <main style={{ padding: 12, overflow: "auto" }}>
            <RequestItemFields
              variant="structured"
              item={active}
              itemKey={active?._client_id ?? activeIndex}
              readOnly={false}
              errors={activeErr}
              onItemChange={(key, value) => setActiveItemField(key, value)}
              onClearFieldError={(key) => clearFieldError(activeIndex, key)}
              onClearSupplierError={(rowIdx, key) => clearSupplierError(activeIndex, rowIdx, key)}
            />
          </main>
        </div>
        </div>
      </div>
    </div>
  );
}
