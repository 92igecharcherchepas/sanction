const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { defaultPermissionLevels } = require('../commands');
const { getPermissionLevel, isSystemUser, loadData, requiredLevel, saveData } = require('../utils/config');
const { configureAutoLog, logAction } = require('../utils/autolog');
const { v2Container, v2Reply, v2Update } = require('../utils/components');
const { formatDuration, listButtons, makeListText, parseDuration } = require('../utils/sanctions');

const EMBED_GREY = 0x808080;
const commandLabels = { tempmute: 'Mute temporaire', unmute: 'Retirer un mute', ban: 'Bannir', unban: 'Débannir', baninfo: 'Informations de ban', sanctionlist: 'Liste des sanctions', mutelist: 'Liste des mutes', perms: 'Voir les rôles perm', helpall: 'Voir cette aide', delsanction: 'Supprimer une sanction' };

function panelMenu() {
	return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('panel:select').setPlaceholder('Choisir une configuration').addOptions(
		{ label: 'Rôles perm', value: 'roles', description: 'Définir les rôles de perm1 à perm9' },
		{ label: 'Permissions commandes', value: 'commands', description: 'Modifier le perm minimum des commandes' },
		{ label: 'Accès au panel', value: 'users', description: 'Ajouter ou retirer un utilisateur autorisé' },
	));
}

function panelModal(type) {
	const modal = new ModalBuilder().setCustomId(`panel:modal:${type}`).setTitle(type === 'roles' ? 'Configurer les rôles perm' : type === 'commands' ? 'Configurer une commande' : 'Gérer un accès panel');
	if (type === 'roles') {
		modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('level').setLabel('Niveau (ex: perm2)').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('roles').setLabel('IDs des rôles, séparés par des virgules').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Laisser vide pour retirer les rôles')));
	}
	if (type === 'commands') {
		modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('command').setLabel('Commande sans / (ex: tempmute)').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('level').setLabel('Niveau minimum (ex: perm2)').setStyle(TextInputStyle.Short).setRequired(true)));
	}
	if (type === 'users') {
		modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('action').setLabel('Action : ajouter ou retirer').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('user').setLabel('ID de l’utilisateur Discord').setStyle(TextInputStyle.Short).setRequired(true)));
	}
	return modal;
}

function helpMenu() {
	return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('helpall:select').setPlaceholder('Choisir un niveau de permission').addOptions(Array.from({ length: 9 }, (_, index) => ({ label: `perm${index + 1}`, value: String(index + 1), description: `Commandes du niveau perm${index + 1}` }))));
}

function helpText(data, level) {
	const commands = Object.keys(defaultPermissionLevels).filter((name) => (Object.prototype.hasOwnProperty.call(data.permissions, name) ? Number(data.permissions[name]) : defaultPermissionLevels[name]) > 0 && (Object.prototype.hasOwnProperty.call(data.permissions, name) ? Number(data.permissions[name]) : defaultPermissionLevels[name]) <= level);
	const text = commands.length ? commands.map((name) => `**/${name}** — ${commandLabels[name] || name}`).join('\n') : 'Aucune commande configurée pour ce niveau.';
	return `# Commandes perm${level}\n${text}`;
}

function tempMuteMenu(data, action) {
	const options = Object.entries(data.tempMutePresets).slice(0, 25).map(([key, preset]) => ({ label: preset.label.slice(0, 100), value: key, description: `${preset.duration} · ${preset.reason}`.slice(0, 100) }));
	const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`tempmute:${action}`).setPlaceholder(action === 'apply' ? 'Choisir une sanction' : 'Choisir un preset à modifier').addOptions(options.length ? options : [{ label: 'Aucun preset', value: 'none' }]));
	return action === 'edit' ? [row, new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tempmute:new').setLabel('Créer un preset').setStyle(ButtonStyle.Success))] : [row];
}

function tempMuteModal(key, preset) {
	const modal = new ModalBuilder().setCustomId(`tempmute:modal:${key}`).setTitle(key === 'new' ? 'Créer un preset de mute' : 'Modifier le preset de mute');
	const name = new TextInputBuilder().setCustomId('name').setLabel('Nom du preset').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80);
	const duration = new TextInputBuilder().setCustomId('duration').setLabel('Durée (ex: 20m, 2h, 7d)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10);
	const reason = new TextInputBuilder().setCustomId('reason').setLabel('Raison affichée').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200);
	if (preset) { name.setValue(preset.label); duration.setValue(preset.duration); reason.setValue(preset.reason); }
	return modal.addComponents(new ActionRowBuilder().addComponents(name), new ActionRowBuilder().addComponents(duration), new ActionRowBuilder().addComponents(reason));
}

