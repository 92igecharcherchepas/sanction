const fs = require('node:fs');
const path = require('node:path');
const { defaultPermissionLevels } = require('../commands');

const dataPath = path.join(__dirname, '..', 'sanctions.json');
const defaultTempMutePresets = {
	insulte: { label: 'Insulte', duration: '20m', reason: 'Insulte' },
};
function loadData() {
	if (!fs.existsSync(dataPath)) return { sanctions: [], permissions: { ...defaultPermissionLevels }, permissionRoles: {}, panelUsers: [], tempMutePresets: { ...defaultTempMutePresets }, autoLog: { enabled: false, sourceGuildId: null, targetGuildId: null, categoryId: null, channels: {} } };
	try {
		const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
		return {
			sanctions: Array.isArray(data.sanctions) ? data.sanctions : [],
			permissions: { ...defaultPermissionLevels, ...(data.permissions || {}) },
			permissionRoles: data.permissionRoles && typeof data.permissionRoles === 'object' ? data.permissionRoles : {},
			panelUsers: Array.isArray(data.panelUsers) ? data.panelUsers : [],
			tempMutePresets: data.tempMutePresets && typeof data.tempMutePresets === 'object' ? { ...defaultTempMutePresets, ...data.tempMutePresets } : { ...defaultTempMutePresets },
			autoLog: data.autoLog && typeof data.autoLog === 'object' ? { enabled: Boolean(data.autoLog.enabled), sourceGuildId: data.autoLog.sourceGuildId || null, targetGuildId: data.autoLog.targetGuildId || null, categoryId: data.autoLog.categoryId || null, channels: data.autoLog.channels || {} } : { enabled: false, sourceGuildId: null, targetGuildId: null, categoryId: null, channels: {} },
		};
	} catch {
		return { sanctions: [], permissions: { ...defaultPermissionLevels }, permissionRoles: {}, panelUsers: [], tempMutePresets: { ...defaultTempMutePresets }, autoLog: { enabled: false, sourceGuildId: null, targetGuildId: null, categoryId: null, channels: {} } };
	}
}

function saveData(data) {
	fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
}

function getPermissionLevel(member, data) {
	if (member.id === process.env.OWNER_ID) return 9;
	let highest = 0;
	for (let level = 1; level <= 9; level += 1) {
		const roleIds = Array.isArray(data.permissionRoles[level]) ? data.permissionRoles[level] : [];
		if (roleIds.some((roleId) => member.roles.cache.has(roleId))) highest = Math.max(highest, level);
	}
	return highest;
}

function requiredLevel(commandName, data) {
	return Object.prototype.hasOwnProperty.call(data.permissions, commandName) ? Number(data.permissions[commandName]) : defaultPermissionLevels[commandName] || 1;
}

function isSystemUser(userId, data) {
	return userId === process.env.OWNER_ID || data.panelUsers.includes(userId);
}

module.exports = { getPermissionLevel, isSystemUser, loadData, requiredLevel, saveData };