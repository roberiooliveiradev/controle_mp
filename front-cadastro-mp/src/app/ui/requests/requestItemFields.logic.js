// src/app/ui/requests/requestItemFields.logic.js

/**
 * IDs conforme seeds do banco
 * - request_type_id: CREATE/UPDATE
 * - request_status_id: CREATED (ou OPEN -> 1)
 * - field_type_id: DEFAULT/OBJECT (TEXT/JSON)
 */
export const REQUEST_TYPE_ID_CREATE = 1;
export const REQUEST_TYPE_ID_UPDATE = 2;
export const REQUEST_STATUS_ID_CREATED = 1;

export const FIELD_TYPE_ID_TEXT = 1;
export const FIELD_TYPE_ID_JSON = 2;

export const TAGS = {
  codigo_atual: "codigo_atual",
  grupo: "grupo",
  novo_codigo: "novo_codigo",
  // ✅ NOVO: código novo do executor (para CREATE)
  executor_codigo_novo: "executor_codigo_novo",

  descricao: "descricao",
  tipo: "tipo",
  armazem_padrao: "armazem_padrao",
  unidade: "unidade",
  produto_terceiro: "produto_terceiro",
  cta_contabil: "cta_contabil",
  ref_cliente: "ref_cliente",
  fornecedores: "fornecedores",
};

export function newSupplierRow() {
  return { supplier_code: "", store: "", supplier_name: "", part_number: "" };
}