function canActOn(member, target) {
	return target.id !== member.id && target.roles.highest.position < member.roles.highest.position;
}

async function handleCommand(interaction) {
	const data = loadData();
	const isOwner = interaction.user.id === process.env.OWNER_ID;
	const isSys = isSystemUser(interaction.user.id, data);
	if (interaction.commandName === 'panel') {
		if (!isSys) return v2Reply(interaction, 'Tu n’as pas accès au panel.');
		return v2Reply(interaction, '# Panel de configuration\nChoisis une rubrique dans le menu pour modifier la configuration du bot.', [panelMenu()]);
	}
	if (interaction.commandName === 'autolog') {
		if (!isSys) return v2Reply(interaction, 'Seuls le propriétaire et les sys peuvent gérer les logs automatiques.');
		const action = interaction.options.getString('action') || 'activer';
		const targetGuildId = interaction.options.getString('serveur_id');
		if (action === 'configurer') {
			if (!targetGuildId || !/^\d{17,20}$/.test(targetGuildId)) return v2Reply(interaction, 'Indique un ID de serveur Discord valide.');
			if (targetGuildId === interaction.guild.id) return v2Reply(interaction, 'Le serveur de logs doit être différent du serveur officiel.');
			const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
			if (!targetGuild) return v2Reply(interaction, 'Le bot n’est pas présent sur ce serveur de logs. Ajoute-le aux deux serveurs avec les permissions de gestion des salons.');
			data.autoLog.targetGuildId = targetGuildId;
			data.autoLog.sourceGuildId = interaction.guild.id;
			data.autoLog.categoryId = null;
			data.autoLog.channels = {};
			data.autoLog.enabled = false;
			saveData(data);
			return v2Reply(interaction, `Serveur de logs configuré : **${targetGuild.name}**. Lance maintenant la commande /autolog activer.`, [], false);
		}
		if (action === 'activer' && !data.autoLog.targetGuildId) {
			return v2Reply(interaction, 'Configure d’abord un serveur logs avec `/autolog configurer serveur_id:ID`.', [], false);
		}
		const targetGuild = data.autoLog.targetGuildId ? interaction.client.guilds.cache.get(data.autoLog.targetGuildId) : interaction.guild;
		if (!targetGuild) return v2Reply(interaction, 'Le serveur de logs configuré est inaccessible ou le bot n’y est plus présent.');
		const message = await configureAutoLog(targetGuild, data, action === 'activer');
		saveData(data);
		return v2Reply(interaction, `${message}\nServeur de logs : **${targetGuild.name}**.`, [], false);
	}
	if (interaction.commandName === 'del' && interaction.options.getSubcommand() === 'perm') {
		if (!isSys) return v2Reply(interaction, 'Seuls le propriétaire et les sys peuvent modifier les permissions.');
		const commandName = interaction.options.getString('commande');
		data.permissions[commandName] = 0;
		saveData(data);
		return v2Reply(interaction, `✅ **/${commandName}** est maintenant désactivée avec le niveau **0**. Personne ne peut l’utiliser.`, [], false);
	}
	if (interaction.commandName === 'sys') {
		const action = interaction.options.getSubcommand();
		if (action === 'list') {
			if (!isSys) return v2Reply(interaction, 'Seuls le propriétaire et les sys peuvent voir la liste.');
			const users = data.panelUsers.length ? data.panelUsers.map((userId) => `<@${userId}>`).join('\n') : 'Aucun sys ajouté.';
			return v2Reply(interaction, `# Sys du bot\n**Propriétaire**\n<@${process.env.OWNER_ID}>\n\n**Sys autorisés**\n${users}`, [], false);
		}
		if (!isOwner) return v2Reply(interaction, 'Seul le propriétaire du bot peut ajouter ou retirer un sys.');
		const userId = interaction.options.getUser('utilisateur').id;
		if (userId === process.env.OWNER_ID) return v2Reply(interaction, 'Le propriétaire est déjà sys par défaut.');
		if (action === 'add') {
			if (!data.panelUsers.includes(userId)) data.panelUsers.push(userId);
			saveData(data);
			return v2Reply(interaction, `✅ <@${userId}> est maintenant sys du bot et peut utiliser /panel.`, [], false);
		}
		data.panelUsers = data.panelUsers.filter((id) => id !== userId);
		saveData(data);
		return v2Reply(interaction, `✅ <@${userId}> n’est plus sys du bot.`, [], false);
	}
	const level = getPermissionLevel(interaction.member, data);
	const configuredRequired = requiredLevel(interaction.commandName, data);
	if (configuredRequired === 0) return v2Reply(interaction, 'Cette commande est actuellement désactivée par sa configuration.');
	const required = isSys ? 0 : configuredRequired;
	if (level < required) return v2Reply(interaction, `Permission insuffisante. Niveau requis : **perm${required}**.`);

	if (interaction.commandName === 'set') {
		const commandName = interaction.options.getString('commande');
		const permissionLevel = Number(interaction.options.getString('niveau'));
		data.permissions[commandName] = permissionLevel;
		saveData(data);
		return v2Reply(interaction, `✅ **/${commandName}** nécessite désormais **perm${permissionLevel}**. Les niveaux supérieurs sont également autorisés.`, [], false);
	}

	if (interaction.commandName === 'perms') {
		const selectedLevel = interaction.options.getString('niveau');
		const levels = selectedLevel ? [Number(selectedLevel)] : Array.from({ length: 9 }, (_, index) => index + 1);
		const fields = levels.map((permissionLevel) => {
			const roleIds = Array.isArray(data.permissionRoles[permissionLevel]) ? data.permissionRoles[permissionLevel] : [];
			const roles = roleIds.map((roleId) => interaction.guild.roles.cache.get(roleId)).filter(Boolean);
			return { name: `perm${permissionLevel}`, value: roles.length ? roles.map((role) => `${role}`).join('\n') : 'Aucun rôle configuré', inline: false };
		});
		return v2Reply(interaction, fields.map((field) => `## ${field.name}\n${field.value}`).join('\n\n'), [], false);
	}

	if (interaction.commandName === 'helpall') {
		return v2Reply(interaction, helpText(data, 1), [helpMenu()], false);
	}

	const reason = interaction.options.getString('raison') || 'Aucune raison indiquée';
	if (interaction.commandName === 'tempmute') {
		const member = interaction.options.getMember('membre');
		if (interaction.options.getSubcommand() === 'modif') return v2Reply(interaction, '## Presets tempmute\nChoisis un preset à modifier ou crée-en un nouveau.', tempMuteMenu(data, 'edit'));
		if (!member || !canActOn(interaction.member, member)) return v2Reply(interaction, 'Membre introuvable ou rôle supérieur/égal au tien.');
		return v2Reply(interaction, `## Choisir une sanction\nMembre : <@${member.id}>`, tempMuteMenu(data, `apply:${member.id}`));
	}

	if (interaction.commandName === 'unmute') {
		const member = interaction.options.getMember('membre');
		if (!member) return v2Reply(interaction, 'Membre introuvable.');
		await member.timeout(null, reason);
		data.sanctions.push({ id: `S-${Date.now().toString(36).toUpperCase()}`, type: 'UNMUTE', userId: member.id, moderatorId: interaction.user.id, reason, createdAt: new Date().toISOString() });
		saveData(data);
		await logAction(interaction, data, 'unmute', `Membre : <@${member.id}>\nModérateur : <@${interaction.user.id}>\nRaison : ${reason}`);
		return v2Reply(interaction, `🔊 <@${member.id}> n'est plus mute.`, [], false);
	}

	if (interaction.commandName === 'ban') {
		const member = interaction.options.getMember('membre');
		if (!member || !canActOn(interaction.member, member)) return v2Reply(interaction, 'Membre introuvable ou rôle supérieur/égal au tien.');
		await member.ban({ reason });
		data.sanctions.push({ id: `S-${Date.now().toString(36).toUpperCase()}`, type: 'BAN', userId: member.id, moderatorId: interaction.user.id, reason, createdAt: new Date().toISOString() });
		saveData(data);
		await logAction(interaction, data, 'ban', `Membre : <@${member.id}>\nModérateur : <@${interaction.user.id}>\nRaison : ${reason}`);
		return v2Reply(interaction, `⛔ <@${member.id}> a été banni. Raison : ${reason}`, [], false);
	}

	if (interaction.commandName === 'unban') {
		const userId = interaction.options.getString('utilisateur');
		try { await interaction.guild.members.unban(userId, reason); } catch { return v2Reply(interaction, 'Utilisateur non banni ou identifiant invalide.'); }
		data.sanctions.push({ id: `S-${Date.now().toString(36).toUpperCase()}`, type: 'UNBAN', userId, moderatorId: interaction.user.id, reason, createdAt: new Date().toISOString() });
		saveData(data);
		await logAction(interaction, data, 'unban', `Utilisateur : <@${userId}>\nModérateur : <@${interaction.user.id}>\nRaison : ${reason}`);
		return v2Reply(interaction, `✅ <@${userId}> a été débanni.`, [], false);
	}

	if (interaction.commandName === 'baninfo') {
		const userId = interaction.options.getString('utilisateur');
		const bans = data.sanctions.filter((item) => item.userId === userId && item.type === 'BAN');
		if (!bans.length) return v2Reply(interaction, 'Aucun bannissement enregistré pour cet utilisateur.');
		const last = bans.at(-1);
		return v2Reply(interaction, `# Baninfo · ${userId}\n**Sanction**\n${last.id}\n**Modérateur**\n<@${last.moderatorId}>\n**Raison**\n${last.reason}`, [], false);
	}

	if (interaction.commandName === 'sanctionlist' || interaction.commandName === 'mutelist') {
		const isMute = interaction.commandName === 'mutelist';
		const sanctions = data.sanctions.filter((item) => isMute ? item.type === 'TEMPMUTE' && new Date(item.expiresAt) > new Date() : true);
		const result = makeListText(isMute ? 'Mutes actifs' : 'Historique des sanctions', sanctions, 0);
		return v2Reply(interaction, result.text, [listButtons(isMute ? 'mutes' : 'sanctions', result.page, result.totalPages)], false);
	}

	if (interaction.commandName === 'delsanction') {
		const id = interaction.options.getString('id').toUpperCase();
		if (!data.sanctions.some((sanction) => sanction.id === id)) return v2Reply(interaction, 'Sanction introuvable.');
		const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`delete:${id}`).setLabel('Confirmer la suppression').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('delete:cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary));
		return v2Reply(interaction, `Supprimer **${id}** de l'historique ?`, [row]);
	}
}

