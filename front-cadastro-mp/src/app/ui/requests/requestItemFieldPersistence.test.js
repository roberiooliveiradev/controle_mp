import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { planTextFieldPersistence } from "./requestItemFieldPersistence.js";

const TAGS = {
	descricao: "descricao",
	ref_cliente: "ref_cliente",
	novo_codigo: "novo_codigo",
};

const TEXT_FIELD_TAGS = [
	TAGS.descricao,
	TAGS.ref_cliente,
	TAGS.novo_codigo,
];

describe("planTextFieldPersistence", () => {
	it("P0 creates ref_cliente when the form has a value but the item has no field row", () => {
		const ops = planTextFieldPersistence({
			textFieldTags: TEXT_FIELD_TAGS,
			valuesByTag: { [TAGS.ref_cliente]: "UHC1200-BRZ" },
			byTag: {},
		});

		assert.deepEqual(ops, [
			{
				action: "create",
				tag: TAGS.ref_cliente,
				field_value: "UHC1200-BRZ",
			},
		]);
	});

	it("sibling updates descricao when the field already exists", () => {
		const ops = planTextFieldPersistence({
			textFieldTags: TEXT_FIELD_TAGS,
			valuesByTag: { [TAGS.descricao]: "NOVA DESC" },
			byTag: {
				[TAGS.descricao]: { id: 11, field_value: "DESC ANTIGA" },
			},
		});

		assert.deepEqual(ops, [
			{
				action: "update",
				tag: TAGS.descricao,
				fieldId: 11,
				field_value: "NOVA DESC",
			},
		]);
	});

	it("negative does not create an empty missing tag", () => {
		const ops = planTextFieldPersistence({
			textFieldTags: TEXT_FIELD_TAGS,
			valuesByTag: { [TAGS.ref_cliente]: "   " },
			byTag: {},
		});

		assert.deepEqual(ops, []);
	});

	it("negative skips novo_codigo on CREATE returned", () => {
		const ops = planTextFieldPersistence({
			textFieldTags: TEXT_FIELD_TAGS,
			valuesByTag: { [TAGS.novo_codigo]: "999" },
			byTag: {
				[TAGS.novo_codigo]: { id: 7, field_value: "111" },
			},
			skipTags: [TAGS.novo_codigo],
		});

		assert.deepEqual(ops, []);
	});
});
