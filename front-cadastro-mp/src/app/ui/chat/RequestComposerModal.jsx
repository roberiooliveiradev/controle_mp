// src/app/ui/chat/RequestComposerModal.jsx
import { useMemo, useState } from "react";

/**
 * AJUSTE ESSES IDS CONFORME SEEDS DO SEU BANCO
 * - request_type_id: CREATE/UPDATE
 * - request_status_id: OPEN
 * - field_type_id: TEXT/JSON
 */
const REQUEST_TYPE_ID_CREATE = 1;
const REQUEST_TYPE_ID_UPDATE = 2;
const REQUEST_STATUS_ID_OPEN = 1;

const FIELD_TYPE_ID_TEXT = 1;
const FIELD_TYPE_ID_JSON = 2;

function newSupplierRow() {
  return { supplier_code: "", store: "", supplier_name: "", part_number: "" };
}

function newItem() {
  return {
    request_type_code: "CREATE", // CREATE | UPDATE (UI)
    codigo_atual: "",
    grupo: "",
    novo_codigo: "",
    descricao: "",
    tipo: "",
    armazem_padrao: "",
    unidade: "",
    produto_terceiro: "",
    cta_contabil: "",
    ref_cliente: "",
    fornecedores: [newSupplierRow()],
  };
}

function toRequestTypeId(code) {
  return code === "UPDATE" ? REQUEST_TYPE_ID_UPDATE : REQUEST_TYPE_ID_CREATE;
}

function isBlank(v) {
  return !String(v ?? "").trim();
}

function pushTextField(fields, tag, value) {
  const v = String(value ?? "").trim();
  if (!v) return;
  fields.push({
    field_type_id: FIELD_TYPE_ID_TEXT,
    field_tag: tag,
    field_value: v,
    field_flag: null,
  });
}

const styles = {
  label: {
    display: "grid",
    gap: 6,
    fontSize: 13,
    color: "#111",
  },
  input: {
    padding: "8px 8px",
    borderRadius: 6,
    border: "1px solid #ddd",
    outline: "none",
  },
  select: {
    padding: "8px 8px",
    borderRadius: 6,
    border: "1px solid #ddd",
    outline: "none",
    background: "#fff",
  },
  sectionTitle: { fontWeight: 800, marginBottom: 8 },
  subtle: { fontSize: 12, opacity: 0.75 },
  pill: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid #eee",
    background: "#fafafa",
  },
  errorText: {
    fontSize: 12,
    color: "#b42318",
    marginTop: 4,
    lineHeight: 1.2,
  },
  itemErrorBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "#fee4e2",
    color: "#b42318",
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #fecdca",
  },
};

function inputStyle(hasError) {
  if (!hasError) return styles.input;
  return {
    ...styles.input,
    border: "1px solid #f04438",
    boxShadow: "0 0 0 3px rgba(240,68,56,0.15)",
  };
}

function selectStyle(hasError) {
  if (!hasError) return styles.select;
  return {
    ...styles.select,
    border: "1px solid #f04438",
    boxShadow: "0 0 0 3px rgba(240,68,56,0.15)",
  };
}

