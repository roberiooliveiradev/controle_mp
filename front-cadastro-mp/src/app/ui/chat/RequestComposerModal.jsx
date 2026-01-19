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

function pushTextField(fields, tag, value) {
  const v = (value ?? "").toString().trim();
  if (!v) return;
  fields.push({ field_type_id: FIELD_TYPE_ID_TEXT, field_tag: tag, field_value: v, field_flag: null });
}

export function RequestComposerModal({ onClose, onSubmit }) {
  const [items, setItems] = useState([newItem()]);
  const [activeIndex, setActiveIndex] = useState(0);

  const active = items[activeIndex];
  const canSubmit = useMemo(() => items.length > 0, [items.length]);

  function setField(key, value) {
    setItems((prev) => prev.map((it, idx) => (idx === activeIndex ? { ...it, [key]: value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()]);
    setActiveIndex(items.length);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setActiveIndex((prev) => {
      if (idx === prev) return 0;
      if (idx < prev) return prev - 1;
      return prev;
    });
  }

  function addSupplierRow() {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === activeIndex ? { ...it, fornecedores: [...(it.fornecedores || []), newSupplierRow()] } : it
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
  }

  function setSupplierCell(rowIndex, key, value) {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== activeIndex) return it;
        const rows = (it.fornecedores || []).map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r));
        return { ...it, fornecedores: rows };
      })
    );
  }

  async function submit() {
    const requestItems = items.map((it) => {
      const fields = [];

      pushTextField(fields, "codigo_atual", it.codigo_atual);
      pushTextField(fields, "grupo", it.grupo);
      pushTextField(fields, "novo_codigo", it.novo_codigo);
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
      <div style={{ width: "min(1100px, 100%)", background: "#fff", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
          <strong>Nova Request</strong>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="button" onClick={submit} disabled={!canSubmit}>Enviar</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 520 }}>
          <aside style={{ borderRight: "1px solid #eee", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong>Itens</strong>
              <button type="button" onClick={addItem}>+ Item</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "auto", maxHeight: 460 }}>
              {items.map((it, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  style={{
                    border: idx === activeIndex ? "2px solid #777" : "1px solid #ddd",
                    borderRadius: 12,
                    padding: 10,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>Item #{idx + 1}</div>
                    {items.length > 1 ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(idx); }}>
                        Remover
                      </button>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {it.request_type_code} • {it.descricao ? it.descricao.slice(0, 40) : "Sem descrição"}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main style={{ padding: 12, overflow: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10 }}>
              <label>
                Tipo de solicitação
                <select value={active.request_type_code} onChange={(e) => setField("request_type_code", e.target.value)}>
                  <option value="CREATE">CRIAR</option>
                  <option value="UPDATE">ALTERAR</option>
                </select>
              </label>

              <label>
                Código atual
                <input value={active.codigo_atual} onChange={(e) => setField("codigo_atual", e.target.value)} />
              </label>

              <label>
                Grupo
                <input value={active.grupo} onChange={(e) => setField("grupo", e.target.value)} />
              </label>

              <label>
                Novo código
                <input value={active.novo_codigo} onChange={(e) => setField("novo_codigo", e.target.value)} />
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                Descrição
                <input value={active.descricao} onChange={(e) => setField("descricao", e.target.value)} />
              </label>

              <label>
                Tipo
                <input value={active.tipo} onChange={(e) => setField("tipo", e.target.value)} />
              </label>

              <label>
                Armazém padrão
                <input value={active.armazem_padrao} onChange={(e) => setField("armazem_padrao", e.target.value)} />
              </label>

              <label>
                Unidade
                <input value={active.unidade} onChange={(e) => setField("unidade", e.target.value)} />
              </label>

              <label>
                Produto de 3º?
                <input value={active.produto_terceiro} onChange={(e) => setField("produto_terceiro", e.target.value)} />
              </label>

              <label>
                Cta. Contábil
                <input value={active.cta_contabil} onChange={(e) => setField("cta_contabil", e.target.value)} />
              </label>

              <label>
                Ref. Cliente
                <input value={active.ref_cliente} onChange={(e) => setField("ref_cliente", e.target.value)} />
              </label>
            </div>

            <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Fornecedores</strong>
                <button type="button" onClick={addSupplierRow}>+ Linha</button>
              </div>

              <div style={{ marginTop: 10, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Código</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Loja</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Nome</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Part. Number</th>
                      <th style={{ borderBottom: "1px solid #eee", padding: 8 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {(active.fornecedores || []).map((r, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: 8 }}>
                          <input value={r.supplier_code} onChange={(e) => setSupplierCell(idx, "supplier_code", e.target.value)} />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input value={r.store} onChange={(e) => setSupplierCell(idx, "store", e.target.value)} />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input value={r.supplier_name} onChange={(e) => setSupplierCell(idx, "supplier_name", e.target.value)} />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input value={r.part_number} onChange={(e) => setSupplierCell(idx, "part_number", e.target.value)} />
                        </td>
                        <td style={{ padding: 8 }}>
                          <button type="button" onClick={() => removeSupplierRow(idx)}>Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
