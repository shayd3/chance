import { REST, Routes } from 'discord.js';
import { commands } from '../commands.js';
import { config } from '../config.js';

async function main(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  if (config.DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log(`Registered ${commands.length} guild command(s) to ${config.DISCORD_GUILD_ID}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands });
  console.log(`Registered ${commands.length} global command(s).`);
}

void main();
