import { SlashCommandBuilder, type RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';

export const oddsCommand = new SlashCommandBuilder()
  .setName('odds')
  .setDescription('Challenge someone to "What are the odds?"')
  .addUserOption((option) =>
    option
      .setName('challenge')
      .setDescription('The user you want to challenge')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('max')
      .setDescription('The upper bound for picks (1..max)')
      .setRequired(true)
      .setMinValue(2)
  )
  .addStringOption((option) =>
    option
      .setName('prompt')
      .setDescription('What they must do if odds match')
      .setRequired(true)
      .setMaxLength(200)
  );

export const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [oddsCommand.toJSON()];
