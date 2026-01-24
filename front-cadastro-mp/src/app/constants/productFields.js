export const PRODUCT_GROUP_OPTIONS = Object.freeze([
	{ value: "1001", text: "1001 - Cabos PVC 70 °C" },
	{ value: "1002", text: "1002 - Cabos PVC 105 °C" },
	{ value: "1003", text: "1003 - Cabos EPR 130 °C" },
	{ value: "1004", text: "1004 - Cabos Paralelos PVC" },
	{ value: "1005", text: "1005 - Cabos Silicone alta temperatura" },
	{ value: "1006", text: "1006 - Cabos PP com plug montado" },
	{ value: "1007", text: "1007 - Cabos PP sem plug" },
	{ value: "1008", text: "1008 - Terminais elétricos" },
	{ value: "1009", text: "1009 - Conectores e isoladores" },
	{ value: "1011", text: "1011 - Etiquetas técnicas" },
	{ value: "1012", text: "1012 - Tubos isolantes e corrugados" },
	{ value: "1013", text: "1013 - Termoencolhível em rolo" },
	{ value: "1050", text: "1050 - Termoencolhível e tubos cortados" },
	{ value: "1015", text: "1015 - Prensa-cabos" },
	{ value: "1016", text: "1016 - Resistores" },
	{ value: "1025", text: "1025 - Termistores e sensores térmicos" },
]);

export const UNIT_OPTIONS = Object.freeze([
	{ value: "PC", text: "PC - PECA" },
	{ value: "UN", text: "UN - UNIDADE" },
	{ value: "MM", text: "MM - MILÍMETRO" },
	{ value: "MT", text: "MT - METRO" },
	{ value: "L", text: "L - LITRO" },
	{ value: "G", text: "G - GRAMA" },
	{ value: "KG", text: "KG - QUILOGRAMA" },
	{ value: "MI", text: "MI - MILHEIROS" },
	{ value: "MI", text: "MI - MIL" },
	{ value: "CX", text: "CX - CAIXA" },
	{ value: "FD", text: "FD - FARDO" },
	{ value: "GL", text: "GL - GALAO" },
	{ value: "JG", text: "JG - JOGO" },
	{ value: "P", text: "P - PAR" },
	{ value: "RL", text: "RL - ROLO" },
	{ value: "RS", text: "RS - RESMA" },
]);

export const WAREHOUSE_OPTIONS = Object.freeze([
	{ value: "01", text: "01 - Almoxarifado" },
	{ value: "99", text: "99 - Fábrica" },
]);

export const YES_NO_OPTIONS = Object.freeze([
	{ value: "NAO", text: "NÃO" },
	{ value: "SIM", text: "SIM" },
]);

export const DEFAULT_VALUES = Object.freeze({
	TIPO: "MP",
	CTA_CONTABIL: "11401002",
	ARMAZEM_PADRAO: "01",
	PRODUTO_TERCEIRO: "NAO",
});
