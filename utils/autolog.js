const { ChannelType, MessageFlags } = require('discord.js');
const { v2Container } = require('./components');

const logChannels = ['ban', 'unban', 'tempmute', 'unmute', 'sanctions', 'systeme'];

async function configureAutoLog(guild, data, enabled) {
	if (!enabled) {
		data.autoLog.enabled = false;
		return 'Les logs automatiques sont désactivés. Les salons sont conservés.';
	}
	let category = data.autoLog.categoryId ? guild.channels.cache.get(data.autoLog.categoryId) : null;
	if (!category) {
		category = await guild.channels.create({ name: '📁・sanctions', type: ChannelType.GuildCategory });
		data.autoLog.categoryId = category.id;
	}

	for (const name of logChannels) {
		let channel = data.autoLog.channels[name] ? guild.channels.cache.get(data.autoLog.channels[name]) : null;
		if (!channel) {
			channel = await guild.channels.create({ name: `📁・${name}`, type: ChannelType.GuildText, parent: category.id });
			data.autoLog.channels[name] = channel.id;
		}
	}
	data.autoLog.enabled = true;
	return `Logs activés dans la catégorie ${category}. Salons créés ou réutilisés : ${logChannels.map((name) => `📁・${name}`).join(', ')}.`;
}

async function logAction(interaction, data, channelName, text) {
	if (!data.autoLog?.enabled) return;
	if (data.autoLog.sourceGuildId && interaction.guild.id !== data.autoLog.sourceGuildId) return;
	const channelId = data.autoLog.channels[channelName] || data.autoLog.channels.systeme;
	const logGuild = data.autoLog.targetGuildId ? interaction.client.guilds.cache.get(data.autoLog.targetGuildId) : interaction.guild;
	const channel = channelId && logGuild ? logGuild.channels.cache.get(channelId) : null;
	if (!channel?.isTextBased()) return;
	const sourceGuild = interaction.guild;
	await channel.send({
		flags: MessageFlags.IsComponentsV2,
		components: [v2Container(`# ${channelName}\nServeur source : ${sourceGuild.name} (${sourceGuild.id})\n${text}`)],
	}).catch(() => {});
}

module.exports = { configureAutoLog, logAction };