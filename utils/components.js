const { ContainerBuilder, MessageFlags, TextDisplayBuilder } = require('discord.js');

function v2Container(text, rows = []) {
	const container = new ContainerBuilder().setAccentColor(0x808080).addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
	for (const row of rows) container.addActionRowComponents(row);
	return container;
}

function v2Reply(interaction, text, rows = [], ephemeral = true) {
	return interaction.reply({ flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0), components: [v2Container(text, rows)] });
}

function v2Update(interaction, text, rows = []) {
	return interaction.update({ components: [v2Container(text, rows)] });
}

module.exports = { v2Container, v2Reply, v2Update };