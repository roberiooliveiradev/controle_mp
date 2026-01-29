// src/app/ui/requests/RequestItemFields.jsx

import { useMemo, useState, useEffect, useRef } from "react";

import { getTotvsByProductCodeApi } from "../../api/requestsApi";

import {
  TAGS,
  newSupplierRow,
  newStructuredItem,
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

  // libera SOMENTE o campo novo_codigo (para CREATE) mesmo em readOnly (ADMIN/ANALYST)
  canEditNovoCodigo = false,

  // produtos
  isProduct = false,

  // flags
  byTag = null,                 // { [tag]: { id, field_flag, ... } }
  canEditFlags = false,         // bool
  onSetFieldFlag = null,        // (fieldId:number, nextFlag:string|null, tag:string)=>Promise|void

  // ---------- structured ----------
  item,
  itemKey, 
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

const [flagModal, setFlagModal] = useState({
    open: false,
    tag: null,
    fieldId: null,
    fieldLabel: "",
    fieldValuePreview: "",
    value: "",
    saving: false,
    error: "",
  });

  function closeFlagModal() {
    setFlagModal((s) => ({ ...s, open: false, tag: null, fieldId: null, error: "" }));
  }

  const isStructured = variant === "structured";

  const isUpdate =
    !isProduct &&
    (isStructured
      ? item?.request_type_code === "UPDATE"
      : Number(requestTypeId) === REQUEST_TYPE_ID_UPDATE);

  const isCreate =
    !isProduct &&
    (isStructured
      ? item?.request_type_code === "CREATE"
      : Number(requestTypeId) === REQUEST_TYPE_ID_CREATE);

  const fieldErr = errors?.fields || {};
  const suppliersErr = errors?.suppliers || {};

  // edição normal = readOnly false
  const canEditNormal = !readOnly;

  // furo de readOnly SOMENTE pro novo_codigo quando CREATE (details)
  const canEditNovoCodigoField = !isProduct && !!canEditNovoCodigo && !isStructured && isCreate;

  // Dados do TOTVS
  const [autoFillBusy, setAutoFillBusy] = useState(false);
  const [autoFillError, setAutoFillError] = useState("");
  const lastFetchedCodeRef = useRef("");
  
  const TOTVS_DEPENDENT_TAGS = [
    TAGS.grupo,
    TAGS.tipo,
    TAGS.descricao,
    TAGS.armazem_padrao,
    TAGS.unidade,
    TAGS.produto_terceiro,
    TAGS.ref_cliente,
    TAGS.cta_contabil,
    TAGS.fornecedores,
  ];

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

  function normalizeValue(value) {
    if (typeof value === "string") {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value.map((v) => normalizeValue(v));
    }

    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((k) => {
        out[k] = normalizeValue(value[k]);
      });
      return out;
    }

    return value;
  }

  function normalizeValueForTyping(value) {
    if (typeof value === "string") return value; // ✅ não trim aqui
    if (Array.isArray(value)) return value.map(normalizeValueForTyping);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((k) => (out[k] = normalizeValueForTyping(value[k])));
      return out;
    }
    return value;
  }




  const key = String(itemKey ?? "default");

  const lastFetchedByKeyRef = useRef(new Map()); // key -> code
  const prevCodeByKeyRef = useRef(new Map());    // key -> code
  const dirtyByKeyRef = useRef(new Map());       // key -> Set(tags)
  const isApplyingTotvsRef = useRef(false);

  // ✅ marca que o usuário realmente digitou/colou o código (por item)
  const codeUserIntentByKeyRef = useRef(new Map()); // key -> boolean


  function getDirtySet() {
    if (!dirtyByKeyRef.current.has(key)) dirtyByKeyRef.current.set(key, new Set());
    return dirtyByKeyRef.current.get(key);
  }

  function markDirty(tag) {
    if (isApplyingTotvsRef.current) return; // não marcar dirty no auto-fill
    getDirtySet().add(tag);
  }

  function isDirty(tag) {
    return getDirtySet().has(tag);
  }

  function resetTotvsContextForThisItem(nextCode = "") {
    const dirtySet = getDirtySet();

    // ✅ limpa dirty de tudo que o TOTVS controla
    TOTVS_DEPENDENT_TAGS.forEach((tag) => dirtySet.delete(tag));

    // ✅ também limpa dirty do próprio código atual (pra não “travar”)
    dirtySet.delete(TAGS.codigo_atual);

    // ✅ reseta cache por item (permite nova busca)
    lastFetchedByKeyRef.current.delete(key);

    // ✅ atualiza o prevCode pra refletir o que o usuário acabou de digitar
    prevCodeByKeyRef.current.set(key, String(nextCode || "").trim());
  }


  function setVal(tag, v) {
    const isSpecialNovoCodigo = tag === TAGS.novo_codigo && canEditNovoCodigoField;

    // regra:
    // - se readOnly: só permite alterar novo_codigo quando CREATE e canEditNovoCodigo=true
    // - se não readOnly: permite tudo (edit normal)
    if (!canEditNormal && !isSpecialNovoCodigo) return;

    // ✅ REGRA: alguns campos sempre em UPPERCASE
    const mustUppercase = true;

    let nextValue = normalizeValueForTyping(v);

    if (mustUppercase && typeof nextValue === "string") {
      nextValue = nextValue.toUpperCase();
    }

    markDirty(tag);

    if (isStructured) {
      onItemChange?.(tag, nextValue);
      onClearFieldError?.(tag);
      return;
    }

    onChangeTagValue?.(tag, nextValue);
    onClearFieldError?.(tag);
  }
  
  function setFornecedores(nextRows) {
    // respeita readOnly
    if (!canEditNormal) return;

    // fornecedores também contam como "dirty"
    markDirty(TAGS.fornecedores);

    const safe = Array.isArray(nextRows) && nextRows.length ? nextRows : [newSupplierRow()];

    if (isStructured) onItemChange?.(TAGS.fornecedores, safe);
    else onChangeFornecedores?.(safe);

    // ✅ limpa erro do campo fornecedores
    onClearFieldError?.(TAGS.fornecedores);

    // ✅ limpa erros por célula (supplier_code/store/supplier_name/part_number)
    safe.forEach((_, idx) => {
      SUPPLIER_COLUMNS.forEach((c) => {
        onClearSupplierError?.(idx, c.key);
      });
    });
  }

  useEffect(() => {
    if (!isUpdate) return;
    if (!canEditNormal) return;

    const code = String(getVal(TAGS.codigo_atual, "") || "").trim();
    setAutoFillError("");

    const userIntent = codeUserIntentByKeyRef.current.get(key) === true;
    if (!userIntent) return;
    codeUserIntentByKeyRef.current.set(key, false);

    if (!code) return;

    const lastFetched = lastFetchedByKeyRef.current.get(key) || "";

    // se já buscou esse mesmo código para este item, não repete
    if (code === lastFetched) return;

    const handle = setTimeout(async () => {
      try {
        setAutoFillBusy(true);
        setAutoFillError("");

        // 1) LIMPA SOMENTE CAMPOS NÃO-EDITADOS (dirty = preserva)
        isApplyingTotvsRef.current = true;
        try {
          TOTVS_DEPENDENT_TAGS.forEach((tag) => {
            if (isDirty(tag)) return;

            if (tag === TAGS.fornecedores) setFornecedores([newSupplierRow()]);
            else setVal(tag, "");
          });
        } finally {
          isApplyingTotvsRef.current = false;
        }

        const totvs = await getTotvsByProductCodeApi(code);
        if (!totvs) {
          setAutoFillError("Produto não encontrado no TOTVS.");
          return;
        }

        // marca que já buscou esse código (por item)
        lastFetchedByKeyRef.current.set(key, code);

        // ✅ 2) PREENCHE SOMENTE SE:
        // - campo NÃO estiver dirty, OU
        // - campo estiver vazio (evita “sobrar” dado de outro produto)
        const applyIfAllowed = (tag, value) => {
          const v = value == null ? "" : String(value);
          if (!v.trim()) return;

          const current = String(getVal(tag, "") ?? "").trim();
          const canOverwrite = !isDirty(tag) || !current;

          if (!canOverwrite) return;

          isApplyingTotvsRef.current = true;
          try {
            setVal(tag, v);
          } finally {
            isApplyingTotvsRef.current = false;
          }
        };

        applyIfAllowed(TAGS.grupo, totvs.grupo);
        applyIfAllowed(TAGS.tipo, totvs.tipo);
        applyIfAllowed(TAGS.descricao, totvs.descricao);
        applyIfAllowed(TAGS.armazem_padrao, totvs.armazem_padrao);
        applyIfAllowed(TAGS.unidade, totvs.unidade);
        applyIfAllowed(TAGS.produto_terceiro, totvs.produto_terceiro);
        applyIfAllowed(TAGS.cta_contabil, totvs.cta_contabil);
        applyIfAllowed(TAGS.ref_cliente, totvs.ref_cliente);

        // fornecedores: só sobrescreve se não estiver dirty ou se estiver “vazio”
        const fornecedoresCur = Array.isArray(fornecedores) ? fornecedores : [];
        const fornecedoresVazios =
          fornecedoresCur.length === 0 ||
          (fornecedoresCur.length === 1 &&
            !String(fornecedoresCur[0]?.supplier_code ?? "").trim() &&
            !String(fornecedoresCur[0]?.store ?? "").trim() &&
            !String(fornecedoresCur[0]?.supplier_name ?? "").trim() &&
            !String(fornecedoresCur[0]?.part_number ?? "").trim());

        const canOverwriteSuppliers = !isDirty(TAGS.fornecedores) || fornecedoresVazios;

        if (canOverwriteSuppliers) {
          isApplyingTotvsRef.current = true;
          try {
            if (Array.isArray(totvs.fornecedores) && totvs.fornecedores.length) {
              setFornecedores(totvs.fornecedores);
            } else {
              setFornecedores([newSupplierRow()]);
            }
          } finally {
            isApplyingTotvsRef.current = false;
          }
        }
      } catch (err) {
        setAutoFillError(err?.response?.data?.error ?? "Falha ao buscar dados do TOTVS.");
      } finally {
        setAutoFillBusy(false);
      }
    }, 500);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isUpdate, canEditNormal, isStructured, valuesByTag?.[TAGS.codigo_atual], item?.codigo_atual]);

  function setRequestType(code) {
    // somente no structured + edit normal
    if (!canEditNormal) return;
    if (!isStructured) return;

    if (code === "CREATE") {
      const defaults = newStructuredItem();

      onItemChange?.("request_type_code", "CREATE");

      // ✅ limpar campos de UPDATE
      onItemChange?.(TAGS.codigo_atual, "");
      onItemChange?.(TAGS.novo_codigo, "");

      // ✅ restaurar padrões do CREATE
      onItemChange?.(TAGS.grupo, defaults.grupo ?? "");
      onItemChange?.(TAGS.descricao, defaults.descricao ?? "");
      onItemChange?.(TAGS.tipo, defaults.tipo ?? "");
      onItemChange?.(TAGS.armazem_padrao, defaults.armazem_padrao ?? "");
      onItemChange?.(TAGS.unidade, defaults.unidade ?? "");
      onItemChange?.(TAGS.produto_terceiro, defaults.produto_terceiro ?? "");
      onItemChange?.(TAGS.cta_contabil, defaults.cta_contabil ?? "");
      onItemChange?.(TAGS.ref_cliente, defaults.ref_cliente ?? "");

      // ✅ fornecedores sempre volta ao padrão
      onItemChange?.(TAGS.fornecedores, Array.isArray(defaults.fornecedores) ? defaults.fornecedores : [newSupplierRow()]);

      // ✅ evita “cache” do último código TOTVS
      lastFetchedCodeRef.current = "";
      setAutoFillError("");
    } else {
      onItemChange?.("request_type_code", "UPDATE");
      // opcional: não mexe em nada, usuário vai preencher codigo_atual e disparar o TOTVS
      lastFetchedCodeRef.current = "";
      setAutoFillError("");
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

  async function saveFlagFromModal() {
    if (!flagModal.open) return;

    if (!flagModal.fieldId) {
      // não existe campo pra salvar flag
      return;
    }

    const next = String(flagModal.value || "").trim();
    const nextFlag = next ? next : null;

    setFlagModal((s) => ({ ...s, saving: true, error: "" }));

    try {
      await onSetFieldFlag?.(Number(flagModal.fieldId), nextFlag, flagModal.tag);
      closeFlagModal();
    } catch (err) {
      const msg = err?.response?.data?.error ?? "Falha ao atualizar flag.";
      setFlagModal((s) => ({ ...s, saving: false, error: msg }));
    }
  }

  function getFieldObj(tag) {
    if (isStructured) return null; 
    return byTag?.[tag] || null;
  }

  function getFlag(tag) {
    return String(getFieldObj(tag)?.field_flag ?? "").trim();
  }

  function safePreview(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  function getFieldLabelFromTag(tag) {
    // melhor: você pode mapear pelos labels reais se quiser.
    // aqui fica um fallback aceitável.
    return String(tag || "").replaceAll("_", " ").toUpperCase();
  }

  function editFlag(tag) {
    if (!canEditFlags) return;

    const f = getFieldObj(tag);
    if (!f?.id) {
      setFlagModal({
        open: true,
        tag,
        fieldId: null,
        fieldLabel: getFieldLabelFromTag(tag),
        fieldValuePreview: safePreview(valuesByTag?.[tag] ?? ""),
        value: "",
        saving: false,
        error: "Campo ainda não existe para receber flag.",
      });
      return;
    }

    const current = getFlag(tag);

    setFlagModal({
      open: true,
      tag,
      fieldId: Number(f.id),
      fieldLabel: getFieldLabelFromTag(tag),
      fieldValuePreview: safePreview(valuesByTag?.[tag] ?? ""),
      value: current || "",
      saving: false,
      error: "",
    });
  }

  function FlagChip({ tag }) {
    const v = getFlag(tag);
    if (!v) return null;
    return (
      <span
        style={{
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          fontWeight: 800,
        }}
        title={`Flag: ${v}`}
      >
        🚩 {v}
      </span>
    );
  }

  function FlagButton({ tag }) {
    if (!canEditFlags) return null;
    return (
      <button
        type="button"
        onClick={() => editFlag(tag)}
        style={{
          padding: "4px 8px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          fontSize: 12,
          cursor: "pointer",
        }}
        title="Adicionar/remover flag"
      >
        {getFlag(tag) ? "Editar flag" : "Add flag"}
      </button>
    );
  }

  function LabelRow({ tag, children }) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center"}}>
          {children}
          <FlagChip tag={tag} />
        </div>
        <FlagButton tag={tag} />
      </div>
    );
  }

  // ---------------------------------
  function tryParseJsonArray(value) {
    if (!value) return null;

    if (Array.isArray(value)) return value;

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return null;
      }
    }
    return null;
  }

  function JsonTable({ data }) {
    if (!Array.isArray(data) || data.length === 0) return null;

    const columns = Object.keys(data[0] || {});

    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "auto",
          background: "var(--surface-2)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--border)",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td
                    key={col}
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid var(--border)",
                      verticalAlign: "top",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function FlagModal() {
    if (!flagModal.open) return null;

    const canSave = !!flagModal.fieldId && !flagModal.saving;

    return (
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeFlagModal();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeFlagModal();
          if (e.key === "Enter") saveFlagFromModal();
        }}
        tabIndex={-1}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: "min(560px, 100%)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 20px 70px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>🚩 Flag do campo</div>
            <button type="button" onClick={closeFlagModal} style={{ borderRadius: 10, padding: "6px 10px" }}>
              Fechar
            </button>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Campo</div>
              <div style={{ fontWeight: 800 }}>{flagModal.fieldLabel}</div>
            </div>
            {(() => {
              const jsonArray = tryParseJsonArray(flagModal.fieldValuePreview);

              if (jsonArray) {
                return <JsonTable data={jsonArray} />;
              }

              return (
                <div
                  style={{
                    padding: 10,
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    background: "var(--surface-2)",
                    maxHeight: 120,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 13,
                  }}
                >
                  {flagModal.fieldValuePreview || <span style={{ opacity: 0.6 }}>(vazio)</span>}
                </div>
              );
            })()}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Flag (vazio remove)</div>
              <input
                value={flagModal.value}
                onChange={(e) => setFlagModal((s) => ({ ...s, value: e.target.value }))}
                placeholder="ex.: IMPORTANTE / VALIDAR / REVISAR..."
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  outline: "none",
                }}
                autoFocus
              />
            </div>

            {flagModal.error ? (
              <div style={{ padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "var(--danger-weak, #2a0f0f)" }}>
                {flagModal.error}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button type="button" onClick={closeFlagModal} style={{ borderRadius: 10, padding: "8px 12px" }}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={saveFlagFromModal}
                style={{
                  borderRadius: 10,
                  padding: "8px 12px",
                  opacity: canSave ? 1 : 0.6,
                  cursor: canSave ? "pointer" : "not-allowed",
                }}
              >
                {flagModal.saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
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
        {!isStructured && isCreate ? (
          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            <span>Novo código (obrigatório para finalizar CRIAR)</span>
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
              {canEditNovoCodigoField
                ? "Em CREATE, este campo é preenchido por ADMIN/ANALYST antes de rejeitar/finalizar."
                : "Campo exibido para referência (somente leitura)."}
            </div>
          </label>
        ) : null}


        {/* UPDATE: codigo_atual/novo_codigo */}
        {isUpdate ? (
          <>
            <label style={styles.label}>
              <LabelRow tag={TAGS.codigo_atual}>
                <span>Código atual</span>
              </LabelRow>
              {autoFillBusy ? (
                <div style={styles.subtle}>Buscando dados do TOTVS...</div>
              ) : null}

              {autoFillError ? (
                <div style={styles.errorText}>{autoFillError}</div>
              ) : null}
              <input
                value={getVal(TAGS.codigo_atual)}
                onChange={(e) => {
                  const next = e.target.value;
                  codeUserIntentByKeyRef.current.set(key, true);
                  resetTotvsContextForThisItem(next);
                  setVal(TAGS.codigo_atual, next);
                }}
                onPaste={() => {
                  codeUserIntentByKeyRef.current.set(key, true);
                }}
                disabled={!canEditNormal}
                style={inputStyle(!!fieldErr[TAGS.codigo_atual])}
              />

              {fieldErr[TAGS.codigo_atual] ? (
                <span style={styles.errorText}>{fieldErr[TAGS.codigo_atual]}</span>
              ) : null}
            </label>

            <label style={styles.label}>
              <LabelRow tag={TAGS.novo_codigo}>
                <span>Novo código (opcional)</span>
              </LabelRow>
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
          <LabelRow tag={TAGS.grupo}>
            <span>Grupo</span>
          </LabelRow>
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
          <LabelRow tag={TAGS.tipo}>
            <span>Tipo</span>
          </LabelRow>
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
          <LabelRow tag={TAGS.descricao}>
            <span>Descrição</span>
          </LabelRow>
          <input
            value={getVal(TAGS.descricao)}
            onChange={(e) => setVal(TAGS.descricao, e.target.value)}
            disabled={!canEditNormal}
            style={inputStyle(!!fieldErr[TAGS.descricao])}
          />
          {fieldErr[TAGS.descricao] ? <span style={styles.errorText}>{fieldErr[TAGS.descricao]}</span> : null}
        </label>

        <label style={styles.label}>
          <LabelRow tag={TAGS.armazem_padrao}>
            <span>Armazém padrão</span>
          </LabelRow>
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
          <LabelRow tag={TAGS.unidade}>
            <span>Unidade</span>
          </LabelRow>
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
          <LabelRow tag={TAGS.produto_terceiro}>
            <span>Produto terceiro</span>
          </LabelRow>
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
          <LabelRow tag={TAGS.cta_contabil}>
            <span>CTA contábil</span>
          </LabelRow>
          <input
            value={getVal(TAGS.cta_contabil)}
            onChange={(e) => setVal(TAGS.cta_contabil, e.target.value)}
            disabled={!canEditNormal}
            style={inputStyle(!!fieldErr[TAGS.cta_contabil])}
          />
          {fieldErr[TAGS.cta_contabil] ? <span style={styles.errorText}>{fieldErr[TAGS.cta_contabil]}</span> : null}
        </label>

        <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
          <LabelRow tag={TAGS.ref_cliente}>
            <span>Ref. cliente</span>
          </LabelRow>
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
          <LabelRow tag={TAGS.fornecedores}>
            <span style={styles.sectionTitle}>Fornecedores</span>
          </LabelRow>

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
     <FlagModal />
    </div>
  );
}
