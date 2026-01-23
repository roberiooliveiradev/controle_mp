// src/app/ui/toast.js
import { toast } from "react-hot-toast";

export function toastSuccess(msg) {
	if (!msg) return;
	toast.success(String(msg));
}

export function toastWarning(msg) {
	if (!msg) return;
	toast(String(msg), { icon: "⚠️" });
}

export function toastError(msg) {
	if (!msg) return;
	toast.error(String(msg));
}

export function toastFromApiPayload(data) {
	// suporta:
	// { warning: "..." }
	// { warnings: ["...", "..."] }
	// { message: "..." } (opcional)
	if (!data) return;

	const warning = data?.warning;
	if (warning) toastWarning(warning);

	const warnings = data?.warnings;
	if (Array.isArray(warnings)) {
		for (const w of warnings) toastWarning(w);
	}
}