async function handleButton(interaction) {
	if (interaction.customId === 'tempmute:new') return interaction.showModal(tempMuteModal('new'));
	if (interaction.customId === 'delete:cancel') return v2Update(interaction, 'Suppression annulée.');
	if (interaction.customId.startsWith('delete:')) {
		const id = interaction.customId.split(':')[1];
		const data = loadData();
		data.sanctions = data.sanctions.filter((item) => item.id !== id);
		saveData(data);
		await logAction(interaction, data, 'sanctions', `Sanction supprimée : **${id}**\nModérateur : <@${interaction.user.id}>`);
		return v2Update(interaction, `Sanction **${id}** supprimée de l'historique.`);
	}
	const [prefix, direction, currentPage] = interaction.customId.split(':');
	const data = loadData();
	const sanctions = prefix === 'mutes' ? data.sanctions.filter((item) => item.type === 'TEMPMUTE' && new Date(item.expiresAt) > new Date()) : data.sanctions;
	const result = makeListText(prefix === 'mutes' ? 'Mutes actifs' : 'Historique des sanctions', sanctions, Number(currentPage) + (direction === 'next' ? 1 : -1));
	return v2Update(interaction, result.text, [listButtons(prefix, result.page, result.totalPages)]);
}

async function handleSelectMenu(interaction) {
	if (interaction.customId === 'tempmute:edit') {
		const preset = loadData().tempMutePresets[interaction.values[0]];
		if (!preset) return v2Reply(interaction, 'Preset introuvable.');
		return interaction.showModal(tempMuteModal(interaction.values[0], preset));
	}
	if (interaction.customId.startsWith('tempmute:apply:')) {
		const memberId = interaction.customId.split(':')[2];
		const data = loadData();
		const preset = data.tempMutePresets[interaction.values[0]];
		const member = await interaction.guild.members.fetch(memberId).catch(() => null);
		const duration = preset && parseDuration(preset.duration);
		if (!preset || !duration || duration > 28 * 86400) return v2Update(interaction, 'Ce preset est invalide ou dépasse 28 jours.');
		if (!member || !canActOn(interaction.member, member)) return v2Update(interaction, 'Ce membre est introuvable ou possède un rôle supérieur/égal au tien.');
		await member.timeout(duration * 1000, preset.reason);
		data.sanctions.push({ id: `S-${Date.now().toString(36).toUpperCase()}`, type: 'TEMPMUTE', userId: member.id, moderatorId: interaction.user.id, reason: preset.reason, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + duration * 1000).toISOString() });
		saveData(data);
		await logAction(interaction, data, 'tempmute', `Membre : <@${member.id}>\nModérateur : <@${interaction.user.id}>\nDurée : ${formatDuration(duration)}\nRaison : ${preset.reason}`);
		return v2Update(interaction, `🔇 <@${member.id}> est mute pour **${formatDuration(duration)}**. Raison : ${preset.reason}`);
	}
	if (interaction.customId === 'panel:select') return interaction.showModal(panelModal(interaction.values[0]));
	if (interaction.customId !== 'helpall:select') return;
	const level = Number(interaction.values[0]);
	return v2Update(interaction, helpText(loadData(), level), [helpMenu()]);
}

