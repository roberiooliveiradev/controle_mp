// src/app/ui/requests/RequestItemFields.jsx

import { useMemo } from "react";
import {
  TAGS,
  newSupplierRow,
  REQUEST_TYPE_ID_UPDATE,
} from "./requestItemFields.logic";


const styles = {
  label: { display: "grid", gap: 6, fontSize: 13, color: "var(--text)" },
  input: { padding: "8px 8px", borderRadius: 6, border: "1px solid var(--border-2)", outline: "none" },
  select: {
    padding: "8px 8px",
    borderRadius: 6,
    border: "1px solid var(--border-2)",
    outline: "none",
    background: "var(--surface)",
  },
  sectionTitle: { fontWeight: 800, marginBottom: 8 },
  subtle: { fontSize: 12, opacity: "var(--text-muted)" },
  errorText: { fontSize: 12, color: "var(--danger)", marginTop: 4, lineHeight: 1.2 },
};

function inputStyle(hasError) {
  if (!hasError) return styles.input;
  return {
    ...styles.input,
    background: "var(--danger-bg)",
    border: "1px solid var(--danger-border)",
    boxShadow: "0 0 0 3px var(--shadow)",
  };
}

function selectStyle(hasError) {
  if (!hasError) return styles.select;
  return {
    ...styles.select,
    background: "var(--danger-bg)",
    border: "1px solid var(--danger-border)",
    boxShadow: "0 0 0 3px var(--shadow)",
  };
}

/**
 * Componente “unificado” dos campos do RequestItem.
 *
 * Suporta 2 variantes:
 * - variant="structured": usado no RequestComposerModal (state estruturado)
 * - variant="fields": usado no DetailsModal (state por tags + fornecedores)
 *
 * Props comuns:
 * - readOnly: boolean (força somente leitura)
 */
