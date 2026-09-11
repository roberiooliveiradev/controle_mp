/**
 * Persistência de campos de texto do item: atualiza tags existentes e
 * cria as que o formulário preencheu mas ainda não existem no backend.
 */
export function planTextFieldPersistence({
	textFieldTags = [],
	valuesByTag,
	byTag,
	skipTags = [],
} = {}) {
	const skip = new Set(skipTags);
	const ops = [];

	for (const tag of textFieldTags) {
		if (skip.has(tag)) continue;

		const nextVal = String(valuesByTag?.[tag] ?? "");
		const existing = byTag?.[tag];
		const fieldId = existing?.id;

		if (fieldId) {
			const prevVal = String(existing.field_value ?? "");
			if (nextVal !== prevVal) {
				ops.push({
					action: "update",
					tag,
					fieldId,
					field_value: nextVal,
				});
			}
			continue;
		}

		if (nextVal.trim()) {
			ops.push({
				action: "create",
				tag,
				field_value: nextVal,
			});
		}
	}

	return ops;
}