export function RequestComposerModal({ onClose, onSubmit }) {
  const [items, setItems] = useState([newItem()]);
  const [activeIndex, setActiveIndex] = useState(0);

  /**
   * errors shape:
   * {
   *   [itemIndex]: {
   *     fields: { [fieldKey]: "mensagem" },
   *     suppliers: { [rowIndex]: { [colKey]: "mensagem" } }
   *   }
   * }
   */
  const [errors, setErrors] = useState({});

  const active = items[activeIndex];
  const canSubmit = useMemo(() => items.length > 0, [items.length]);

  const isUpdate = active?.request_type_code === "UPDATE";

  function getItemErrors(idx) {
    return errors?.[idx] || { fields: {}, suppliers: {} };
  }

  function itemHasAnyError(idx) {
    const itErr = getItemErrors(idx);
    const fieldsCount = Object.keys(itErr.fields || {}).length;
    const suppliersObj = itErr.suppliers || {};
    const suppliersCount = Object.values(suppliersObj).reduce(
      (acc, row) => acc + Object.keys(row || {}).length,
      0
    );
    return fieldsCount + suppliersCount > 0;
  }

  function clearFieldError(itemIdx, key) {
    setErrors((prev) => {
      const cur = prev?.[itemIdx];
      if (!cur?.fields?.[key]) return prev;

      const nextFields = { ...(cur.fields || {}) };
      delete nextFields[key];

      return {
        ...prev,
        [itemIdx]: { ...(cur || {}), fields: nextFields, suppliers: cur.suppliers || {} },
      };
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

      return {
        ...prev,
        [itemIdx]: { ...(cur || {}), fields: cur.fields || {}, suppliers: nextSuppliers },
      };
    });
  }

  function setField(key, value) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === activeIndex ? { ...it, [key]: value } : it))
    );
    clearFieldError(activeIndex, key);
  }

  function setRequestType(code) {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== activeIndex) return it;

        // ✅ CRIAR: ocultar e limpar codigo_atual/novo_codigo
        if (code === "CREATE") {
          return { ...it, request_type_code: "CREATE", codigo_atual: "", novo_codigo: "" };
        }

        return { ...it, request_type_code: "UPDATE" };
      })
    );

    // limpa erros desses campos ao trocar tipo
    clearFieldError(activeIndex, "codigo_atual");
    clearFieldError(activeIndex, "novo_codigo");
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()]);
    setActiveIndex(items.length);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setErrors((prev) => {
      // reindexa erros após remoção
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

  function addSupplierRow() {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === activeIndex
          ? { ...it, fornecedores: [...(it.fornecedores || []), newSupplierRow()] }
          : it
      )
    );
  }

  function removeSupplierRow(rowIndex) {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== activeIndex) return it;
        const next = (it.fornecedores || []).filter((_, i) => i !== rowIndex);
        return { ...it, fornecedores: next.length ? next : [newSupplierRow()] };
      })
    );

    // remove erros daquela linha e reindexa linhas seguintes
    setErrors((prev) => {
      const cur = prev?.[activeIndex];
      if (!cur?.suppliers) return prev;

      const nextSuppliers = {};
      Object.keys(cur.suppliers).forEach((k) => {
        const i = Number(k);
        if (Number.isNaN(i)) return;
        if (i === rowIndex) return;
        const newKey = i > rowIndex ? i - 1 : i;
        nextSuppliers[newKey] = cur.suppliers[i];
      });

      return {
        ...prev,
        [activeIndex]: { fields: cur.fields || {}, suppliers: nextSuppliers },
      };
    });
  }

  function setSupplierCell(rowIndex, key, value) {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== activeIndex) return it;
        const rows = (it.fornecedores || []).map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r));
        return { ...it, fornecedores: rows };
      })
    );
    clearSupplierError(activeIndex, rowIndex, key);
  }

  function validateAll() {
    const nextErrors = {};

    items.forEach((it, idx) => {
      const fields = {};
      const suppliers = {};

      const update = it.request_type_code === "UPDATE";

      // ✅ ALTERAR: codigo_atual obrigatório
      if (update && isBlank(it.codigo_atual)) fields.codigo_atual = "Informe o código atual.";

      // ✅ CRIAR: codigo_atual/novo_codigo ocultos e não required (não validamos)
      // ✅ Demais campos: sempre required
      if (isBlank(it.grupo)) fields.grupo = "Campo obrigatório.";
      if (isBlank(it.descricao)) fields.descricao = "Campo obrigatório.";
      if (isBlank(it.tipo)) fields.tipo = "Campo obrigatório.";
      if (isBlank(it.armazem_padrao)) fields.armazem_padrao = "Campo obrigatório.";
      if (isBlank(it.unidade)) fields.unidade = "Campo obrigatório.";
      if (isBlank(it.produto_terceiro)) fields.produto_terceiro = "Campo obrigatório.";
      if (isBlank(it.cta_contabil)) fields.cta_contabil = "Campo obrigatório.";
      if (isBlank(it.ref_cliente)) fields.ref_cliente = "Campo obrigatório.";

      // fornecedores (todas colunas obrigatórias)
      const rows = Array.isArray(it.fornecedores) ? it.fornecedores : [];
      rows.forEach((r, rIdx) => {
        const rowErr = {};
        if (isBlank(r.supplier_code)) rowErr.supplier_code = "Obrigatório.";
        if (isBlank(r.store)) rowErr.store = "Obrigatório.";
        if (isBlank(r.supplier_name)) rowErr.supplier_name = "Obrigatório.";
        if (isBlank(r.part_number)) rowErr.part_number = "Obrigatório.";
        if (Object.keys(rowErr).length) suppliers[rIdx] = rowErr;
      });

      if (Object.keys(fields).length || Object.keys(suppliers).length) {
        nextErrors[idx] = { fields, suppliers };
      }
    });

    return nextErrors;
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

    const requestItems = items.map((it) => {
      const fields = [];
      const isUpdateItem = it.request_type_code === "UPDATE";

      // ✅ só enviar codigo_atual/novo_codigo se for ALTERAR
      if (isUpdateItem) {
        pushTextField(fields, "codigo_atual", it.codigo_atual);
        // "novo_codigo" não é obrigatório: só manda se tiver preenchido
        pushTextField(fields, "novo_codigo", it.novo_codigo);
      }

      pushTextField(fields, "grupo", it.grupo);
      pushTextField(fields, "descricao", it.descricao);
      pushTextField(fields, "tipo", it.tipo);
      pushTextField(fields, "armazem_padrao", it.armazem_padrao);
      pushTextField(fields, "unidade", it.unidade);
      pushTextField(fields, "produto_terceiro", it.produto_terceiro);
      pushTextField(fields, "cta_contabil", it.cta_contabil);
      pushTextField(fields, "ref_cliente", it.ref_cliente);

      // fornecedores como snapshot JSON
      const fornecedores = Array.isArray(it.fornecedores) ? it.fornecedores : [];
      fields.push({
        field_type_id: FIELD_TYPE_ID_JSON,
        field_tag: "fornecedores",
        field_value: JSON.stringify(fornecedores),
        field_flag: null,
      });

      return {
        request_type_id: toRequestTypeId(it.request_type_code),
        request_status_id: REQUEST_STATUS_ID_OPEN,
        product_id: null,
        fields,
      };
    });

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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid #eee",
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
            <button type="button" onClick={onClose} style={{ padding: "8px 12px", borderRadius: 10 }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              Enviar
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: 560, maxHeight: "90dvh" }}>
          {/* Items list */}
          <aside style={{ borderRight: "1px solid #eee", padding: 12, background: "#fcfcfc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong>Itens</strong>
              <button type="button" onClick={addItem} style={{ padding: "8px 10px", borderRadius: 10 }}>
                + Item
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "auto", maxHeight: 500 }}>
              {items.map((it, idx) => {
                const isActive = idx === activeIndex;
                const hasErr = itemHasAnyError(idx);

                return (
                  <div
                    key={idx}
                    onClick={() => setActiveIndex(idx)}
                    style={{
                      border: hasErr ? "2px solid #f04438" : isActive ? "2px solid #777" : "1px solid #ddd",
                      borderRadius: 12,
                      padding: 10,
                      cursor: "pointer",
                      background: "#fff", 
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontWeight: isActive ? 800 : 500  }}>Item #{idx + 1}</div>
                        {hasErr ? <span title="Há campos obrigatórios faltando" style={styles.itemErrorBadge}>!</span> : null}
                      </div>

                      {items.length > 1 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(idx);
                          }}
                          style={{ padding: "6px 10px", borderRadius: 10 }}
                        >
                          Remover
                        </button>
                      ) : null}
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

          {/* Form */}
          <main style={{ padding: 16, overflow: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
                alignItems: "start",
              }}
            >
              <label style={styles.label}>
                Tipo de solicitação
                <select
                  value={active.request_type_code}
                  onChange={(e) => setRequestType(e.target.value)}
                  style={selectStyle(Boolean(activeErr?.fields?.request_type_code))}
                >
                  <option value="CREATE">CRIAR</option>
                  <option value="UPDATE">ALTERAR</option>
                </select>
                {activeErr?.fields?.request_type_code ? <div style={styles.errorText}>{activeErr.fields.request_type_code}</div> : null}
              </label>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                {isUpdate ? (
                  <div style={styles.subtle}>
                    No tipo <b>ALTERAR</b>, informe o <b>código atual</b>. O novo código apenas quando necessário.
                  </div>
                ) : (
                  <div style={styles.subtle}>
                    No tipo <b>CRIAR</b>, <b>código atual</b> e <b>novo código</b> ficam ocultos.
                  </div>
                )}
              </div>

              {/* ✅ Só aparece quando ALTERAR */}
              {isUpdate ? (
                <>
                  <label style={styles.label}>
                    Código atual
                    <input
                      value={active.codigo_atual}
                      onChange={(e) => setField("codigo_atual", e.target.value)}
                      style={inputStyle(Boolean(activeErr?.fields?.codigo_atual))}
                    />
                    {activeErr?.fields?.codigo_atual ? <div style={styles.errorText}>{activeErr.fields.codigo_atual}</div> : null}
                  </label>

                  <label style={styles.label}>
                    Novo código
                    <input
                      value={active.novo_codigo}
                      onChange={(e) => setField("novo_codigo", e.target.value)}
                      style={inputStyle(Boolean(activeErr?.fields?.novo_codigo))}
                    />
                    {activeErr?.fields?.novo_codigo ? <div style={styles.errorText}>{activeErr.fields.novo_codigo}</div> : null}
                  </label>
                </>
              ) : null}

              <label style={styles.label}>
                Grupo
                <input value={active.grupo} onChange={(e) => setField("grupo", e.target.value)} style={inputStyle(Boolean(activeErr?.fields?.grupo))} />
                {activeErr?.fields?.grupo ? <div style={styles.errorText}>{activeErr.fields.grupo}</div> : null}
              </label>

              <label style={styles.label}>
                Tipo
                <input value={active.tipo} onChange={(e) => setField("tipo", e.target.value)} style={inputStyle(Boolean(activeErr?.fields?.tipo))} />
                {activeErr?.fields?.tipo ? <div style={styles.errorText}>{activeErr.fields.tipo}</div> : null}
              </label>

              <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
                Descrição
                <input
                  value={active.descricao}
                  onChange={(e) => setField("descricao", e.target.value)}
                  style={inputStyle(Boolean(activeErr?.fields?.descricao))}
                />
                {activeErr?.fields?.descricao ? <div style={styles.errorText}>{activeErr.fields.descricao}</div> : null}
              </label>

              <label style={styles.label}>
                Armazém padrão
                <input
                  value={active.armazem_padrao}
                  onChange={(e) => setField("armazem_padrao", e.target.value)}
                  style={inputStyle(Boolean(activeErr?.fields?.armazem_padrao))}
                />
                {activeErr?.fields?.armazem_padrao ? <div style={styles.errorText}>{activeErr.fields.armazem_padrao}</div> : null}
              </label>

              <label style={styles.label}>
                Unidade
                <input value={active.unidade} onChange={(e) => setField("unidade", e.target.value)} style={inputStyle(Boolean(activeErr?.fields?.unidade))} />
                {activeErr?.fields?.unidade ? <div style={styles.errorText}>{activeErr.fields.unidade}</div> : null}
              </label>

              <label style={styles.label}>
                Produto de 3º?
                <input
                  value={active.produto_terceiro}
                  onChange={(e) => setField("produto_terceiro", e.target.value)}
                  style={inputStyle(Boolean(activeErr?.fields?.produto_terceiro))}
                />
                {activeErr?.fields?.produto_terceiro ? <div style={styles.errorText}>{activeErr.fields.produto_terceiro}</div> : null}
              </label>

              <label style={styles.label}>
                Cta. Contábil
                <input
                  value={active.cta_contabil}
                  onChange={(e) => setField("cta_contabil", e.target.value)}
                  style={inputStyle(Boolean(activeErr?.fields?.cta_contabil))}
                />
                {activeErr?.fields?.cta_contabil ? <div style={styles.errorText}>{activeErr.fields.cta_contabil}</div> : null}
              </label>

              <label style={styles.label}>
                Ref. Cliente
                <input
                  value={active.ref_cliente}
                  onChange={(e) => setField("ref_cliente", e.target.value)}
                  style={inputStyle(Boolean(activeErr?.fields?.ref_cliente))}
                />
                {activeErr?.fields?.ref_cliente ? <div style={styles.errorText}>{activeErr.fields.ref_cliente}</div> : null}
              </label>
            </div>

            {/* Suppliers */}
            <div style={{ marginTop: 18, borderTop: "1px solid #eee", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={styles.sectionTitle}>Fornecedores</div>
                  <div style={styles.subtle}>Todas as colunas são obrigatórias.</div>
                </div>
                <button type="button" onClick={addSupplierRow} style={{ padding: "8px 10px", borderRadius: 10 }}>
                  + Linha
                </button>
              </div>

              {/* ✅ Scroll interno (não cresce o modal) */}
              <div
                style={{
                  marginTop: 10,
                  border: "1px solid #eee",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <div style={{ maxHeight: 260, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        {[
                          ["Código", 150],
                          ["Loja", 130],
                          ["Nome", 220],
                          ["Part. Number", 160],
                        ].map(([t, w]) => (
                          <th
                            key={t}
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #eee",
                              padding: 10,
                              minWidth: w,
                              position: "sticky",
                              top: 0,
                              background: "#fafafa",
                              zIndex: 1,
                            }}
                          >
                            {t}
                          </th>
                        ))}
                        <th
                          style={{
                            borderBottom: "1px solid #eee",
                            padding: 10,
                            width: 110,
                            position: "sticky",
                            top: 0,
                            background: "#fafafa",
                            zIndex: 1,
                          }}
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {(active.fornecedores || []).map((r, idx) => {
                        const rowErr = activeErr?.suppliers?.[idx] || {};
                        return (
                          <tr key={idx}>
                            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                              <input
                                value={r.supplier_code}
                                onChange={(e) => setSupplierCell(idx, "supplier_code", e.target.value)}
                                style={inputStyle(Boolean(rowErr?.supplier_code))}
                              />
                              {rowErr?.supplier_code ? <div style={styles.errorText}>{rowErr.supplier_code}</div> : null}
                            </td>

                            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                              <input
                                value={r.store}
                                onChange={(e) => setSupplierCell(idx, "store", e.target.value)}
                                style={inputStyle(Boolean(rowErr?.store))}
                              />
                              {rowErr?.store ? <div style={styles.errorText}>{rowErr.store}</div> : null}
                            </td>

                            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                              <input
                                value={r.supplier_name}
                                onChange={(e) => setSupplierCell(idx, "supplier_name", e.target.value)}
                                style={inputStyle(Boolean(rowErr?.supplier_name))}
                              />
                              {rowErr?.supplier_name ? <div style={styles.errorText}>{rowErr.supplier_name}</div> : null}
                            </td>

                            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                              <input
                                value={r.part_number}
                                onChange={(e) => setSupplierCell(idx, "part_number", e.target.value)}
                                style={inputStyle(Boolean(rowErr?.part_number))}
                              />
                              {rowErr?.part_number ? <div style={styles.errorText}>{rowErr.part_number}</div> : null}
                            </td>

                            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                              <button
                                type="button"
                                onClick={() => removeSupplierRow(idx)}
                                style={{ padding: "8px 10px", borderRadius: 10 }}
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                Fornecedores são armazenados como snapshot JSON no field_tag="fornecedores".
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
