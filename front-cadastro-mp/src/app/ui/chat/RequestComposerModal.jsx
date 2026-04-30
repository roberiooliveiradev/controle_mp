// src/app/ui/chat/RequestComposerModal.jsx
import { useMemo, useState } from "react";
import { RequestItemFields } from "../requests/RequestItemFields";
import {
  newStructuredItem,
  validateStructuredItem,
  structuredItemToRequestPayloadItem,
} from "../requests/requestItemFields.logic";
import "./RequestComposerModal.css";

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

    return Object.entries(first).some(([key, value]) => {
      if (key === "_client_id") return false;
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    });
  }, [items]);

  function getItemErrors(idx) {
    return errors?.[idx] || { fields: {}, suppliers: {} };
  }

  function itemHasAnyError(idx) {
    const itemErrors = getItemErrors(idx);
    const fieldsCount = Object.keys(itemErrors.fields || {}).length;
    const suppliersObj = itemErrors.suppliers || {};
    const suppliersCount = Object.values(suppliersObj).reduce(
      (acc, row) => acc + Object.keys(row || {}).length,
      0
    );

    return fieldsCount + suppliersCount > 0;
  }

  function clearFieldError(itemIdx, key) {
    setErrors((prev) => {
      const current = prev?.[itemIdx];

      if (!current?.fields?.[key]) return prev;

      const nextFields = { ...(current.fields || {}) };
      delete nextFields[key];

      return {
        ...prev,
        [itemIdx]: {
          fields: nextFields,
          suppliers: current.suppliers || {},
        },
      };
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
      nextSuppliers[rowIdx] = nextRow;

      return {
        ...prev,
        [itemIdx]: {
          fields: current.fields || {},
          suppliers: nextSuppliers,
        },
      };
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
        _client_id:
          crypto?.randomUUID?.() ?? `cid-${Date.now()}-${Math.random()}`,
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
      if (idx === prev) return 0;
      if (idx < prev) return prev - 1;
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
    await onSubmit({ requestItems });
  }

  const activeError = getItemErrors(activeIndex);

  return (
    <div
      role="dialog"
      aria-modal="true"
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
            <strong className="cmp-request-modal__title">Nova solicitação</strong>
            <span className="cmp-request-modal__subtitle">
              Preencha os itens e envie como um carrinho.
            </span>
          </div>

          <div className="cmp-request-modal__header-actions">
            <button
              type="button"
              onClick={requestClose}
              className="cmp-request-modal__button"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="cmp-request-modal__button cmp-request-modal__button--primary"
            >
              Enviar
            </button>
          </div>
        </header>

        <div className="cmp-request-modal__body">
          <aside className="cmp-request-modal__items">
            <div className="cmp-request-modal__items-header">
              <strong className="cmp-request-modal__items-title">Itens</strong>

              <button
                type="button"
                onClick={addItem}
                className="cmp-request-modal__button cmp-request-modal__button--compact"
              >
                + Item
              </button>
            </div>

            <div className="cmp-request-modal__items-list">
              {items.map((item, idx) => {
                const isActive = idx === activeIndex;
                const hasError = itemHasAnyError(idx);

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
                        <span className="cmp-request-modal__item-title">
                          Item #{idx + 1}
                        </span>

                        {hasError ? (
                          <span
                            title="Há campos obrigatórios faltando"
                            className="cmp-request-modal__item-error-badge"
                          >
                            !
                          </span>
                        ) : null}
                      </div>

                      <div className="cmp-request-modal__item-actions">
                        <button
                          type="button"
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
                      <span className="cmp-request-modal__pill">
                        {item.request_type_code === "UPDATE" ? "ALTERAR" : "CRIAR"}
                      </span>

                      <span className="cmp-request-modal__item-description">
                        {item.descricao ? item.descricao.slice(0, 40) : "Sem descrição"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>

          <main className="cmp-request-modal__editor">
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
          </main>
        </div>
      </div>
    </div>
  );
}