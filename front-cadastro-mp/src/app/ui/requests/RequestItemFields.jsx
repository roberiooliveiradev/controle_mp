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
import "./RequestItemFields.css";

function controlClass(hasError, extra = "") {
  return [
    "cmp-request-fields__control",
    hasError ? "cmp-request-fields__control--error" : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function selectClass(hasError, extra = "") {
  return [
    "cmp-request-fields__control",
    "cmp-request-fields__select",
    hasError ? "cmp-request-fields__control--error" : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function FieldError({ children }) {
  if (!children) return null;
  return <span className="cmp-request-fields__error-text">{children}</span>;
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className="cmp-request-fields__hint">{children}</div>;
}

export function RequestItemFields({
  variant,
  readOnly = false,

  // libera SOMENTE o campo novo_codigo (para CREATE) mesmo em readOnly (ADMIN/ANALYST)
  canEditNovoCodigo = false,

  // produtos
  isProduct = false,

  // flags
  byTag = null,
  canEditFlags = false,
  onSetFieldFlag = null,

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
    setFlagModal((s) => ({
      ...s,
      open: false,
      tag: null,
      fieldId: null,
      error: "",
    }));
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

  const canEditNormal = !readOnly;

  const canEditNovoCodigoField =
    !isProduct && !!canEditNovoCodigo && !isStructured && isCreate;

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

  function normalizeValueForTyping(value) {
    if (typeof value === "string") return value;

    if (Array.isArray(value)) {
      return value.map(normalizeValueForTyping);
    }

    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((k) => {
        out[k] = normalizeValueForTyping(value[k]);
      });
      return out;
    }

    return value;
  }

  const key = String(itemKey ?? "default");

  const lastFetchedByKeyRef = useRef(new Map());
  const prevCodeByKeyRef = useRef(new Map());
  const dirtyByKeyRef = useRef(new Map());
  const isApplyingTotvsRef = useRef(false);
  const codeUserIntentByKeyRef = useRef(new Map());

  function getDirtySet() {
    if (!dirtyByKeyRef.current.has(key)) {
      dirtyByKeyRef.current.set(key, new Set());
    }

    return dirtyByKeyRef.current.get(key);
  }

  function markDirty(tag) {
    if (isApplyingTotvsRef.current) return;
    getDirtySet().add(tag);
  }

  function isDirty(tag) {
    return getDirtySet().has(tag);
  }

  function resetTotvsContextForThisItem(nextCode = "") {
    const dirtySet = getDirtySet();

    TOTVS_DEPENDENT_TAGS.forEach((tag) => dirtySet.delete(tag));
    dirtySet.delete(TAGS.codigo_atual);

    lastFetchedByKeyRef.current.delete(key);
    prevCodeByKeyRef.current.set(key, String(nextCode || "").trim());
  }

  function setVal(tag, value) {
    const isSpecialNovoCodigo =
      tag === TAGS.novo_codigo && canEditNovoCodigoField;

    if (!canEditNormal && !isSpecialNovoCodigo) return;

    const nextValue = normalizeValueForTyping(value);

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
    if (!canEditNormal) return;

    markDirty(TAGS.fornecedores);

    const safe =
      Array.isArray(nextRows) && nextRows.length ? nextRows : [newSupplierRow()];

    if (isStructured) {
      onItemChange?.(TAGS.fornecedores, safe);
    } else {
      onChangeFornecedores?.(safe);
    }

    onClearFieldError?.(TAGS.fornecedores);

    safe.forEach((_, idx) => {
      SUPPLIER_COLUMNS.forEach((column) => {
        onClearSupplierError?.(idx, column.key);
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
    if (code === lastFetched) return;

    const handle = setTimeout(async () => {
      try {
        setAutoFillBusy(true);
        setAutoFillError("");

        isApplyingTotvsRef.current = true;

        try {
          TOTVS_DEPENDENT_TAGS.forEach((tag) => {
            if (isDirty(tag)) return;

            if (tag === TAGS.fornecedores) {
              setFornecedores([newSupplierRow()]);
            } else {
              setVal(tag, "");
            }
          });
        } finally {
          isApplyingTotvsRef.current = false;
        }

        const totvs = await getTotvsByProductCodeApi(code);

        if (!totvs) {
          setAutoFillError("Produto não encontrado no TOTVS.");
          return;
        }

        lastFetchedByKeyRef.current.set(key, code);

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

        const fornecedoresCur = Array.isArray(fornecedores) ? fornecedores : [];

        const fornecedoresVazios =
          fornecedoresCur.length === 0 ||
          (fornecedoresCur.length === 1 &&
            !String(fornecedoresCur[0]?.supplier_code ?? "").trim() &&
            !String(fornecedoresCur[0]?.store ?? "").trim() &&
            !String(fornecedoresCur[0]?.supplier_name ?? "").trim() &&
            !String(fornecedoresCur[0]?.part_number ?? "").trim());

        const canOverwriteSuppliers =
          !isDirty(TAGS.fornecedores) || fornecedoresVazios;

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
        setAutoFillError(
          err?.response?.data?.error ?? "Falha ao buscar dados do TOTVS."
        );
      } finally {
        setAutoFillBusy(false);
      }
    }, 500);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    key,
    isUpdate,
    canEditNormal,
    isStructured,
    valuesByTag?.[TAGS.codigo_atual],
    item?.codigo_atual,
  ]);

  function setRequestType(code) {
    if (!canEditNormal) return;
    if (!isStructured) return;

    if (code === "CREATE") {
      const defaults = newStructuredItem();

      onItemChange?.("request_type_code", "CREATE");

      onItemChange?.(TAGS.codigo_atual, "");
      onItemChange?.(TAGS.novo_codigo, "");

      onItemChange?.(TAGS.grupo, defaults.grupo ?? "");
      onItemChange?.(TAGS.descricao, defaults.descricao ?? "");
      onItemChange?.(TAGS.tipo, defaults.tipo ?? "");
      onItemChange?.(TAGS.armazem_padrao, defaults.armazem_padrao ?? "");
      onItemChange?.(TAGS.unidade, defaults.unidade ?? "");
      onItemChange?.(TAGS.produto_terceiro, defaults.produto_terceiro ?? "");
      onItemChange?.(TAGS.cta_contabil, defaults.cta_contabil ?? "");
      onItemChange?.(TAGS.ref_cliente, defaults.ref_cliente ?? "");

      onItemChange?.(
        TAGS.fornecedores,
        Array.isArray(defaults.fornecedores)
          ? defaults.fornecedores
          : [newSupplierRow()]
      );

      lastFetchedCodeRef.current = "";
      setAutoFillError("");
    } else {
      onItemChange?.("request_type_code", "UPDATE");
      lastFetchedCodeRef.current = "";
      setAutoFillError("");
    }

    onClearFieldError?.(TAGS.codigo_atual);
    onClearFieldError?.(TAGS.novo_codigo);
  }

  function addSupplierRow() {
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

    if (isStructured) {
      onItemChange?.(TAGS.fornecedores, safe);
    } else {
      onChangeFornecedores?.(safe);
    }
  }

  function setSupplierCell(rowIndex, columnKey, value) {
    if (!canEditNormal) return;

    const nextValue =
      typeof value === "string" ? value.toUpperCase() : value;

    const next = fornecedores.map((row, idx) =>
      idx === rowIndex ? { ...row, [columnKey]: nextValue } : row
    );

    if (isStructured) {
      onItemChange?.(TAGS.fornecedores, next);
      onClearSupplierError?.(rowIndex, columnKey);
      return;
    }

    onChangeFornecedores?.(next);
    onClearSupplierError?.(rowIndex, columnKey);
  }

  async function saveFlagFromModal() {
    if (!flagModal.open) return;
    if (!flagModal.fieldId) return;

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

  function safePreview(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function getFieldLabelFromTag(tag) {
    return String(tag || "").replaceAll("_", " ").toUpperCase();
  }

  function editFlag(tag) {
    if (!canEditFlags) return;

    const field = getFieldObj(tag);

    if (!field?.id) {
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
      fieldId: Number(field.id),
      fieldLabel: getFieldLabelFromTag(tag),
      fieldValuePreview: safePreview(valuesByTag?.[tag] ?? ""),
      value: current || "",
      saving: false,
      error: "",
    });
  }

  function FlagChip({ tag }) {
    const value = getFlag(tag);

    if (!value) return null;

    return (
      <span className="cmp-request-fields__flag-chip" title={`Flag: ${value}`}>
        🚩 {value}
      </span>
    );
  }

  function FlagButton({ tag }) {
    if (!canEditFlags) return null;

    return (
      <button
        type="button"
        onClick={() => editFlag(tag)}
        className="cmp-request-fields__flag-button"
        title="Adicionar/remover flag"
      >
        {getFlag(tag) ? "Editar flag" : "Add flag"}
      </button>
    );
  }

  function LabelRow({ tag, children }) {
    return (
      <div className="cmp-request-fields__label-row">
        <div className="cmp-request-fields__label-title-wrap">
          {children}
          <FlagChip tag={tag} />
        </div>

        <FlagButton tag={tag} />
      </div>
    );
  }

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
      <div className="cmp-request-fields__json-table-wrap">
        <table className="cmp-request-fields__json-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {columns.map((column) => (
                  <td key={column}>{String(row[column] ?? "")}</td>
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
    const jsonArray = tryParseJsonArray(flagModal.fieldValuePreview);

    return (
      <div
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="cmp-request-fields-flag-modal"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeFlagModal();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeFlagModal();
          if (event.key === "Enter") saveFlagFromModal();
        }}
      >
        <div className="cmp-request-fields-flag-modal__panel">
          <header className="cmp-request-fields-flag-modal__header">
            <strong className="cmp-request-fields-flag-modal__title">
              🚩 Flag do campo
            </strong>

            <button
              type="button"
              onClick={closeFlagModal}
              className="cmp-request-fields-flag-modal__button"
            >
              Fechar
            </button>
          </header>

          <div className="cmp-request-fields-flag-modal__body">
            <div className="cmp-request-fields-flag-modal__field">
              <span className="cmp-request-fields-flag-modal__label">
                Campo
              </span>

              <strong className="cmp-request-fields-flag-modal__field-name">
                {flagModal.fieldLabel}
              </strong>
            </div>

            {jsonArray ? (
              <JsonTable data={jsonArray} />
            ) : (
              <div className="cmp-request-fields-flag-modal__preview">
                {flagModal.fieldValuePreview || (
                  <span className="cmp-request-fields__empty">(vazio)</span>
                )}
              </div>
            )}

            <label className="cmp-request-fields-flag-modal__field">
              <span className="cmp-request-fields-flag-modal__label">
                Flag (vazio remove)
              </span>

              <input
                value={flagModal.value}
                onChange={(event) =>
                  setFlagModal((s) => ({
                    ...s,
                    value: event.target.value,
                  }))
                }
                placeholder="ex.: IMPORTANTE / VALIDAR / REVISAR..."
                className="cmp-request-fields-flag-modal__input"
                autoFocus
              />
            </label>

            {flagModal.error ? (
              <div className="cmp-request-fields-flag-modal__error">
                {flagModal.error}
              </div>
            ) : null}

            <div className="cmp-request-fields-flag-modal__actions">
              <button
                type="button"
                onClick={closeFlagModal}
                className="cmp-request-fields-flag-modal__button"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!canSave}
                onClick={saveFlagFromModal}
                className="cmp-request-fields-flag-modal__button cmp-request-fields-flag-modal__button--primary"
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
    <div className="cmp-request-fields">
      {isStructured ? (
        <section className="cmp-request-fields__section">
          <div className="cmp-request-fields__section-title">
            Tipo da solicitação
          </div>

          <label className="cmp-request-fields__field">
            <span>Tipo</span>

            <select
              value={item?.request_type_code ?? "CREATE"}
              onChange={(event) => setRequestType(event.target.value)}
              disabled={!canEditNormal}
              className={selectClass(false)}
            >
              <option value="CREATE">CRIAR</option>
              <option value="UPDATE">ALTERAR</option>
            </select>
          </label>

          <FieldHint>Se for “ALTERAR”, o código atual é obrigatório.</FieldHint>
        </section>
      ) : null}

      <section className="cmp-request-fields__grid">
        {isProduct ? (
          <label className="cmp-request-fields__field cmp-request-fields__field--full">
            <span>Código</span>

            <input
              value={getVal(TAGS.codigo_atual)}
              disabled={true}
              className={controlClass(false)}
            />
          </label>
        ) : null}

        {!isStructured && isCreate ? (
          <label className="cmp-request-fields__field cmp-request-fields__field--full">
            <span>Novo código (obrigatório para finalizar CRIAR)</span>

            <input
              value={getVal(TAGS.novo_codigo)}
              onChange={(event) => setVal(TAGS.novo_codigo, event.target.value)}
              disabled={!canEditNovoCodigoField}
              className={controlClass(!!fieldErr[TAGS.novo_codigo])}
            />

            <FieldError>{fieldErr[TAGS.novo_codigo]}</FieldError>

            <FieldHint>
              {canEditNovoCodigoField
                ? "Em CREATE, este campo é preenchido por ADMIN/ANALYST antes de rejeitar/finalizar."
                : "Campo exibido para referência (somente leitura)."}
            </FieldHint>
          </label>
        ) : null}

        {isUpdate ? (
          <>
            <label className="cmp-request-fields__field">
              <LabelRow tag={TAGS.codigo_atual}>
                <span>Código atual</span>
              </LabelRow>

              {autoFillBusy ? (
                <FieldHint>Buscando dados do TOTVS...</FieldHint>
              ) : null}

              <FieldError>{autoFillError}</FieldError>

              <input
                value={getVal(TAGS.codigo_atual)}
                onChange={(event) => {
                  const next = event.target.value;
                  codeUserIntentByKeyRef.current.set(key, true);
                  resetTotvsContextForThisItem(next);
                  setVal(TAGS.codigo_atual, next);
                }}
                onPaste={() => {
                  codeUserIntentByKeyRef.current.set(key, true);
                }}
                disabled={!canEditNormal}
                className={controlClass(!!fieldErr[TAGS.codigo_atual])}
              />

              <FieldError>{fieldErr[TAGS.codigo_atual]}</FieldError>
            </label>

            <label className="cmp-request-fields__field">
              <LabelRow tag={TAGS.novo_codigo}>
                <span>Novo código (opcional)</span>
              </LabelRow>

              <input
                value={getVal(TAGS.novo_codigo)}
                onChange={(event) =>
                  setVal(TAGS.novo_codigo, event.target.value)
                }
                disabled={!canEditNormal}
                className={controlClass(!!fieldErr[TAGS.novo_codigo])}
              />

              <FieldError>{fieldErr[TAGS.novo_codigo]}</FieldError>
            </label>
          </>
        ) : null}

        <label className="cmp-request-fields__field">
          <LabelRow tag={TAGS.grupo}>
            <span>Grupo</span>
          </LabelRow>

          <select
            value={getVal(TAGS.grupo)}
            onChange={(event) => setVal(TAGS.grupo, event.target.value)}
            disabled={!canEditNormal}
            className={selectClass(!!fieldErr[TAGS.grupo])}
          >
            <option value="">Selecione</option>
            {PRODUCT_GROUP_OPTIONS.map((group) => (
              <option key={group.value} value={group.value}>
                {group.text}
              </option>
            ))}
          </select>

          <FieldError>{fieldErr[TAGS.grupo]}</FieldError>
        </label>

        <label className="cmp-request-fields__field">
          <LabelRow tag={TAGS.tipo}>
            <span>Tipo</span>
          </LabelRow>

          <input
            value={getVal(TAGS.tipo)}
            onChange={(event) => setVal(TAGS.tipo, event.target.value)}
            disabled={!canEditNormal}
            className={controlClass(!!fieldErr[TAGS.tipo])}
          />

          <FieldError>{fieldErr[TAGS.tipo]}</FieldError>
        </label>

        <label className="cmp-request-fields__field cmp-request-fields__field--full">
          <LabelRow tag={TAGS.descricao}>
            <span>Descrição</span>
          </LabelRow>

          <input
            value={getVal(TAGS.descricao)}
            onChange={(event) => setVal(TAGS.descricao, event.target.value)}
            disabled={!canEditNormal}
            className={controlClass(!!fieldErr[TAGS.descricao])}
          />

          <FieldError>{fieldErr[TAGS.descricao]}</FieldError>
        </label>

        <label className="cmp-request-fields__field">
          <LabelRow tag={TAGS.armazem_padrao}>
            <span>Armazém padrão</span>
          </LabelRow>

          <select
            value={getVal(TAGS.armazem_padrao)}
            onChange={(event) =>
              setVal(TAGS.armazem_padrao, event.target.value)
            }
            disabled={!canEditNormal}
            className={selectClass(!!fieldErr[TAGS.armazem_padrao])}
          >
            <option value="">Selecione</option>
            {WAREHOUSE_OPTIONS.map((warehouse) => (
              <option key={warehouse.value} value={warehouse.value}>
                {warehouse.text}
              </option>
            ))}
          </select>

          <FieldError>{fieldErr[TAGS.armazem_padrao]}</FieldError>
        </label>

        <label className="cmp-request-fields__field">
          <LabelRow tag={TAGS.unidade}>
            <span>Unidade</span>
          </LabelRow>

          <select
            value={getVal(TAGS.unidade)}
            onChange={(event) => setVal(TAGS.unidade, event.target.value)}
            disabled={!canEditNormal}
            className={selectClass(!!fieldErr[TAGS.unidade])}
          >
            <option value="">Selecione</option>
            {UNIT_OPTIONS.map((unit, idx) => (
              <option key={`${unit.value}-${idx}`} value={unit.value}>
                {unit.text}
              </option>
            ))}
          </select>

          <FieldError>{fieldErr[TAGS.unidade]}</FieldError>
        </label>

        <label className="cmp-request-fields__field">
          <LabelRow tag={TAGS.produto_terceiro}>
            <span>Produto terceiro</span>
          </LabelRow>

          <select
            value={getVal(TAGS.produto_terceiro)}
            onChange={(event) =>
              setVal(TAGS.produto_terceiro, event.target.value)
            }
            disabled={!canEditNormal}
            className={selectClass(!!fieldErr[TAGS.produto_terceiro])}
          >
            {YES_NO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.text}
              </option>
            ))}
          </select>

          <FieldError>{fieldErr[TAGS.produto_terceiro]}</FieldError>
        </label>

        <label className="cmp-request-fields__field">
          <LabelRow tag={TAGS.cta_contabil}>
            <span>CTA contábil</span>
          </LabelRow>

          <input
            value={getVal(TAGS.cta_contabil)}
            onChange={(event) => setVal(TAGS.cta_contabil, event.target.value)}
            disabled={!canEditNormal}
            className={controlClass(!!fieldErr[TAGS.cta_contabil])}
          />

          <FieldError>{fieldErr[TAGS.cta_contabil]}</FieldError>
        </label>

        <label className="cmp-request-fields__field cmp-request-fields__field--full">
          <LabelRow tag={TAGS.ref_cliente}>
            <span>Ref. cliente</span>
          </LabelRow>

          <input
            value={getVal(TAGS.ref_cliente)}
            onChange={(event) => setVal(TAGS.ref_cliente, event.target.value)}
            disabled={!canEditNormal}
            className={controlClass(!!fieldErr[TAGS.ref_cliente])}
          />

          <FieldError>{fieldErr[TAGS.ref_cliente]}</FieldError>
        </label>
      </section>

      <section className="cmp-request-fields__section">
        <div className="cmp-request-fields__section-header">
          <LabelRow tag={TAGS.fornecedores}>
            <span className="cmp-request-fields__section-title">
              Fornecedores
            </span>
          </LabelRow>

          {canEditNormal ? (
            <button
              type="button"
              onClick={addSupplierRow}
              className="cmp-request-fields__secondary-button"
            >
              + Linha
            </button>
          ) : null}
        </div>

        <div className="cmp-request-fields__suppliers-table-wrap">
          <table className="cmp-request-fields__suppliers-table">
            <thead>
              <tr>
                {SUPPLIER_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    style={{ width: column.width }}
                  >
                    {column.header}
                  </th>
                ))}

                <th className="cmp-request-fields__suppliers-action-col" />
              </tr>
            </thead>

            <tbody>
              {fornecedores.map((row, rowIdx) => {
                const rowErr = suppliersErr?.[rowIdx] || {};

                return (
                  <tr key={rowIdx}>
                    {SUPPLIER_COLUMNS.map((column) => (
                      <td key={column.key}>
                        {!canEditNormal ? (
                          <div className="cmp-request-fields__readonly-cell">
                            {String(row?.[column.key] ?? "").trim() ? (
                              row[column.key]
                            ) : (
                              <span className="cmp-request-fields__empty">—</span>
                            )}
                          </div>
                        ) : (
                          <>
                            <input
                              type={column.inputType ?? "text"}
                              value={row?.[column.key] ?? ""}
                              placeholder={column.placeholder ?? ""}
                              onChange={(event) =>
                                setSupplierCell(
                                  rowIdx,
                                  column.key,
                                  event.target.value
                                )
                              }
                              className={controlClass(!!rowErr?.[column.key])}
                            />

                            <FieldError>{rowErr?.[column.key]}</FieldError>
                          </>
                        )}
                      </td>
                    ))}

                    <td>
                      {canEditNormal ? (
                        <button
                          type="button"
                          onClick={() => removeSupplierRow(rowIdx)}
                          className="cmp-request-fields__secondary-button cmp-request-fields__secondary-button--danger"
                        >
                          Remover
                        </button>
                      ) : (
                        <span className="cmp-request-fields__empty">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <FieldHint>
          Os fornecedores são armazenados em um field JSON (tag: fornecedores).
        </FieldHint>
      </section>

      <FlagModal />
    </div>
  );
}