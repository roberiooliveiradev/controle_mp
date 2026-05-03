// src/app/ui/chat/RequestComposerModal.jsx
import { useEffect, useMemo, useState } from "react";
import { RequestItemFields } from "../requests/RequestItemFields";
import {
  newStructuredItem,
  validateStructuredItem,
  structuredItemToRequestPayloadItem,
} from "../requests/requestItemFields.logic";
import "./RequestComposerModal.css";

function makeClientId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `cid-${Date.now()}-${Math.random()}`
  );
}

function isFilled(value) {
  return String(value ?? "").trim().length > 0;
}

function supplierHasContent(row) {
  if (!row || typeof row !== "object") return false;

  return (
    isFilled(row.supplier_code) ||
    isFilled(row.store) ||
    isFilled(row.supplier_name) ||
    isFilled(row.part_number) ||
    isFilled(row.catalog_number)
  );
}

function itemHasUserContent(item) {
  if (!item) return false;

  return (
    isFilled(item.codigo_atual) ||
    isFilled(item.novo_codigo) ||
    isFilled(item.grupo) ||
    isFilled(item.descricao) ||
    isFilled(item.unidade) ||
    isFilled(item.ref_cliente) ||
    (Array.isArray(item.fornecedores) && item.fornecedores.some(supplierHasContent))
  );
}

function countSupplierRows(item) {
  const rows = Array.isArray(item?.fornecedores) ? item.fornecedores : [];
  return rows.filter(supplierHasContent).length;
}

function getItemTitle(item, index) {
  const descricao = String(item?.descricao ?? "").trim();
  const codigoAtual = String(item?.codigo_atual ?? "").trim();
  const novoCodigo = String(item?.novo_codigo ?? "").trim();

  if (descricao) return descricao;
  if (codigoAtual) return `Código ${codigoAtual}`;
  if (novoCodigo) return `Novo código ${novoCodigo}`;

  return `Item #${index + 1}`;
}

function countErrorsForItem(itemErrors) {
  const fieldsCount = Object.keys(itemErrors?.fields || {}).length;
  const suppliersObj = itemErrors?.suppliers || {};
  const suppliersCount = Object.values(suppliersObj).reduce(
    (acc, row) => acc + Object.keys(row || {}).length,
    0
  );

  return fieldsCount + suppliersCount;
}

