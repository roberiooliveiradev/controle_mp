// src/app/constants/requestStatus.js

export const REQUEST_STATUS = Object.freeze({
	CREATED: 1,
	IN_PROGRESS: 2,
	FINALIZED: 3,
	FAILED: 4,
	RETURNED: 5,
	REJECTED: 6,
});

export const LOCKED_STATUSES = new Set([
	REQUEST_STATUS.FINALIZED,
	REQUEST_STATUS.REJECTED,
]);
