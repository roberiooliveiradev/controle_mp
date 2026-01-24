// src/app/ui/requests/RequestItemFields.jsx

import { useMemo } from "react";
import {
  TAGS,
  newSupplierRow,
  REQUEST_TYPE_ID_UPDATE,
  REQUEST_TYPE_ID_CREATE,
} from "./requestItemFields.logic";

import {
  PRODUCT_GROUP_OPTIONS,
  UNIT_OPTIONS,
  WAREHOUSE_OPTIONS,
  YES_NO_OPTIONS,
} from "../../constants/productFields";

import { SUPPLIER_COLUMNS } from "./requestItemFields.schema";

const styles = {
  label: { display: "grid", gap: 6, fontSize: 13, color: "var(--text)" },
  input: { padding: "8px 8px", borderRadius: 6, border: "1px solid var(--border-2)", outline: "none", width:"100%" },
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

export function RequestItemFields({
  variant,
  readOnly = false,

  // ✅ libera SOMENTE o campo novo_codigo (para CREATE) mesmo em readOnly (ADMIN/ANALYST)
  canEditNovoCodigo = false,

  // ✅ novo
  isProduct = false,

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

  // usado no details (variant="fields")
  requestTypeId,
}) {
  const isStructured = variant === "structured";

  const isUpdate = isStructured
    ? item?.request_type_code === "UPDATE"
    : Number(requestTypeId) === REQUEST_TYPE_ID_UPDATE;

  const isCreate = isStructured
    ? item?.request_type_code === "CREATE"
    : Number(requestTypeId) === REQUEST_TYPE_ID_CREATE;

  const fieldErr = errors?.fields || {};
  const suppliersErr = errors?.suppliers || {};

  // edição normal = readOnly false
  const canEditNormal = !readOnly;

  // furo de readOnly SOMENTE pro novo_codigo quando CREATE (details)
  const canEditNovoCodigoField = !!canEditNovoCodigo && !isStructured && isCreate;

  const fornecedores = useMemo(() => {
    if (isStructured) {
      return Array.isArray(item?.fornecedores) && item.fornecedores.length
        ? item.fornecedores
        : [newSupplierRow()];
    }
    return Array.isArray(fornecedoresRows) && fornecedoresRows.length
      ? fornecedoresRows
      : [newSupplierRow()];
  }, [isStructured, item?.fornecedores, fornecedoresRows]);

  function getVal(tag, fallback = "") {
    if (isStructured) return item?.[tag] ?? fallback;
    return valuesByTag?.[tag] ?? fallback;
  }

  function setVal(tag, v) {
    const isSpecialNovoCodigo = tag === TAGS.novo_codigo && canEditNovoCodigoField;

    // regra:
    // - se readOnly: só permite alterar novo_codigo quando CREATE e canEditNovoCodigo=true
    // - se não readOnly: permite tudo (edit normal)
    if (!canEditNormal && !isSpecialNovoCodigo) return;

    // ✅ REGRA: alguns campos sempre em UPPERCASE
    const mustUppercase = tag === TAGS.descricao || tag === TAGS.ref_cliente || true;
    const nextValue = mustUppercase && typeof v === "string" ? v.toUpperCase() : v;

    if (isStructured) {
      onItemChange?.(tag, nextValue);
      onClearFieldError?.(tag);
      return;
    }

    onChangeTagValue?.(tag, nextValue);
    onClearFieldError?.(tag);
  }


  function setRequestType(code) {
    // somente no structured + edit normal
    if (!canEditNormal) return;
    if (!isStructured) return;

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
    // fornecedores seguem sempre o readOnly (ADMIN/ANALYST não mexe aqui)
    if (!canEditNormal) return;

    const next = [...fornecedores, newSupplierRow()];
    if (isStructured) {
      onItemChange?.(TAGS.fornecedores, next);
      return;
    }
    onChangeFornecedores?.(next);
  }

  function removeSupplierRow(idx) {
    if (!canEditNormal) return;

    const next = fornecedores.filter((_, i) => i !== idx);
    const safe = next.length ? next : [newSupplierRow()];

    if (isStructured) onItemChange?.(TAGS.fornecedores, safe);
    else onChangeFornecedores?.(safe);
  }

  function setSupplierCell(rowIndex, key, value) {
    if (!canEditNormal) return;

    // ✅ REGRA: campos de fornecedor sempre em UPPERCASE
    const nextValue = typeof value === "string" ? value.toUpperCase() : value;

    const next = fornecedores.map((r, i) =>
      i === rowIndex ? { ...r, [key]: nextValue } : r
    );

    if (isStructured) {
      onItemChange?.(TAGS.fornecedores, next);
      onClearSupplierError?.(rowIndex, key);
      return;
    }

    onChangeFornecedores?.(next);
    onClearSupplierError?.(rowIndex, key);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Tipo (só no structured) */}
      {isStructured ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={styles.sectionTitle}>Tipo da solicitação</div>
          <label style={styles.label}>
            <span>Tipo</span>
            <select
              value={item?.request_type_code ?? "CREATE"}
              onChange={(e) => setRequestType(e.target.value)}
              disabled={!canEditNormal}
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
        {/* PRODUTO: apenas um campo de código (codigo_atual) */}
        {isProduct ? (
          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            <span>Código</span>
            <input
              value={getVal(TAGS.codigo_atual)}
              disabled={true}
              style={inputStyle(false)}
            />
          </label>
        ) : null}
        {/* CREATE (details): só mostra novo_codigo quando estiver liberado para editar (ADMIN/ANALYST) */}
        {!isStructured && isCreate && canEditNovoCodigoField ? (
          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            <span>Novo código (obrigatório para finalizar CREATE)</span>
            <input
              value={getVal(TAGS.novo_codigo)}
              onChange={(e) => setVal(TAGS.novo_codigo, e.target.value)}
              disabled={!canEditNovoCodigoField}
              style={inputStyle(!!fieldErr[TAGS.novo_codigo])}
            />
            {fieldErr[TAGS.novo_codigo] ? (
              <span style={styles.errorText}>{fieldErr[TAGS.novo_codigo]}</span>
            ) : null}
            <div style={styles.subtle}>
              Em CREATE, este campo é preenchido por ADMIN/ANALYST antes de rejeitar/finalizar.
            </div>
          </label>
        ) : null}

        {/* UPDATE: codigo_atual/novo_codigo */}
        {isUpdate ? (
          <>
            <label style={styles.label}>
              <span>Código atual</span>
              <input
                value={getVal(TAGS.codigo_atual)}
                onChange={(e) => setVal(TAGS.codigo_atual, e.target.value)}
                disabled={!canEditNormal}
                style={inputStyle(!!fieldErr[TAGS.codigo_atual])}
              />
              {fieldErr[TAGS.codigo_atual] ? (
                <span style={styles.errorText}>{fieldErr[TAGS.codigo_atual]}</span>
              ) : null}
            </label>

            <label style={styles.label}>
              <span>Novo código (opcional)</span>
              <input
                value={getVal(TAGS.novo_codigo)}
                onChange={(e) => setVal(TAGS.novo_codigo, e.target.value)}
                disabled={!canEditNormal}
                style={inputStyle(!!fieldErr[TAGS.novo_codigo])}
              />
              {fieldErr[TAGS.novo_codigo] ? (
                <span style={styles.errorText}>{fieldErr[TAGS.novo_codigo]}</span>
              ) : null}
            </label>
          </>
        ) : null}

        <label style={styles.label}>
          <span>Grupo</span>
          <select
            value={getVal(TAGS.grupo)}
            onChange={(e) => setVal(TAGS.grupo, e.target.value)}
            disabled={!canEditNormal}
            style={selectStyle(!!fieldErr[TAGS.grupo])}
          >
            <option value="">Selecione</option>
            {PRODUCT_GROUP_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.text}
              </option>
            ))}
          </select>
          {fieldErr[TAGS.grupo] && <span style={styles.errorText}>{fieldErr[TAGS.grupo]}</span>}
        </label>

        <label style={styles.label}>
          <span>Tipo</span>
          <input
            value={getVal(TAGS.tipo)}
            onChange={(e) => setVal(TAGS.tipo, e.target.value)}
            disabled={!canEditNormal}
            style={inputStyle(!!fieldErr[TAGS.tipo])}
          />
          {fieldErr[TAGS.tipo] && (
            <span style={styles.errorText}>{fieldErr[TAGS.tipo]}</span>
          )}
        </label>

        <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
          <span>Descrição</span>
          <input
            value={getVal(TAGS.descricao)}
            onChange={(e) => setVal(TAGS.descricao, e.target.value)}
            disabled={!canEditNormal}
            style={inputStyle(!!fieldErr[TAGS.descricao])}
          />
          {fieldErr[TAGS.descricao] ? <span style={styles.errorText}>{fieldErr[TAGS.descricao]}</span> : null}
        </label>

        <label style={styles.label}>
          <span>Armazém padrão</span>
          <select
            value={getVal(TAGS.armazem_padrao)}
            onChange={(e) => setVal(TAGS.armazem_padrao, e.target.value)}
            disabled={!canEditNormal}
            style={selectStyle(!!fieldErr[TAGS.armazem_padrao])}
          >
            <option value="">Selecione</option>
            {WAREHOUSE_OPTIONS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.text}
              </option>
            ))}
          </select>

          {fieldErr[TAGS.armazem_padrao] && (
            <span style={styles.errorText}>{fieldErr[TAGS.armazem_padrao]}</span>
          )}
        </label>

        <label style={styles.label}>
          <span>Unidade</span>
          <select
            value={getVal(TAGS.unidade)}
            onChange={(e) => setVal(TAGS.unidade, e.target.value)}
            disabled={!canEditNormal}
            style={selectStyle(!!fieldErr[TAGS.unidade])}
          >
            <option value="">Selecione</option>
            {UNIT_OPTIONS.map((u, idx) => (
              <option key={`${u.value}-${idx}`} value={u.value}>
                {u.text}
              </option>
            ))}
          </select>

          {fieldErr[TAGS.unidade] && (
            <span style={styles.errorText}>{fieldErr[TAGS.unidade]}</span>
          )}
        </label>

        <label style={styles.label}>
          <span>Produto terceiro</span>
          <select
            value={getVal(TAGS.produto_terceiro)}
            onChange={(e) => setVal(TAGS.produto_terceiro, e.target.value)}
            disabled={!canEditNormal}
            style={selectStyle(!!fieldErr[TAGS.produto_terceiro])}
          >
            {YES_NO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.text}
              </option>
            ))}
          </select>
          {fieldErr[TAGS.produto_terceiro] && <span style={styles.errorText}>{fieldErr[TAGS.produto_terceiro]}</span>}
        </label>

        <label style={styles.label}>
          <span>CTA contábil</span>
          <input
            value={getVal(TAGS.cta_contabil)}
            onChange={(e) => setVal(TAGS.cta_contabil, e.target.value)}
            disabled={!canEditNormal}
            style={inputStyle(!!fieldErr[TAGS.cta_contabil])}
          />
          {fieldErr[TAGS.cta_contabil] ? <span style={styles.errorText}>{fieldErr[TAGS.cta_contabil]}</span> : null}
        </label>

        <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
          <span>Ref. cliente</span>
          <input
            value={getVal(TAGS.ref_cliente)}
            onChange={(e) => setVal(TAGS.ref_cliente, e.target.value)}
            disabled={!canEditNormal}
            style={inputStyle(!!fieldErr[TAGS.ref_cliente])}
          />
          {fieldErr[TAGS.ref_cliente] ? <span style={styles.errorText}>{fieldErr[TAGS.ref_cliente]}</span> : null}
        </label>
      </div>

      {/* Fornecedores */}
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={styles.sectionTitle}>Fornecedores</div>
          {canEditNormal ? (
            <button
              type="button"
              onClick={addSupplierRow}
              style={{ padding: "8px 10px", borderRadius: 10 }}
            >
              + Linha
            </button>
          ) : null}
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {SUPPLIER_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderBottom: "1px solid var(--border)",
                      width: c.width,
                    }}
                  >
                    {c.header}
                  </th>
                ))}

                <th style={{ width: 90, padding: 10, borderBottom: "1px solid var(--border)" }} />
              </tr>
            </thead>

            <tbody>
              {fornecedores.map((r, idx) => {
                const rowErr = suppliersErr?.[idx] || {};

                return (
                  <tr key={idx}>
                    {SUPPLIER_COLUMNS.map((c) => (
                      <td key={c.key} style={{ padding: 10, borderBottom: "1px solid var(--border)"}}>
                        {!canEditNormal ? (
                          <div
                            style={{
                              padding: "8px 8px",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "var(--surface)",
                            }}
                          >
                            {String(r?.[c.key] ?? "").trim() ? (
                              r[c.key]
                            ) : (
                              <span style={{ opacity: 0.6 }}>—</span>
                            )}
                          </div>
                        ) : (
                          <>
                            <input
                              type={c.inputType ?? "text"}
                              value={r?.[c.key] ?? ""}
                              placeholder={c.placeholder ?? ""}
                              onChange={(e) => setSupplierCell(idx, c.key, e.target.value)}
                              style={inputStyle(!!rowErr?.[c.key])}
                            />
                            {rowErr?.[c.key] ? <div style={styles.errorText}>{rowErr[c.key]}</div> : null}
                          </>
                        )}
                      </td>
                    ))}

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {canEditNormal ? (
                        <button
                          type="button"
                          onClick={() => removeSupplierRow(idx)}
                          style={{ padding: "8px 10px", borderRadius: 10 }}
                        >
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

        <div style={styles.subtle}>
          Os fornecedores são armazenados em um field JSON (tag: fornecedores).
        </div>
      </div>

    </div>
  );
}
