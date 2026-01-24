// src/app/constants/roles.js

export const ROLES = Object.freeze({
	ADMIN: 1,
	ANALYST: 2,
	USER: 3,
});

export function isModerator(roleId) {
	return roleId === ROLES.ADMIN || roleId === ROLES.ANALYST;
}
