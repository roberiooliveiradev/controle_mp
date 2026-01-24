import { FIELD_TYPES } from "../../constants";
import { TAGS } from "./requestItemFields.logic";

/**
 * Metadados dos campos padrão (tags do item).
 * (Hoje você ainda renderiza na mão, mas isso já organiza e permite evoluir.)
 */
export const REQUEST_ITEM_FIELD_META = Object.freeze({
	[TAGS.codigo_atual]: {
		tag: TAGS.codigo_atual,
		label: "Código atual",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.novo_codigo]: {
		tag: TAGS.novo_codigo,
		label: "Novo código",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.grupo]: {
		tag: TAGS.grupo,
		label: "Grupo",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.descricao]: {
		tag: TAGS.descricao,
		label: "Descrição",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.tipo]: {
		tag: TAGS.tipo,
		label: "Tipo",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.armazem_padrao]: {
		tag: TAGS.armazem_padrao,
		label: "Armazém padrão",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.unidade]: {
		tag: TAGS.unidade,
		label: "Unidade",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.produto_terceiro]: {
		tag: TAGS.produto_terceiro,
		label: "Produto terceiro",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.cta_contabil]: {
		tag: TAGS.cta_contabil,
		label: "CTA contábil",
		field_type_id: FIELD_TYPES.TEXT,
	},
	[TAGS.ref_cliente]: {
		tag: TAGS.ref_cliente,
		label: "Ref. cliente",
		field_type_id: FIELD_TYPES.TEXT,
	},

	// fornecedores é JSON no banco
	[TAGS.fornecedores]: {
		tag: TAGS.fornecedores,
		label: "Fornecedores",
		field_type_id: FIELD_TYPES.JSON,
	},
});

/**
 * Schema das colunas da tabela de fornecedores (UI).
 */
export const SUPPLIER_COLUMNS = Object.freeze([
	{
		key: "supplier_code",
		header: "Código",
		width: 160,
		inputType: "text",
		placeholder: "Ex: 123",
		required: true,
	},
	{
		key: "store",
		header: "Loja",
		width: 120,
		inputType: "text",
		placeholder: "Ex: 01",
		required: true,
	},
	{
		key: "supplier_name",
		header: "Fornecedor",
		width: 320,
		inputType: "text",
		placeholder: "Nome do fornecedor",
		required: true,
	},
	{
		key: "part_number",
		header: "Part number",
		width: 220,
		inputType: "text",
		placeholder: "Ex: ABC-001",
		required: true,
	},
]);