export function newStructuredItem() {
  return {
    request_type_code: "CREATE", // CREATE | UPDATE (UI)
    codigo_atual: "",
    grupo: "",
    novo_codigo: "",
    // ❗ executor_codigo_novo NÃO é usado no composer (somente executor no details)
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

export function toRequestTypeId(code) {
  return code === "UPDATE" ? REQUEST_TYPE_ID_UPDATE : REQUEST_TYPE_ID_CREATE;
}

export function isBlank(v) {
  return !String(v ?? "").trim();
}

export function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function pushTextField(fields, tag, value) {
  const v = String(value ?? "").trim();
  if (!v) return;
  fields.push({
    field_type_id: FIELD_TYPE_ID_TEXT,
    field_tag: tag,
    field_value: v,
    field_flag: null,
  });
}

/**
 * Converte o "item estruturado" do Composer para payload de request_items.
 */
export function structuredItemToRequestPayloadItem(it) {
  const fields = [];
  const isUpdateItem = it.request_type_code === "UPDATE";

  // só enviar codigo_atual/novo_codigo se for UPDATE
  if (isUpdateItem) {
    pushTextField(fields, TAGS.codigo_atual, it.codigo_atual);
    pushTextField(fields, TAGS.novo_codigo, it.novo_codigo);
  }

  pushTextField(fields, TAGS.grupo, it.grupo);
  pushTextField(fields, TAGS.descricao, it.descricao);
  pushTextField(fields, TAGS.tipo, it.tipo);
  pushTextField(fields, TAGS.armazem_padrao, it.armazem_padrao);
  pushTextField(fields, TAGS.unidade, it.unidade);
  pushTextField(fields, TAGS.produto_terceiro, it.produto_terceiro);
  pushTextField(fields, TAGS.cta_contabil, it.cta_contabil);
  pushTextField(fields, TAGS.ref_cliente, it.ref_cliente);

  const fornecedores = Array.isArray(it.fornecedores) ? it.fornecedores : [];
  fields.push({
    field_type_id: FIELD_TYPE_ID_JSON,
    field_tag: TAGS.fornecedores,
    field_value: JSON.stringify(fornecedores),
    field_flag: null,
  });

  return {
    request_type_id: toRequestTypeId(it.request_type_code),
    request_status_id: REQUEST_STATUS_ID_CREATED,
    product_id: null,
    fields,
  };
}

/**
 * Validação do item estruturado do Composer.
 */
export function validateStructuredItem(it) {
  const fields = {};
  const suppliers = {};

  const update = it.request_type_code === "UPDATE";

  if (update && isBlank(it.codigo_atual))
    fields.codigo_atual = "Informe o código atual.";

  // sempre obrigatórios
  if (isBlank(it.grupo)) fields.grupo = "Campo obrigatório.";
  if (isBlank(it.descricao)) fields.descricao = "Campo obrigatório.";
  if (isBlank(it.tipo)) fields.tipo = "Campo obrigatório.";
  if (isBlank(it.armazem_padrao)) fields.armazem_padrao = "Campo obrigatório.";
  if (isBlank(it.unidade)) fields.unidade = "Campo obrigatório.";
  if (isBlank(it.produto_terceiro)) fields.produto_terceiro = "Campo obrigatório.";
  if (isBlank(it.cta_contabil)) fields.cta_contabil = "Campo obrigatório.";
  if (isBlank(it.ref_cliente)) fields.ref_cliente = "Campo obrigatório.";

  const rows = Array.isArray(it.fornecedores) ? it.fornecedores : [];
  rows.forEach((r, idx) => {
    const rowErr = {};
    if (isBlank(r.supplier_code)) rowErr.supplier_code = "Obrigatório.";
    if (isBlank(r.store)) rowErr.store = "Obrigatório.";
    if (isBlank(r.supplier_name)) rowErr.supplier_name = "Obrigatório.";
    if (isBlank(r.part_number)) rowErr.part_number = "Obrigatório.";
    if (Object.keys(rowErr).length) suppliers[idx] = rowErr;
  });

  return { fields, suppliers };
}

/**
 * Converte fields vindos do backend para form-state por tags.
 */
export function fieldsToFormState(fields) {
  const byTag = {};
  const values = {};

  (Array.isArray(fields) ? fields : []).forEach((f) => {
    byTag[f.field_tag] = f;
    values[f.field_tag] = f.field_value ?? "";
  });

  const fornecedoresField = byTag[TAGS.fornecedores];
  const fornecedoresRows = fornecedoresField?.field_value
    ? safeJsonParse(fornecedoresField.field_value, [])
    : [];

  return {
    byTag,
    values,
    fornecedoresRows: Array.isArray(fornecedoresRows) && fornecedoresRows.length
      ? fornecedoresRows
      : [newSupplierRow()],
  };
}

export function fornecedoresToJson(rows) {
  const safe = Array.isArray(rows) ? rows : [];
  return JSON.stringify(safe);
}

/**
 * Validação para edição (valuesByTag + fornecedoresRows).
 *
 * ✅ IMPORTANT:
 * - Não valida executor_codigo_novo aqui, porque:
 *   - Ele só é REQUIRED no momento de FINALIZAR (backend)
 *   - E só executor vê/edita (front controla)
 */
export function validateStructuredItemFromTags(valuesByTag, fornecedoresRows, isUpdate = false) {
  const fields = {};
  const suppliers = {};

  const get = (tag) => String(valuesByTag?.[tag] ?? "").trim();

  if (isUpdate && !get(TAGS.codigo_atual))
    fields[TAGS.codigo_atual] = "Informe o código atual.";

  // obrigatórios sempre
  if (!get(TAGS.grupo)) fields[TAGS.grupo] = "Campo obrigatório.";
  if (!get(TAGS.descricao)) fields[TAGS.descricao] = "Campo obrigatório.";
  if (!get(TAGS.tipo)) fields[TAGS.tipo] = "Campo obrigatório.";
  if (!get(TAGS.armazem_padrao)) fields[TAGS.armazem_padrao] = "Campo obrigatório.";
  if (!get(TAGS.unidade)) fields[TAGS.unidade] = "Campo obrigatório.";
  if (!get(TAGS.produto_terceiro)) fields[TAGS.produto_terceiro] = "Campo obrigatório.";
  if (!get(TAGS.cta_contabil)) fields[TAGS.cta_contabil] = "Campo obrigatório.";
  if (!get(TAGS.ref_cliente)) fields[TAGS.ref_cliente] = "Campo obrigatório.";

  const rows = Array.isArray(fornecedoresRows) ? fornecedoresRows : [];
  rows.forEach((r, idx) => {
    const rowErr = {};
    const v = (k) => String(r?.[k] ?? "").trim();

    if (!v("supplier_code")) rowErr.supplier_code = "Obrigatório.";
    if (!v("store")) rowErr.store = "Obrigatório.";
    if (!v("supplier_name")) rowErr.supplier_name = "Obrigatório.";
    if (!v("part_number")) rowErr.part_number = "Obrigatório.";

    if (Object.keys(rowErr).length) suppliers[idx] = rowErr;
  });

  return { fields, suppliers };
}