export function RequestItemFields({
  variant,
  readOnly = false,

  // ---------- structured ----------
  item,
  onItemChange,
  errors,
  onClearFieldError,
  onClearSupplierError,

  // ---------- fields ----------
  valuesByTag,
  onChangeTagValue,
  fornecedoresRows,
  onChangeFornecedores,

  // ✅ NOVO: usado no modal de detalhes (variant="fields")
  requestTypeId,
}) {
  const isStructured = variant === "structured";

  // ✅ FIX: isUpdate não pode depender do valor do campo
  const isUpdate = isStructured
    ? item?.request_type_code === "UPDATE"
    : Number(requestTypeId) === REQUEST_TYPE_ID_UPDATE;

  const fieldErr = errors?.fields || {};
  const suppliersErr = errors?.suppliers || {};

  const fornecedores = useMemo(() => {
    if (isStructured) return Array.isArray(item?.fornecedores) && item.fornecedores.length ? item.fornecedores : [newSupplierRow()];
    return Array.isArray(fornecedoresRows) && fornecedoresRows.length ? fornecedoresRows : [newSupplierRow()];
  }, [isStructured, item?.fornecedores, fornecedoresRows]);

  function getVal(tag, fallback = "") {
    if (isStructured) return item?.[tag] ?? fallback;
    return valuesByTag?.[tag] ?? fallback;
  }

  function setVal(tag, v) {
    if (readOnly) return;
    if (isStructured) {
      onItemChange?.(tag, v);
      onClearFieldError?.(tag);
      return;
    }
    onChangeTagValue?.(tag, v);
  }

  function setRequestType(code) {
    if (readOnly) return;
    if (!isStructured) return;

    // se CREATE: limpar campos que ficam ocultos
    if (code === "CREATE") {
      onItemChange?.("request_type_code", "CREATE");
      onItemChange?.(TAGS.codigo_atual, "");
      onItemChange?.(TAGS.novo_codigo, "");
    } else {
      onItemChange?.("request_type_code", "UPDATE");
    }

    onClearFieldError?.(TAGS.codigo_atual);
    onClearFieldError?.(TAGS.novo_codigo);
  }

  function addSupplierRow() {
    if (readOnly) return;
    const next = [...fornecedores, newSupplierRow()];
    if (isStructured) {
      onItemChange?.(TAGS.fornecedores, next); // no structured usamos chave "fornecedores"
      return;
    }
    onChangeFornecedores?.(next);
  }

  function removeSupplierRow(idx) {
    if (readOnly) return;
    const next = fornecedores.filter((_, i) => i !== idx);
    const safe = next.length ? next : [newSupplierRow()];

    if (isStructured) {
      onItemChange?.(TAGS.fornecedores, safe);
    } else {
      onChangeFornecedores?.(safe);
    }
  }

  function setSupplierCell(rowIndex, key, value) {
    if (readOnly) return;

    const next = fornecedores.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r));

    if (isStructured) {
      onItemChange?.(TAGS.fornecedores, next);
      onClearSupplierError?.(rowIndex, key);
      return;
    }
    onChangeFornecedores?.(next);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Tipo (só no structured, porque no details já vem do backend) */}
      {isStructured ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={styles.sectionTitle}>Tipo da solicitação</div>
          <label style={styles.label}>
            <span>Tipo</span>
            <select
              value={item?.request_type_code ?? "CREATE"}
              onChange={(e) => setRequestType(e.target.value)}
              disabled={readOnly}
              style={selectStyle(false)}
            >
              <option value="CREATE">CRIAR</option>
              <option value="UPDATE">ALTERAR</option>
            </select>
          </label>
          <div style={styles.subtle}>Se for “ALTERAR”, o código atual é obrigatório.</div>
        </div>
      ) : null}

      {/* Campos principais */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* UPDATE: codigo_atual/novo_codigo */}
        {isUpdate ? (
          <>
            <label style={styles.label}>
              <span>Código atual</span>
              <input
                value={getVal(TAGS.codigo_atual)}
                onChange={(e) => setVal(TAGS.codigo_atual, e.target.value)}
                disabled={readOnly}
                style={inputStyle(!!fieldErr[TAGS.codigo_atual])}
              />
              {fieldErr[TAGS.codigo_atual] ? <span style={styles.errorText}>{fieldErr[TAGS.codigo_atual]}</span> : null}
            </label>

            <label style={styles.label}>
              <span>Novo código (opcional)</span>
              <input
                value={getVal(TAGS.novo_codigo)}
                onChange={(e) => setVal(TAGS.novo_codigo, e.target.value)}
                disabled={readOnly}
                style={inputStyle(!!fieldErr[TAGS.novo_codigo])}
              />
              {fieldErr[TAGS.novo_codigo] ? <span style={styles.errorText}>{fieldErr[TAGS.novo_codigo]}</span> : null}
            </label>
          </>
        ) : null}

        <label style={styles.label}>
          <span>Grupo</span>
          <input
            value={getVal(TAGS.grupo)}
            onChange={(e) => setVal(TAGS.grupo, e.target.value)}
            disabled={readOnly}
            style={inputStyle(!!fieldErr[TAGS.grupo])}
          />
          {fieldErr[TAGS.grupo] ? <span style={styles.errorText}>{fieldErr[TAGS.grupo]}</span> : null}
        </label>

        <label style={styles.label}>
          <span>Tipo</span>
          <input
            value={getVal(TAGS.tipo)}
            onChange={(e) => setVal(TAGS.tipo, e.target.value)}
            disabled={readOnly}
            style={inputStyle(!!fieldErr[TAGS.tipo])}
          />
          {fieldErr[TAGS.tipo] ? <span style={styles.errorText}>{fieldErr[TAGS.tipo]}</span> : null}
        </label>

        <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
          <span>Descrição</span>
          <input
            value={getVal(TAGS.descricao)}
            onChange={(e) => setVal(TAGS.descricao, e.target.value)}
            disabled={readOnly}
            style={inputStyle(!!fieldErr[TAGS.descricao])}
          />
          {fieldErr[TAGS.descricao] ? <span style={styles.errorText}>{fieldErr[TAGS.descricao]}</span> : null}
        </label>

        <label style={styles.label}>
          <span>Armazém padrão</span>
          <input
            value={getVal(TAGS.armazem_padrao)}
            onChange={(e) => setVal(TAGS.armazem_padrao, e.target.value)}
            disabled={readOnly}
            style={inputStyle(!!fieldErr[TAGS.armazem_padrao])}
          />
          {fieldErr[TAGS.armazem_padrao] ? <span style={styles.errorText}>{fieldErr[TAGS.armazem_padrao]}</span> : null}
        </label>

        <label style={styles.label}>
          <span>Unidade</span>
          <input
            value={getVal(TAGS.unidade)}
            onChange={(e) => setVal(TAGS.unidade, e.target.value)}
            disabled={readOnly}
            style={inputStyle(!!fieldErr[TAGS.unidade])}
          />
          {fieldErr[TAGS.unidade] ? <span style={styles.errorText}>{fieldErr[TAGS.unidade]}</span> : null}
        </label>

        <label style={styles.label}>
          <span>Produto terceiro</span>
          <input
            value={getVal(TAGS.produto_terceiro)}
            onChange={(e) => setVal(TAGS.produto_terceiro, e.target.value)}
            disabled={readOnly}
            style={inputStyle(!!fieldErr[TAGS.produto_terceiro])}
          />
          {fieldErr[TAGS.produto_terceiro] ? <span style={styles.errorText}>{fieldErr[TAGS.produto_terceiro]}</span> : null}
        </label>

        <label style={styles.label}>
          <span>CTA contábil</span>
          <input
            value={getVal(TAGS.cta_contabil)}
            onChange={(e) => setVal(TAGS.cta_contabil, e.target.value)}
            disabled={readOnly}
            style={inputStyle(!!fieldErr[TAGS.cta_contabil])}
          />
          {fieldErr[TAGS.cta_contabil] ? <span style={styles.errorText}>{fieldErr[TAGS.cta_contabil]}</span> : null}
        </label>

        <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
          <span>Ref. cliente</span>
          <input
            value={getVal(TAGS.ref_cliente)}
            onChange={(e) => setVal(TAGS.ref_cliente, e.target.value)}
            disabled={readOnly}
            style={inputStyle(!!fieldErr[TAGS.ref_cliente])}
          />
          {fieldErr[TAGS.ref_cliente] ? <span style={styles.errorText}>{fieldErr[TAGS.ref_cliente]}</span> : null}
        </label>
      </div>

      {/* Fornecedores */}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={styles.sectionTitle}>Fornecedores</div>
          {!readOnly ? (
            <button type="button" onClick={addSupplierRow} style={{ padding: "8px 10px", borderRadius: 10 }}>
              + Linha
            </button>
          ) : null}
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Código</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Loja</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Fornecedor</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Part number</th>
                <th style={{ width: 90, padding: 10, borderBottom: "1px solid var(--border)" }} />
              </tr>
            </thead>

            <tbody>
              {fornecedores.map((r, idx) => {
                const rowErr = suppliersErr?.[idx] || {};
                return (
                  <tr key={idx}>
                    {["supplier_code", "store", "supplier_name", "part_number"].map((k) => (
                      <td key={k} style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                        {readOnly ? (
                          <div style={{ padding: "8px 8px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}>
                            {String(r?.[k] ?? "").trim() ? r[k] : <span style={{ opacity: 0.6 }}>—</span>}
                          </div>
                        ) : (
                          <>
                            <input
                              value={r?.[k] ?? ""}
                              onChange={(e) => setSupplierCell(idx, k, e.target.value)}
                              style={inputStyle(!!rowErr?.[k])}
                            />
                            {rowErr?.[k] ? <div style={styles.errorText}>{rowErr[k]}</div> : null}
                          </>
                        )}
                      </td>
                    ))}

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {!readOnly ? (
                        <button type="button" onClick={() => removeSupplierRow(idx)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                          Remover
                        </button>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={styles.subtle}>Os fornecedores são armazenados em um field JSON (tag: fornecedores).</div>
      </div>
    </div>
  );
}
