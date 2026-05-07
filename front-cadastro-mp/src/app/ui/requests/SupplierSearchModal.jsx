import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { searchTotvsSuppliersApi } from "../../api/productsApi";
import "./SupplierSearchModal.css";

const PAGE_SIZE = 20;

function normalizeText(value) {
  return String(value ?? "").trim();
}

export function SupplierSearchModal({
  open,
  initialFilters,
  onClose,
  onConfirm,
}) {
  const [filters, setFilters] = useState({
    code: "",
    store: "",
    name: "",
  });

  const [items, setItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });

  const selected = useMemo(() => {
    if (selectedIndex === null) return null;
    return items[selectedIndex] ?? null;
  }, [items, selectedIndex]);

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const hasPreviousPage = pagination.offset > 0;
  const hasNextPage = pagination.offset + pagination.limit < pagination.total;

  useEffect(() => {
    if (!open) return;

    const nextFilters = {
      code: initialFilters?.code ?? "",
      store: initialFilters?.store ?? "",
      name: initialFilters?.name ?? "",
    };

    setFilters(nextFilters);
    setItems([]);
    setSelectedIndex(null);
    setError("");
    setPagination({
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    loadSuppliers({
      nextFilters,
      nextOffset: 0,
      keepSelection: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function setFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function loadSuppliers({
    nextFilters = filters,
    nextOffset = 0,
    keepSelection = false,
  } = {}) {
    const code = normalizeText(nextFilters.code);
    const store = normalizeText(nextFilters.store);
    const name = normalizeText(nextFilters.name);

    setLoading(true);
    setError("");

    if (!keepSelection) {
      setSelectedIndex(null);
    }

    try {
      const data = await searchTotvsSuppliersApi({
        code,
        store,
        name,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
      setPagination({
        total: Number(data?.total ?? 0),
        limit: Number(data?.limit ?? PAGE_SIZE),
        offset: Number(data?.offset ?? nextOffset),
      });
    } catch (err) {
      setItems([]);
      setPagination({
        total: 0,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setError(
        err?.response?.data?.error ?? "Falha ao buscar fornecedores no TOTVS."
      );
    } finally {
      setLoading(false);
    }
  }

  function searchSuppliers() {
    loadSuppliers({
      nextFilters: filters,
      nextOffset: 0,
      keepSelection: false,
    });
  }

  function goToPreviousPage() {
    if (!hasPreviousPage || loading) return;

    loadSuppliers({
      nextFilters: filters,
      nextOffset: Math.max(0, pagination.offset - pagination.limit),
      keepSelection: false,
    });
  }

  function goToNextPage() {
    if (!hasNextPage || loading) return;

    loadSuppliers({
      nextFilters: filters,
      nextOffset: pagination.offset + pagination.limit,
      keepSelection: false,
    });
  }

  function confirmSupplier(supplier) {
    if (!supplier) return;

    onConfirm?.({
      supplier_code: normalizeText(supplier.supplier_code).toUpperCase(),
      store: normalizeText(supplier.store).toUpperCase(),
      supplier_name: normalizeText(supplier.supplier_name).toUpperCase(),
    });
  }

  function confirmSelected() {
    confirmSupplier(selected);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="cmp-supplier-search-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose?.();
      }}
    >
      <div className="cmp-supplier-search-modal__panel">
        <header className="cmp-supplier-search-modal__header">
          <div>
            <strong className="cmp-supplier-search-modal__title">
              Buscar fornecedor
            </strong>
            <div className="cmp-supplier-search-modal__subtitle">
              Pesquise no TOTVS e confirme para preencher a linha selecionada.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cmp-supplier-search-modal__button"
          >
            Fechar
          </button>
        </header>

        <div className="cmp-supplier-search-modal__body">
          <div className="cmp-supplier-search-modal__filters">
            <label className="cmp-supplier-search-modal__field">
              <span>Código</span>
              <input
                value={filters.code}
                onChange={(event) => setFilter("code", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchSuppliers();
                }}
                placeholder="Ex: 123"
                autoFocus
              />
            </label>

            <label className="cmp-supplier-search-modal__field">
              <span>Loja</span>
              <input
                value={filters.store}
                onChange={(event) => setFilter("store", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchSuppliers();
                }}
                placeholder="Ex: 01"
              />
            </label>

            <label className="cmp-supplier-search-modal__field cmp-supplier-search-modal__field--wide">
              <span>Nome</span>
              <input
                value={filters.name}
                onChange={(event) => setFilter("name", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchSuppliers();
                }}
                placeholder="Nome do fornecedor"
              />
            </label>

            <button
              type="button"
              onClick={searchSuppliers}
              disabled={loading}
              className="cmp-supplier-search-modal__button cmp-supplier-search-modal__button--primary"
            >
              <Search
                aria-hidden="true"
                className="cmp-supplier-search-modal__icon"
              />
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {error ? (
            <div className="cmp-supplier-search-modal__error">{error}</div>
          ) : null}

          <div className="cmp-supplier-search-modal__table-wrap">
            <table className="cmp-supplier-search-modal__table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Loja</th>
                  <th>Fornecedor</th>
                </tr>
              </thead>

              <tbody>
                {items.length ? (
                  items.map((item, index) => {
                    const active = selectedIndex === index;

                    return (
                      <tr
                        key={`${item.supplier_code}|${item.store}|${index}`}
                        className={
                          active
                            ? "cmp-supplier-search-modal__row cmp-supplier-search-modal__row--active"
                            : "cmp-supplier-search-modal__row"
                        }
                        onClick={() => setSelectedIndex(index)}
                        onDoubleClick={() => confirmSupplier(item)}
                      >
                        <td>{item.supplier_code}</td>
                        <td>{item.store}</td>
                        <td>{item.supplier_name}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3}>
                      <span className="cmp-supplier-search-modal__empty">
                        {loading
                          ? "Carregando fornecedores..."
                          : "Nenhum fornecedor listado."}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="cmp-supplier-search-modal__pagination">
            <span className="cmp-supplier-search-modal__pagination-info">
              {pagination.total
                ? `Página ${currentPage} de ${totalPages} • ${pagination.total} fornecedor(es)`
                : "Nenhum fornecedor encontrado"}
            </span>

            <div className="cmp-supplier-search-modal__pagination-actions">
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={!hasPreviousPage || loading}
                className="cmp-supplier-search-modal__button cmp-supplier-search-modal__button--compact"
              >
                <ChevronLeft
                  aria-hidden="true"
                  className="cmp-supplier-search-modal__icon"
                />
                Anterior
              </button>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={!hasNextPage || loading}
                className="cmp-supplier-search-modal__button cmp-supplier-search-modal__button--compact"
              >
                Próxima
                <ChevronRight
                  aria-hidden="true"
                  className="cmp-supplier-search-modal__icon"
                />
              </button>
            </div>
          </div>
        </div>

        <footer className="cmp-supplier-search-modal__footer">
          <button
            type="button"
            onClick={onClose}
            className="cmp-supplier-search-modal__button"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!selected}
            onClick={confirmSelected}
            className="cmp-supplier-search-modal__button cmp-supplier-search-modal__button--primary"
          >
            Confirmar fornecedor
          </button>
        </footer>
      </div>
    </div>
  );
}
