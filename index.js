require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const commands = require('./commands');
const interactionCreate = require('./events/interactionCreate');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
	const rest = new REST({ version: '10' }).setToken(token);
	const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
	await rest.put(route, { body: commands });
	console.log(`Connecté en tant que ${client.user.tag}. ${commands.length} commandes déployées.`);
});

client.on('interactionCreate', interactionCreate);

if (!token || !clientId) {
	console.error('DISCORD_TOKEN et CLIENT_ID sont obligatoires dans le fichier .env');
	process.exitCode = 1;
} else {
	client.login(token);
}
