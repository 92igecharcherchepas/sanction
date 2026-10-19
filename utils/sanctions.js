const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

function parseDuration(input) {
	const match = /^([1-9]\d*)\s*(s|m|h|d|w)$/i.exec(input.trim());
	if (!match) return null;
	const seconds = Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[match[2].toLowerCase()]);
	return Number.isSafeInteger(seconds) ? seconds : null;
}

function formatDuration(seconds) {
	const units = [['w', 604800], ['d', 86400], ['h', 3600], ['m', 60], ['s', 1]];
	const unit = units.find(([, value]) => seconds >= value) || units.at(-1);
	return `${Math.floor(seconds / unit[1])}${unit[0]}`;
}

function makeListEmbed(title, sanctions, page) {
	const totalPages = Math.max(1, Math.ceil(sanctions.length / 8));
	const safePage = Math.min(Math.max(page, 0), totalPages - 1);
	const visible = sanctions.slice(safePage * 8, (safePage + 1) * 8);
	const description = visible.length ? visible.map((item) => `**${item.id}** · ${item.type} · <@${item.userId}> · <t:${Math.floor(new Date(item.createdAt).getTime() / 1000)}:R>${item.reason ? `\n> ${item.reason}` : ''}`).join('\n\n') : 'Aucune sanction à afficher.';
	return { embed: new EmbedBuilder().setColor(0xe04f5f).setTitle(title).setDescription(description).setFooter({ text: `Page ${safePage + 1}/${totalPages} · ${sanctions.length} entrée(s)` }), page: safePage, totalPages };
}

function makeListText(title, sanctions, page) {
	const result = makeListEmbed(title, sanctions, page);
	const description = result.embed.data.description || 'Aucune sanction à afficher.';
	return { ...result, text: `# ${title}\n${description}\n\n-# ${result.embed.data.footer?.text || ''}` };
}

function listButtons(prefix, page, totalPages) {
	return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${prefix}:prev:${page}`).setLabel('Précédent').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0), new ButtonBuilder().setCustomId(`${prefix}:next:${page}`).setLabel('Suivant').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1));
}

module.exports = { formatDuration, listButtons, makeListEmbed, makeListText, parseDuration };