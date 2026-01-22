// src/pages/RequestsPage.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../app/auth/AuthContext";
import {
  listRequestItemsApi,
  getRequestApi,
  updateRequestFieldApi,
  changeRequestItemStatusApi,
  createRequestFieldApi,
} from "../app/api/requestsApi";

import { RequestItemFields } from "../app/ui/requests/RequestItemFields";
import {
  fieldsToFormState,
  fornecedoresToJson,
  validateStructuredItemFromTags,
  TAGS,
  REQUEST_TYPE_ID_UPDATE,
  REQUEST_TYPE_ID_CREATE,
  FIELD_TYPE_ID_TEXT,
} from "../app/ui/requests/requestItemFields.logic";

import { socket } from "../app/realtime/socket";

const ROLE_ADMIN = 1;
const ROLE_ANALYST = 2;

const STATUS = {
  CREATED: 1,
  IN_PROGRESS: 2,
  FINALIZED: 3,
  FAILED: 4,
  RETURNED: 5,
  REJECTED: 6,
};

function fmt(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function parseDateRange(dateFrom, dateTo) {
  let fromMs = null;
  let toMs = null;

  if (dateFrom) {
    const d = new Date(`${dateFrom}T00:00:00`);
    if (isValidDate(d)) fromMs = d.getTime();
  }

  if (dateTo) {
    const d = new Date(`${dateTo}T23:59:59.999`);
    if (isValidDate(d)) toMs = d.getTime();
  }

  return { fromMs, toMs };
}

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "min(86vh, 900px)",
          overflow: "hidden",
          background: "var(--surface)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ fontWeight: 800 }}>{title}</div>
          <button onClick={onClose}>Fechar</button>
        </div>

        <div style={{ overflow: "auto", padding: 12 }}>{children}</div>

        {footer ? (
          <div
            style={{
              padding: 12,
              borderTop: "1px solid var(--border)",
              background: "var(--surface-2)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RequestItemDetailsModal({ open, mode, row, onClose, onSaved }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isModerator = user?.role_id === ROLE_ADMIN || user?.role_id === ROLE_ANALYST;

  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [item, setItem] = useState(null);

  const [byTag, setByTag] = useState({});
  const [valuesByTag, setValuesByTag] = useState({});
  const [fornecedoresRows, setFornecedoresRows] = useState([]);

  const [saving, setSaving] = useState(false);
  const [editErrors, setEditErrors] = useState({ fields: {}, suppliers: {} });

  const isReturned = Number(row?.request_status_id) === STATUS.RETURNED;
  const isOwner = Number(row?.request_created_by) === Number(user?.id);

  const lockAfterDone =
    Number(row?.request_status_id) === STATUS.FINALIZED ||
    Number(row?.request_status_id) === STATUS.REJECTED;

  const isCreate = Number(row?.request_type_id) === REQUEST_TYPE_ID_CREATE;
  const isUpdate = Number(row?.request_type_id) === REQUEST_TYPE_ID_UPDATE;

  // ✅ edição NORMAL (campos gerais) só para criador quando RETURNED (e precisa ser mode edit)
  const canEditNormalFields = mode === "edit" && isOwner && isReturned && !lockAfterDone;

  // ✅ CREATE: ADMIN/ANALYST pode editar SOMENTE novo_codigo (inclusive no "Abrir")
  const canEditNovoCodigo = isModerator && isCreate && !lockAfterDone;

  // ✅ alguém pode salvar algo?
  const canSaveSomething = canEditNormalFields || canEditNovoCodigo;

  function hasAnyError(err) {
    const fc = Object.keys(err?.fields || {}).length;
    const sc = Object.values(err?.suppliers || {}).reduce((acc, r) => acc + Object.keys(r || {}).length, 0);
    return fc + sc > 0;
  }

  function setFieldError(tag, msg) {
    setEditErrors((prev) => ({
      fields: { ...(prev?.fields || {}), [tag]: msg },
      suppliers: prev?.suppliers || {},
    }));
  }

  function clearFieldError(tag) {
    setEditErrors((prev) => {
      const nextFields = { ...(prev?.fields || {}) };
      delete nextFields[tag];
      return { fields: nextFields, suppliers: prev?.suppliers || {} };
    });
  }

  function clearSupplierError(rowIdx, key) {
    setEditErrors((prev) => {
      const nextSup = { ...(prev?.suppliers || {}) };
      const nextRow = { ...(nextSup?.[rowIdx] || {}) };
      delete nextRow[key];
      nextSup[rowIdx] = nextRow;
      return { fields: prev?.fields || {}, suppliers: nextSup };
    });
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!open || !row?.request_id) return;
      try {
        setBusy(true);
        setError("");

        const full = await getRequestApi(row.request_id);
        if (!alive) return;

        const it = (full?.items || []).find((x) => Number(x.id) === Number(row.item_id));
        setItem(it || null);

        const st = fieldsToFormState(it?.fields || []);
        setByTag(st.byTag);
        setValuesByTag(st.values);
        setFornecedoresRows(st.fornecedoresRows);

        setEditErrors({ fields: {}, suppliers: {} });
      } catch (err) {
        if (!alive) return;
        setError(err?.response?.data?.error ?? "Erro ao carregar detalhes da solicitação.");
      } finally {
        if (alive) setBusy(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [open, row?.request_id, row?.item_id]);

  if (!open) return null;

  const typeName = row?.request_type?.type_name ?? `#${row?.request_type_id}`;
  const statusName = row?.request_status?.status_name ?? `#${row?.request_status_id}`;

  async function ensureTextFieldExists(tag, fieldValue) {
    const existing = byTag?.[tag];
    if (existing?.id) return existing.id;

    const res = await createRequestFieldApi(row.item_id, {
      field_type_id: FIELD_TYPE_ID_TEXT,
      field_tag: tag,
      field_value: String(fieldValue ?? ""),
      field_flag: null,
    });

    const newId = res?.id;
    if (newId) {
      setByTag((prev) => ({
        ...(prev || {}),
        [tag]: {
          id: newId,
          field_tag: tag,
          field_value: String(fieldValue ?? ""),
          field_type_id: FIELD_TYPE_ID_TEXT,
        },
      }));
    }
    return newId;
  }

  async function saveNormalFields() {
    const v = validateStructuredItemFromTags(valuesByTag, fornecedoresRows, isUpdate);
    setEditErrors(v);
    if (hasAnyError(v)) return false;

    const fields = Array.isArray(item.fields) ? item.fields : [];

    // TEXT fields existentes (menos fornecedores)
    for (const f of fields) {
      if (f.field_tag === TAGS.fornecedores) continue;

      const nextVal = String(valuesByTag?.[f.field_tag] ?? "");
      const prevVal = String(f.field_value ?? "");
      if (nextVal !== prevVal) {
        await updateRequestFieldApi(f.id, { field_value: nextVal });
      }
    }

    // fornecedores JSON
    const fornecedoresField = byTag?.[TAGS.fornecedores];
    if (fornecedoresField?.id) {
      const nextJson = fornecedoresToJson(fornecedoresRows);
      const prevJson = String(fornecedoresField.field_value ?? "");
      if (nextJson !== prevJson) {
        await updateRequestFieldApi(fornecedoresField.id, { field_value: nextJson });
      }
    }

    return true;
  }

  async function saveNovoCodigoOnly() {
    // CREATE: ADMIN/ANALYST podem salvar SOMENTE novo_codigo
    const v = String(valuesByTag?.[TAGS.novo_codigo] ?? "");

    const existing = byTag?.[TAGS.novo_codigo];
    let fieldId = existing?.id;

    // se não existe e está vazio, não cria (deixa para quando preencher)
    if (!fieldId && !String(v).trim()) return true;

    if (!fieldId) {
      fieldId = await ensureTextFieldExists(TAGS.novo_codigo, v);
      if (!fieldId) throw new Error("Falha ao criar o campo novo_codigo.");
    }

    const prevVal = String(existing?.field_value ?? "");
    if (v !== prevVal) {
      await updateRequestFieldApi(fieldId, { field_value: v });
      setByTag((prev) => ({
        ...(prev || {}),
        [TAGS.novo_codigo]: {
          ...(prev?.[TAGS.novo_codigo] || {}),
          id: fieldId,
          field_tag: TAGS.novo_codigo,
          field_value: v,
          field_type_id: FIELD_TYPE_ID_TEXT,
        },
      }));
    }

    return true;
  }

  async function handleSave() {
    if (!canSaveSomething || !item) return;

    try {
      setSaving(true);

      if (canEditNormalFields) {
        const ok = await saveNormalFields();
        if (!ok) return;
      }

      // IMPORTANTE: se for admin/analyst em CREATE, salva só novo_codigo
      if (canEditNovoCodigo && !canEditNormalFields) {
        const ok = await saveNovoCodigoOnly();
        if (!ok) return;
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(err?.response?.data?.error ?? err?.message ?? "Falha ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(newStatusId) {
    if (!isModerator) return;

    if (lockAfterDone) {
      alert("Solicitação FINALIZED/REJECTED não pode ser alterada.");
      return;
    }

    try {
      await changeRequestItemStatusApi(row.item_id, newStatusId);
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(err?.response?.data?.error ?? "Falha ao alterar status.");
    }
  }

  function goToConversation() {
    navigate(`/conversations/${row.conversation_id}?messageId=${row.message_id}`);
    onClose?.();
  }

  const saveLabel =
    canEditNovoCodigo && !canEditNormalFields ? "Salvar novo código" : "Salvar alterações";

  return (
    <ModalShell
      title={`Solicitação • Item #${row.item_id} • ${mode === "edit" ? "Editar" : "Visualizar"}`}
      onClose={onClose}
      footer={
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, padding: "4px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", fontWeight: 700 }}>
              Tipo: {typeName}
            </span>

            <span style={{ fontSize: 12, padding: "4px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)" }}>
              Status: {statusName}
            </span>

            <span style={{ fontSize: 12, opacity: 0.75 }}>
              Request #{row.request_id} • Message #{row.message_id} • Conversation #{row.conversation_id}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={goToConversation}>Ir para conversa</button>

            {isModerator ? (
              <>
                <button onClick={() => handleChangeStatus(STATUS.IN_PROGRESS)} disabled={lockAfterDone}>Em andamento</button>
                <button onClick={() => handleChangeStatus(STATUS.RETURNED)} disabled={lockAfterDone}>Devolver</button>
                <button onClick={() => handleChangeStatus(STATUS.REJECTED)} disabled={lockAfterDone}>Rejeitar</button>
                <button onClick={() => handleChangeStatus(STATUS.FINALIZED)} disabled={lockAfterDone}>Finalizar</button>
              </>
            ) : null}

            {canSaveSomething ? (
              <button onClick={handleSave} disabled={saving || (canEditNormalFields && hasAnyError(editErrors))}>
                {saving ? "Salvando..." : saveLabel}
              </button>
            ) : null}
          </div>
        </>
      }
    >
      {busy ? (
        <div>Carregando...</div>
      ) : error ? (
        <div style={{ padding: 10, border: "1px solid var(--danger-border)", background: "var(--danger-bg)", borderRadius: 8 }}>
          {error}
        </div>
      ) : !item ? (
        <div style={{ opacity: 0.8 }}>Item não encontrado dentro da request.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>Campos</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Criado por: {row.request_created_by_user?.full_name ?? "—"} • Criado em: {fmt(row.item_created_at)} • Atualizado em: {fmt(row.item_updated_at)}
            </div>
          </div>

          <RequestItemFields
            variant="fields"
            readOnly={!canEditNormalFields}
            // ✅ CREATE: permite editar só o novo_codigo (ADMIN/ANALYST), mesmo no "Abrir"
            canEditNovoCodigo={canEditNovoCodigo && !canEditNormalFields}
            requestTypeId={row?.request_type_id}
            valuesByTag={valuesByTag}
            onChangeTagValue={(tag, v) => {
              setValuesByTag((prev) => ({ ...(prev || {}), [tag]: v }));
              clearFieldError(tag);
            }}
            fornecedoresRows={fornecedoresRows}
            onChangeFornecedores={(rows) => setFornecedoresRows(rows)}
            errors={editErrors}
            onClearFieldError={(tag) => clearFieldError(tag)}
            onClearSupplierError={(rowIdx, key) => clearSupplierError(rowIdx, key)}
          />

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {lockAfterDone
              ? "Solicitação FINALIZED/REJECTED: edição bloqueada."
              : canEditNormalFields
                ? "Você pode editar os campos porque a solicitação foi devolvida (RETURNED)."
                : canEditNovoCodigo
                  ? "Você pode editar somente o campo 'novo_codigo' (CREATE) antes de rejeitar/finalizar."
                  : mode === "edit"
                    ? "Você não tem permissão para editar este item."
                    : "Modo visualização."}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

export default function RequestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isModerator = user?.role_id === ROLE_ADMIN || user?.role_id === ROLE_ANALYST;

  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  const [statusId, setStatusId] = useState("");

  const [createdByName, setCreatedByName] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateMode, setDateMode] = useState("AUTO");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsMode, setDetailsMode] = useState("view");
  const [selectedRow, setSelectedRow] = useState(null);

  function getRowSortTime(row) {
    const iso = row?.item_updated_at || row?.item_created_at;
    const t = iso ? new Date(iso).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }

  function getRowTimeForFilter(row) {
    if (dateMode === "UPDATED") return row?.item_updated_at || null;
    if (dateMode === "CREATED") return row?.item_created_at || null;
    return row?.item_updated_at || row?.item_created_at || null;
  }

  async function load({ resetOffset = false } = {}) {
    try {
      setBusy(true);
      setError("");

      const nextOffset = resetOffset ? 0 : offset;

      const data = await listRequestItemsApi({
        limit,
        offset: nextOffset,
        status_id: statusId ? Number(statusId) : null,
        created_by_name: createdByName?.trim() || null,
        type_id: /^\d+$/.test(typeFilter?.trim() || "") ? Number(typeFilter.trim()) : null,
        type_q: !/^\d+$/.test(typeFilter?.trim() || "") ? (typeFilter?.trim() || null) : null,
        item_id: itemFilter?.trim() ? Number(itemFilter.trim()) : null,
        date_mode: dateMode,
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });

      const items = Array.isArray(data?.items) ? data.items : [];
      items.sort((a, b) => getRowSortTime(b) - getRowSortTime(a));

      setRows(items);
      setTotal(Number(data?.total ?? 0));
      if (resetOffset) setOffset(0);
    } catch (err) {
      setError(err?.response?.data?.error ?? "Erro ao carregar solicitações.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset]);

  useEffect(() => {
    const onCreated = () => load({ resetOffset: false });
    const onItemChanged = () => load({ resetOffset: false });

    socket.on("request:created", onCreated);
    socket.on("request:item_changed", onItemChanged);

    return () => {
      socket.off("request:created", onCreated);
      socket.off("request:item_changed", onItemChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset, statusId]);

  const filteredRows = useMemo(() => {
    const nameQ = norm(createdByName);
    const typeQ = norm(typeFilter);
    const itemQ = norm(itemFilter);

    const { fromMs, toMs } = parseDateRange(dateFrom, dateTo);

    return (rows || []).filter((r) => {
      if (itemQ) {
        const itemId = String(r?.item_id ?? "");
        if (!norm(itemId).includes(itemQ)) return false;
      }

      if (typeQ) {
        const typeId = String(r?.request_type_id ?? "");
        const typeName = String(r?.request_type?.type_name ?? "");
        const hay = norm(`${typeId} ${typeName}`);
        if (!hay.includes(typeQ)) return false;
      }

      if (nameQ) {
        const fullName = String(r?.request_created_by_user?.full_name ?? "");
        const email = String(r?.request_created_by_user?.email ?? "");
        const hay = norm(`${fullName} ${email}`);
        if (!hay.includes(nameQ)) return false;
      }

      if (fromMs != null || toMs != null) {
        const iso = getRowTimeForFilter(r);
        if (!iso) return false;

        const t = new Date(iso).getTime();
        if (!Number.isFinite(t)) return false;

        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
      }

      return true;
    });
  }, [rows, createdByName, typeFilter, itemFilter, dateFrom, dateTo, dateMode]);

  const pageInfo = useMemo(() => {
    const start = total === 0 ? 0 : offset + 1;
    const end = Math.min(offset + limit, total);
    return { start, end };
  }, [offset, limit, total]);

  function openDetails(row, mode = "view") {
    setSelectedRow(row);
    setDetailsMode(mode);
    setDetailsOpen(true);
  }

  function closeDetails() {
    setDetailsOpen(false);
    setSelectedRow(null);
    setDetailsMode("view");
  }

  function goToConversation(row) {
    navigate(`/conversations/${row.conversation_id}?messageId=${row.message_id}`);
  }

  function clearFilters() {
    setStatusId("");
    setCreatedByName("");
    setTypeFilter("");
    setItemFilter("");
    setDateFrom("");
    setDateTo("");
    setDateMode("AUTO");
    setOffset(0);
    load({ resetOffset: true });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Solicitações</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            <option value="">Status (todos)</option>
            <option value={STATUS.CREATED}>CREATED</option>
            <option value={STATUS.IN_PROGRESS}>IN_PROGRESS</option>
            <option value={STATUS.FINALIZED}>FINALIZED</option>
            <option value={STATUS.RETURNED}>RETURNED</option>
            <option value={STATUS.REJECTED}>REJECTED</option>
            <option value={STATUS.FAILED}>FAILED</option>
          </select>

          {isModerator ? (
            <input
              placeholder="Criado por (nome ou e-mail)"
              value={createdByName}
              onChange={(e) => setCreatedByName(e.target.value)}
              style={{ width: 220 }}
            />
          ) : null}

          <input placeholder="Tipo (id ou nome)" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 180 }} />
          <input placeholder="Item (id)" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} style={{ width: 120 }} />

          <select value={dateMode} onChange={(e) => setDateMode(e.target.value)} title="Qual data filtrar?">
            <option value="AUTO">Data: Atualizado (ou Criado)</option>
            <option value="CREATED">Data: Criado</option>
            <option value="UPDATED">Data: Atualizado</option>
          </select>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="De (data)" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Até (data)" />

          <button onClick={() => load({ resetOffset: true })} disabled={busy}>
            Aplicar (status)
          </button>

          <button onClick={clearFilters} disabled={busy}>
            Limpar
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 10, border: "1px solid var(--danger-border)", background: "var(--danger-bg)", borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Filtrando na tela: <b>{filteredRows.length}</b> itens desta página (status é filtrado na API).
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Item</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Tipo</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Status</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Criado por</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Criado em</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Atualizado em</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Abrir</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Editar</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Conversa</th>
            </tr>
          </thead>

          <tbody>
            {busy ? (
              <tr>
                <td colSpan={9} style={{ padding: 12 }}>Carregando...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 12 }}>Nenhuma solicitação encontrada.</td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const isReturned = Number(r.request_status_id) === STATUS.RETURNED;
                const isOwner = Number(r.request_created_by) === Number(user?.id);
                const lockAfterDone =
                  Number(r.request_status_id) === STATUS.FINALIZED ||
                  Number(r.request_status_id) === STATUS.REJECTED;

                // ✅ EDITAR (campos normais): somente criador+returned
                const canEditNormal = isReturned && isOwner && !lockAfterDone;

                return (
                  <tr key={r.item_id}>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "grid" }}>
                        <span style={{ fontWeight: 700 }}>#{r.item_id}</span>
                      </div>
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {r.request_type?.type_name ?? r.request_type_id}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {r.request_status?.status_name ?? r.request_status_id}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {r.request_created_by_user?.full_name ?? "—"}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {fmt(r.item_created_at)}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {fmt(r.item_updated_at ? r.item_updated_at : "")}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      <button onClick={() => openDetails(r, "view")}>Abrir</button>
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {canEditNormal ? (
                        <button onClick={() => openDetails(r, "edit")}>Editar</button>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      <button onClick={() => goToConversation(r)}>Ir para conversa</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <span style={{ opacity: 0.8 }}>
          Mostrando {pageInfo.start}-{pageInfo.end} de {total}
        </span>

        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={busy || offset <= 0} onClick={() => setOffset((v) => Math.max(0, v - limit))}>
            Anterior
          </button>
          <button disabled={busy || offset + limit >= total} onClick={() => setOffset((v) => v + limit)}>
            Próxima
          </button>
        </div>
      </div>

      <RequestItemDetailsModal
        open={detailsOpen}
        mode={detailsMode}
        row={selectedRow}
        onClose={closeDetails}
        onSaved={() => load({ resetOffset: false })}
      />
    </div>
  );
}