async function handleModal(interaction) {
	if (interaction.customId.startsWith('tempmute:modal:')) {
		const data = loadData();
		const presetKey = interaction.customId.split(':')[2];
		const label = interaction.fields.getTextInputValue('name').trim();
		const duration = interaction.fields.getTextInputValue('duration').trim();
		const reason = interaction.fields.getTextInputValue('reason').trim();
		const seconds = parseDuration(duration);
		const key = presetKey === 'new' ? label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : presetKey;
		if (!key || !seconds || seconds > 28 * 86400 || !label || !reason) return v2Reply(interaction, 'Nom, raison ou durée invalide. Utilise `20m`, `2h` ou `7d`, avec un maximum de 28 jours.');
		data.tempMutePresets[key] = { label, duration, reason };
		saveData(data);
		return v2Reply(interaction, `Preset **${label}** enregistré pour **${duration}**.`);
	}
	if (!interaction.customId.startsWith('panel:modal:')) return;
	const data = loadData();
	const type = interaction.customId.split(':')[2];

	if (type === 'roles') {
		const match = /^PERM([1-9])$/i.exec(interaction.fields.getTextInputValue('level').trim());
		const roleIds = interaction.fields.getTextInputValue('roles').split(',').map((roleId) => roleId.trim()).filter(Boolean);
		if (!match || roleIds.some((roleId) => !/^\d{17,20}$/.test(roleId))) return v2Reply(interaction, 'Niveau ou ID de rôle invalide.');
		data.permissionRoles[Number(match[1])] = roleIds;
		saveData(data);
		return v2Reply(interaction, `Rôles de **perm${match[1]}** mis à jour (${roleIds.length} rôle(s)).`);
	}

	if (type === 'commands') {
		const commandName = interaction.fields.getTextInputValue('command').trim().replace(/^\//, '').toLowerCase();
		const match = /^PERM([1-9])$/i.exec(interaction.fields.getTextInputValue('level').trim());
		if (!Object.prototype.hasOwnProperty.call(defaultPermissionLevels, commandName) || !match) return v2Reply(interaction, 'Commande ou niveau invalide.');
		data.permissions[commandName] = Number(match[1]);
		saveData(data);
		return v2Reply(interaction, `/${commandName} nécessite maintenant **perm${match[1]}**.`);
	}

	if (type === 'users') {
		if (interaction.user.id !== process.env.OWNER_ID) return v2Reply(interaction, 'Seul le propriétaire peut gérer les sys.');
		const action = interaction.fields.getTextInputValue('action').trim().toLowerCase();
		const userId = interaction.fields.getTextInputValue('user').trim();
		if (!['ajouter', 'add', 'retirer', 'remove'].includes(action) || !/^\d{17,20}$/.test(userId)) return v2Reply(interaction, 'Action ou ID utilisateur invalide.');
		if (['ajouter', 'add'].includes(action)) {
			if (!data.panelUsers.includes(userId)) data.panelUsers.push(userId);
			saveData(data);
			return v2Reply(interaction, `<@${userId}> peut maintenant utiliser /panel.`);
		}
		data.panelUsers = data.panelUsers.filter((id) => id !== userId);
		saveData(data);
		return v2Reply(interaction, `<@${userId}> n’a plus accès à /panel.`);
	}
}

module.exports = async (interaction) => {
	try {
		if (interaction.isChatInputCommand()) return handleCommand(interaction);
		if (interaction.isButton()) return handleButton(interaction);
		if (interaction.isStringSelectMenu()) return handleSelectMenu(interaction);
		if (interaction.isModalSubmit()) return handleModal(interaction);
	} catch (error) {
		console.error(error);
		const response = { flags: 32768 | 64, components: [v2Container('Une erreur est survenue pendant le traitement.')] };
		if (interaction.replied || interaction.deferred) await interaction.followUp(response);
		else await interaction.reply(response);
	}
};