export function RequestComposerModal({ onClose, onSubmit }) {
  const [items, setItems] = useState([newStructuredItem()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const active = items[activeIndex];
  const canSubmit = useMemo(() => items.length > 0 && !submitting, [
    items.length,
    submitting,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (items.length > 1) return true;
    return items.some(itemHasUserContent);
  }, [items]);

  const totalErrors = useMemo(() => {
    return Object.values(errors || {}).reduce(
      (acc, itemErrors) => acc + countErrorsForItem(itemErrors),
      0
    );
  }, [errors]);

  const filledItemsCount = useMemo(() => {
    return items.filter(itemHasUserContent).length;
  }, [items]);

  const activeError = getItemErrors(activeIndex);
  const activeErrorCount = countErrorsForItem(activeError);
  const activeSupplierCount = countSupplierRows(active);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        requestClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges]);

  function getItemErrors(idx) {
    return errors?.[idx] || { fields: {}, suppliers: {} };
  }

  function itemHasAnyError(idx) {
    return countErrorsForItem(getItemErrors(idx)) > 0;
  }

  function clearFieldError(itemIdx, key) {
    setErrors((prev) => {
      const current = prev?.[itemIdx];

      if (!current?.fields?.[key]) return prev;

      const nextFields = { ...(current.fields || {}) };
      delete nextFields[key];

      const nextItemErrors = {
        fields: nextFields,
        suppliers: current.suppliers || {},
      };

      const next = { ...prev };

      if (countErrorsForItem(nextItemErrors) === 0) {
        delete next[itemIdx];
      } else {
        next[itemIdx] = nextItemErrors;
      }

      return next;
    });
  }

  function clearSupplierError(itemIdx, rowIdx, key) {
    setErrors((prev) => {
      const current = prev?.[itemIdx];
      const row = current?.suppliers?.[rowIdx];

      if (!row?.[key]) return prev;

      const nextRow = { ...(row || {}) };
      delete nextRow[key];

      const nextSuppliers = { ...(current.suppliers || {}) };

      if (Object.keys(nextRow).length === 0) {
        delete nextSuppliers[rowIdx];
      } else {
        nextSuppliers[rowIdx] = nextRow;
      }

      const nextItemErrors = {
        fields: current.fields || {},
        suppliers: nextSuppliers,
      };

      const next = { ...prev };

      if (countErrorsForItem(nextItemErrors) === 0) {
        delete next[itemIdx];
      } else {
        next[itemIdx] = nextItemErrors;
      }

      return next;
    });
  }

  function setActiveItemField(key, value) {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === activeIndex ? { ...item, [key]: value } : item
      )
    );

    clearFieldError(activeIndex, key);
  }

  function addItem() {
    setItems((prev) => [...prev, newStructuredItem()]);
    setActiveIndex(items.length);
  }

  function duplicateItem(idx) {
    setItems((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const source = list[idx];

      if (!source) return list;

      const cloned = {
        ...source,
        _client_id: makeClientId(),
        fornecedores: Array.isArray(source.fornecedores)
          ? source.fornecedores.map((row) => ({ ...row }))
          : [],
      };

      if (cloned.request_type_code === "UPDATE") {
        cloned.codigo_atual = "";
      }

      list.splice(idx + 1, 0, cloned);

      return list;
    });

    setActiveIndex(idx + 1);

    setErrors((prev) => {
      const next = {};

      Object.keys(prev || {}).forEach((key) => {
        const currentIndex = Number(key);

        if (Number.isNaN(currentIndex)) return;

        next[currentIndex > idx ? currentIndex + 1 : currentIndex] =
          prev[currentIndex];
      });

      return next;
    });
  }

  function removeItem(idx) {
    if (items.length <= 1) return;

    setItems((prev) => prev.filter((_, itemIdx) => itemIdx !== idx));

    setErrors((prev) => {
      const next = {};

      Object.keys(prev || {}).forEach((key) => {
        const currentIndex = Number(key);

        if (Number.isNaN(currentIndex)) return;
        if (currentIndex === idx) return;

        const newKey = currentIndex > idx ? currentIndex - 1 : currentIndex;
        next[newKey] = prev[currentIndex];
      });

      return next;
    });

    setActiveIndex((prev) => {
      const nextLength = Math.max(items.length - 1, 0);

      if (nextLength <= 0) return 0;
      if (idx < prev) return prev - 1;
      if (idx === prev) return Math.min(prev, nextLength - 1);

      return prev;
    });
  }

  function validateAll() {
    const nextErrors = {};

    items.forEach((item, idx) => {
      const { fields, suppliers } = validateStructuredItem(item);

      if (Object.keys(fields).length || Object.keys(suppliers).length) {
        nextErrors[idx] = { fields, suppliers };
      }
    });

    return nextErrors;
  }

  function requestClose() {
    if (submitting) return;

    if (!hasUnsavedChanges) {
      onClose();
      return;
    }

    const confirmed = window.confirm(
      "Você tem informações preenchidas.\n\nDeseja realmente fechar e perder os dados?"
    );

    if (confirmed) {
      onClose();
    }
  }

  async function submit() {
    if (!canSubmit) return;

    const nextErrors = validateAll();
    setErrors(nextErrors);

    const firstErrorItem = Object.keys(nextErrors)
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b)[0];

    if (firstErrorItem !== undefined) {
      setActiveIndex(firstErrorItem);
      return;
    }

    const requestItems = items.map(structuredItemToRequestPayloadItem);

    try {
      setSubmitting(true);
      await onSubmit({ requestItems });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-composer-title"
      className="cmp-request-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div className="cmp-request-modal__panel">
        <header className="cmp-request-modal__header">
          <div className="cmp-request-modal__heading">
            <span className="cmp-request-modal__eyebrow">Solicitação via chat</span>

            <strong
              id="request-composer-title"
              className="cmp-request-modal__title"
            >
              Nova solicitação de produto
            </strong>

            <span className="cmp-request-modal__subtitle">
              Monte um ou mais itens para enviar uma solicitação vinculada à conversa.
            </span>
          </div>

          <div className="cmp-request-modal__header-summary" aria-label="Resumo da solicitação">
            <span className="cmp-request-modal__summary-card">
              <strong>{items.length}</strong>
              <span>{items.length === 1 ? "item" : "itens"}</span>
            </span>

            <span className="cmp-request-modal__summary-card">
              <strong>{filledItemsCount}</strong>
              <span>preenchido{filledItemsCount === 1 ? "" : "s"}</span>
            </span>

            <span
              className={
                totalErrors > 0
                  ? "cmp-request-modal__summary-card cmp-request-modal__summary-card--error"
                  : "cmp-request-modal__summary-card"
              }
            >
              <strong>{totalErrors}</strong>
              <span>{totalErrors === 1 ? "pendência" : "pendências"}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            className="cmp-request-modal__icon-button"
            aria-label="Fechar modal"
            title="Fechar"
          >
            ×
          </button>
        </header>

        {totalErrors > 0 ? (
          <div className="cmp-request-modal__alert" role="alert">
            Existem campos obrigatórios pendentes. O primeiro item com erro foi selecionado automaticamente.
          </div>
        ) : null}

        <div className="cmp-request-modal__body">
          <aside className="cmp-request-modal__items" aria-label="Itens da solicitação">
            <div className="cmp-request-modal__items-header">
              <div>
                <strong className="cmp-request-modal__items-title">Itens</strong>
                <span className="cmp-request-modal__items-subtitle">
                  Selecione um item para editar
                </span>
              </div>

              <button
                type="button"
                onClick={addItem}
                disabled={submitting}
                className="cmp-request-modal__button cmp-request-modal__button--compact"
              >
                + Item
              </button>
            </div>

            <div className="cmp-request-modal__items-list">
              {items.map((item, idx) => {
                const isActive = idx === activeIndex;
                const hasError = itemHasAnyError(idx);
                const itemErrorCount = countErrorsForItem(getItemErrors(idx));
                const supplierCount = countSupplierRows(item);
                const title = getItemTitle(item, idx);

                return (
                  <article
                    key={item._client_id ?? idx}
                    onClick={() => setActiveIndex(idx)}
                    className={[
                      "cmp-request-modal__item-card",
                      isActive ? "cmp-request-modal__item-card--active" : "",
                      hasError ? "cmp-request-modal__item-card--error" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="cmp-request-modal__item-top">
                      <div className="cmp-request-modal__item-title-wrap">
                        <span className="cmp-request-modal__item-number">
                          #{idx + 1}
                        </span>

                        <span className="cmp-request-modal__item-title">
                          {title}
                        </span>

                        {hasError ? (
                          <span
                            title={`${itemErrorCount} pendência(s)`}
                            className="cmp-request-modal__item-error-badge"
                          >
                            !
                          </span>
                        ) : null}
                      </div>

                      <div className="cmp-request-modal__item-actions">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={(event) => {
                            event.stopPropagation();
                            duplicateItem(idx);
                          }}
                          className="cmp-request-modal__mini-button"
                        >
                          Duplicar
                        </button>

                        {items.length > 1 ? (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeItem(idx);
                            }}
                            className="cmp-request-modal__mini-button cmp-request-modal__mini-button--danger"
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="cmp-request-modal__item-meta">
                      <span
                        className={
                          item.request_type_code === "UPDATE"
                            ? "cmp-request-modal__pill cmp-request-modal__pill--update"
                            : "cmp-request-modal__pill cmp-request-modal__pill--create"
                        }
                      >
                        {item.request_type_code === "UPDATE" ? "ALTERAR" : "CRIAR"}
                      </span>

                      {item.grupo ? (
                        <span className="cmp-request-modal__pill">
                          Grupo {item.grupo}
                        </span>
                      ) : null}

                      {supplierCount > 0 ? (
                        <span className="cmp-request-modal__pill">
                          {supplierCount} fornecedor{supplierCount === 1 ? "" : "es"}
                        </span>
                      ) : null}
                    </div>

                    {hasError ? (
                      <div className="cmp-request-modal__item-error-text">
                        {itemErrorCount} pendência{itemErrorCount === 1 ? "" : "s"} para revisar
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </aside>

          <main className="cmp-request-modal__editor">
            <div className="cmp-request-modal__editor-header">
              <div className="cmp-request-modal__editor-title-area">
                <span className="cmp-request-modal__editor-eyebrow">
                  Editando
                </span>

                <strong className="cmp-request-modal__editor-title">
                  Item #{activeIndex + 1}
                </strong>
              </div>

              <div className="cmp-request-modal__editor-badges">
                <span
                  className={
                    active?.request_type_code === "UPDATE"
                      ? "cmp-request-modal__pill cmp-request-modal__pill--update"
                      : "cmp-request-modal__pill cmp-request-modal__pill--create"
                  }
                >
                  {active?.request_type_code === "UPDATE" ? "ALTERAR" : "CRIAR"}
                </span>

                {activeErrorCount > 0 ? (
                  <span className="cmp-request-modal__pill cmp-request-modal__pill--error">
                    {activeErrorCount} pendência{activeErrorCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="cmp-request-modal__pill cmp-request-modal__pill--ok">
                    Sem pendências
                  </span>
                )}
              </div>
            </div>

            <div className="cmp-request-modal__editor-scroll">
              <RequestItemFields
                variant="structured"
                item={active}
                itemKey={active?._client_id ?? activeIndex}
                readOnly={false}
                errors={activeError}
                onItemChange={(key, value) => setActiveItemField(key, value)}
                onClearFieldError={(key) => clearFieldError(activeIndex, key)}
                onClearSupplierError={(rowIdx, key) =>
                  clearSupplierError(activeIndex, rowIdx, key)
                }
              />
            </div>
          </main>
        </div>

        <footer className="cmp-request-modal__footer">
          <div className="cmp-request-modal__footer-info">
            <strong>Resumo</strong>
            <span>
              {items.length} {items.length === 1 ? "item" : "itens"} na solicitação
              {totalErrors > 0 ? ` • ${totalErrors} pendência(s)` : " • pronto para validar"}
            </span>
          </div>

          <div className="cmp-request-modal__footer-actions">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="cmp-request-modal__button"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={addItem}
              disabled={submitting}
              className="cmp-request-modal__button"
            >
              Adicionar item
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="cmp-request-modal__button cmp-request-modal__button--primary"
            >
              {submitting ? "Enviando..." : "Enviar solicitação"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}