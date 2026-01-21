// src/pages/RequestsPage.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../app/auth/AuthContext";
import {
	listRequestItemsApi,
	getRequestApi,
	updateRequestFieldApi,
	changeRequestItemStatusApi,
} from "../app/api/requestsApi";

import { RequestItemFields } from "../app/ui/requests/RequestItemFields";
import {
	fieldsToFormState,
	fornecedoresToJson,
	validateStructuredItemFromTags,
	TAGS,
	REQUEST_TYPE_ID_UPDATE,
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
	// dateFrom/dateTo no formato YYYY-MM-DD (input type="date")
	// retorna { fromMs, toMs } (toMs inclusivo até 23:59:59.999)
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
				// fecha ao clicar fora
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

function FieldRow({ field, value, editable, onChange }) {
	return (
		<div
			style={{
				border: "1px solid var(--border)",
				borderRadius: 12,
				padding: 10,
				background: "var(--surface)",
				display: "grid",
				gap: 8,
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
				<div style={{ fontWeight: 700 }}>{field.field_tag}</div>
				<div style={{ fontSize: 12, opacity: 0.7 }}>
					field_id: {field.id} • type: {field.field_type_id}
				</div>
			</div>

			{editable ? (
				<textarea
					value={value ?? ""}
					onChange={(e) => onChange(e.target.value)}
					rows={3}
					style={{
						width: "100%",
						padding: 10,
						borderRadius: 10,
						border: "1px solid var(--border-2)",
						background: "var(--surface)",
						outline: "none",
						resize: "vertical",
					}}
				/>
			) : (
				<div
					style={{
						padding: 10,
						borderRadius: 10,
						border: "1px solid var(--border)",
						background: "var(--surface-2)",
						whiteSpace: "pre-wrap",
					}}
				>
					{(value ?? "").trim() ? value : <span style={{ opacity: 0.55 }}>—</span>}
				</div>
			)}
		</div>
	);
}

function RequestItemDetailsModal({ open, mode, row, onClose, onSaved }) {
	const navigate = useNavigate();
	const { user } = useAuth();

	const canModerate = user?.role_id === ROLE_ADMIN || user?.role_id === ROLE_ANALYST;

	const [busy, setBusy] = useState(true);
	const [error, setError] = useState("");

	const [item, setItem] = useState(null);

	// form-state por tags
	const [byTag, setByTag] = useState({});
	const [valuesByTag, setValuesByTag] = useState({});
	const [fornecedoresRows, setFornecedoresRows] = useState([]);

	const [saving, setSaving] = useState(false);

	// ✅ validação obrigatórios na edição
	const [editErrors, setEditErrors] = useState({ fields: {}, suppliers: {} });

	const isReturned = Number(row?.request_status_id) === STATUS.RETURNED;
	const isOwner = Number(row?.request_created_by) === Number(user?.id);
	const canEditFields = mode === "edit" && isOwner && isReturned;

	function hasAnyError(err) {
		const fc = Object.keys(err?.fields || {}).length;
		const sc = Object.values(err?.suppliers || {}).reduce((acc, r) => acc + Object.keys(r || {}).length, 0);
		return fc + sc > 0;
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

				// ✅ reset erros ao abrir/recarregar
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

	async function handleSave() {
		if (!canEditFields || !item) return;

		// ✅ FIX: UPDATE depende do tipo do item/request, não do valor digitado
		const isUpdate = Number(row?.request_type_id) === REQUEST_TYPE_ID_UPDATE;

		const v = validateStructuredItemFromTags(valuesByTag, fornecedoresRows, isUpdate);
		setEditErrors(v);
		if (hasAnyError(v)) return;

		try {
			setSaving(true);

			// salva tags TEXT alteradas
			const fields = Array.isArray(item.fields) ? item.fields : [];
			for (const f of fields) {
				if (f.field_tag === TAGS.fornecedores) continue;

				const nextVal = String(valuesByTag?.[f.field_tag] ?? "");
				const prevVal = String(f.field_value ?? "");
				if (nextVal !== prevVal) {
					await updateRequestFieldApi(f.id, { field_value: nextVal });
				}
			}

			// salva fornecedores (JSON)
			const fornecedoresField = byTag?.[TAGS.fornecedores];
			if (fornecedoresField?.id) {
				const nextJson = fornecedoresToJson(fornecedoresRows);
				const prevJson = String(fornecedoresField.field_value ?? "");
				if (nextJson !== prevJson) {
					await updateRequestFieldApi(fornecedoresField.id, { field_value: nextJson });
				}
			}

			onSaved?.();
			onClose?.();
		} catch (err) {
			alert(err?.response?.data?.error ?? "Falha ao salvar alterações.");
		} finally {
			setSaving(false);
		}
	}

	async function handleChangeStatus(newStatusId) {
		if (!canModerate) return;

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

	return (
		<ModalShell
			title={`Solicitação • Item #${row.item_id} • ${mode === "edit" ? "Editar" : "Visualizar"}`}
			onClose={onClose}
			footer={
				<>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
						<span
							style={{
								fontSize: 12,
								padding: "4px 8px",
								borderRadius: 999,
								border: "1px solid var(--border)",
								background: "var(--surface)",
								fontWeight: 700,
							}}
						>
							Tipo: {typeName}
						</span>

						<span
							style={{
								fontSize: 12,
								padding: "4px 8px",
								borderRadius: 999,
								border: "1px solid var(--border)",
								background: "var(--surface)",
							}}
						>
							Status: {statusName}
						</span>

						<span style={{ fontSize: 12, opacity: 0.75 }}>
							Request #{row.request_id} • Message #{row.message_id} • Conversation #{row.conversation_id}
						</span>
					</div>

					<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
						<button onClick={goToConversation}>Ir para conversa</button>

						{canModerate ? (
							<>
								<button onClick={() => handleChangeStatus(STATUS.IN_PROGRESS)}>Em andamento</button>
								<button onClick={() => handleChangeStatus(STATUS.RETURNED)}>Devolver</button>
								<button onClick={() => handleChangeStatus(STATUS.REJECTED)}>Rejeitar</button>
								<button onClick={() => handleChangeStatus(STATUS.FINALIZED)}>Finalizar</button>
							</>
						) : null}

						{canEditFields ? (
							<button onClick={handleSave} disabled={saving || hasAnyError(editErrors)}>
								{saving ? "Salvando..." : "Salvar alterações"}
							</button>
						) : null}
					</div>
				</>
			}
		>
			{busy ? (
				<div>Carregando...</div>
			) : error ? (
				<div
					style={{
						padding: 10,
						border: "1px solid var(--danger-border)",
						background: "var(--danger-bg)",
						borderRadius: 8,
					}}
				>
					{error}
				</div>
			) : !item ? (
				<div style={{ opacity: 0.8 }}>Item não encontrado dentro da request.</div>
			) : (
				<div style={{ display: "grid", gap: 12 }}>
					<div style={{ display: "grid", gap: 6 }}>
						<div style={{ fontWeight: 800 }}>Campos</div>
						<div style={{ fontSize: 12, opacity: 0.75 }}>
							Criado por: {row.request_created_by_user?.full_name ?? "—"} • Criado em: {fmt(row.item_created_at)} • Atualizado em:{" "}
							{fmt(row.item_updated_at)}
						</div>
					</div>

					<RequestItemFields
						variant="fields"
						readOnly={!canEditFields}
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

					{canEditFields ? (
						hasAnyError(editErrors) ? (
							<div style={{ fontSize: 12, color: "var(--danger)" }}>Existem campos obrigatórios pendentes. Corrija antes de salvar.</div>
						) : (
							<div style={{ fontSize: 12, opacity: 0.7 }}>Preencha os obrigatórios e salve.</div>
						)
					) : (
						<div style={{ fontSize: 12, opacity: 0.7 }}>
							{mode === "edit"
								? "Você só pode editar quando o item estiver RETURNED e você for o criador."
								: "Modo visualização."}
						</div>
					)}
				</div>
			)}
		</ModalShell>
	);
}

export default function RequestsPage() {
	const navigate = useNavigate();
	const { user } = useAuth();

	const canModerate = user?.role_id === ROLE_ADMIN || user?.role_id === ROLE_ANALYST;

	const [busy, setBusy] = useState(true);
	const [error, setError] = useState("");

	const [rows, setRows] = useState([]);
	const [total, setTotal] = useState(0);

	const [limit] = useState(15);
	const [offset, setOffset] = useState(0);

	// ✅ mantém status como filtro server-side (já existente)
	const [statusId, setStatusId] = useState("");

	// ✅ novos filtros (client-side)
	const [createdByName, setCreatedByName] = useState("");
	const [typeFilter, setTypeFilter] = useState(""); // id ou nome
	const [itemFilter, setItemFilter] = useState(""); // item_id
	const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
	const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD
	const [dateMode, setDateMode] = useState("AUTO"); // "AUTO" | "CREATED" | "UPDATED"

	const [detailsOpen, setDetailsOpen] = useState(false);
	const [detailsMode, setDetailsMode] = useState("view"); // "view" | "edit"
	const [selectedRow, setSelectedRow] = useState(null);

	function getRowSortTime(row) {
		const iso = row?.item_updated_at || row?.item_created_at;
		const t = iso ? new Date(iso).getTime() : 0;
		return Number.isFinite(t) ? t : 0;
	}

	function getRowTimeForFilter(row) {
		// AUTO: updated_at se existir, senão created_at
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

			// se for número, manda type_id; senão manda type_q
			type_id: /^\d+$/.test(typeFilter?.trim() || "") ? Number(typeFilter.trim()) : null,
			type_q: !/^\d+$/.test(typeFilter?.trim() || "") ? (typeFilter?.trim() || null) : null,

			item_id: itemFilter?.trim() ? Number(itemFilter.trim()) : null,

			date_mode: dateMode,
			date_from: dateFrom || null,
			date_to: dateTo || null,
			});


			const items = Array.isArray(data?.items) ? data.items : [];

			// Ordena pela mais recente: updated_at se existir, senão created_at
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
			// 1) filtro por item
			if (itemQ) {
				const itemId = String(r?.item_id ?? "");
				if (!norm(itemId).includes(itemQ)) return false;
			}

			// 2) filtro por tipo (id ou nome)
			if (typeQ) {
				const typeId = String(r?.request_type_id ?? "");
				const typeName = String(r?.request_type?.type_name ?? "");
				const hay = norm(`${typeId} ${typeName}`);
				if (!hay.includes(typeQ)) return false;
			}

			// 3) filtro por criado por (nome)
			if (nameQ) {
				const fullName = String(r?.request_created_by_user?.full_name ?? "");
				const email = String(r?.request_created_by_user?.email ?? "");
				const hay = norm(`${fullName} ${email}`);
				if (!hay.includes(nameQ)) return false;
			}

			// 4) range de data (criação/alteração)
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
					{/* STATUS (mantém) */}
					<select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
						<option value="">Status (todos)</option>
						<option value={STATUS.CREATED}>CREATED</option>
						<option value={STATUS.IN_PROGRESS}>IN_PROGRESS</option>
						<option value={STATUS.FINALIZED}>FINALIZED</option>
						<option value={STATUS.RETURNED}>RETURNED</option>
						<option value={STATUS.REJECTED}>REJECTED</option>
						<option value={STATUS.FAILED}>FAILED</option>
					</select>

					{/* Nome do usuário (em vez de id) */}
					{canModerate ? (
						<input
							placeholder="Criado por (nome ou e-mail)"
							value={createdByName}
							onChange={(e) => setCreatedByName(e.target.value)}
							style={{ width: 220 }}
						/>
					) : null}

					{/* Tipo */}
					<input
						placeholder="Tipo (id ou nome)"
						value={typeFilter}
						onChange={(e) => setTypeFilter(e.target.value)}
						style={{ width: 180 }}
					/>

					{/* Item */}
					<input
						placeholder="Item (id)"
						value={itemFilter}
						onChange={(e) => setItemFilter(e.target.value)}
						style={{ width: 120 }}
					/>

					{/* Datas */}
					<select value={dateMode} onChange={(e) => setDateMode(e.target.value)} title="Qual data filtrar?">
						<option value="AUTO">Data: Atualizado (ou Criado)</option>
						<option value="CREATED">Data: Criado</option>
						<option value="UPDATED">Data: Atualizado</option>
					</select>

					<input
						type="date"
						value={dateFrom}
						onChange={(e) => setDateFrom(e.target.value)}
						title="De (data)"
					/>
					<input
						type="date"
						value={dateTo}
						onChange={(e) => setDateTo(e.target.value)}
						title="Até (data)"
					/>

					<button onClick={() => load({ resetOffset: true })} disabled={busy}>
						Aplicar (status)
					</button>

					<button onClick={clearFilters} disabled={busy}>
						Limpar
					</button>
				</div>
			</div>

			{error ? (
				<div
					style={{
						padding: 10,
						border: "1px solid var(--danger-border)",
						background: "var(--danger-bg)",
						borderRadius: 8,
					}}
				>
					{error}
				</div>
			) : null}

			{/* Aviso pequeno sobre filtros client-side (para não confundir total/paginação) */}
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
								<td colSpan={8} style={{ padding: 12 }}>
									Carregando...
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td colSpan={8} style={{ padding: 12 }}>
									Nenhuma solicitação encontrada.
								</td>
							</tr>
						) : (
							filteredRows.map((r) => {
								const isReturned = Number(r.request_status_id) === STATUS.RETURNED;
								const isOwner = Number(r.request_created_by) === Number(user?.id);
								const canEdit = isReturned && isOwner; // ✅ regra do pedido

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
											{canEdit ? (
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
