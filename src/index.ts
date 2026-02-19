import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import type { ButtonInteraction, ChatInputCommandInteraction, Interaction, ModalSubmitInteraction } from 'discord.js';
import { config } from './config.js';
import { makeCustomId, parseCustomId } from './game/customIds.js';
import { OddsGameManager } from './game/oddsGameManager.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const manager = new OddsGameManager(config.GAME_TIMEOUT_MS, async (game, reason) => {
  const channel = await client.channels.fetch(game.channelId).catch(() => null);
  if (!channel?.isTextBased() || !('send' in channel)) {
    return;
  }

  if (game.challengeMessageId && 'messages' in channel) {
    const challengeMessage = await channel.messages.fetch(game.challengeMessageId).catch(() => null);
    if (challengeMessage) {
      await challengeMessage.delete().catch(() => null);
    }
  }

  const reasonText =
    reason === 'pending'
      ? 'Challenge timed out before it was accepted.'
      : 'Game timed out before both numbers were submitted.';

  await channel.send({
    content: `Odds game cancelled: ${reasonText} (<@${game.challengerId}> vs <@${game.targetId}>)`
  });
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag ?? 'unknown user'}`);
});

client.on('interactionCreate', (interaction: Interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'odds') {
    void handleOddsCommand(interaction);
    return;
  }

  if (interaction.isButton()) {
    void handleOddsButton(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    void handleOddsModalSubmit(interaction);
  }
});

async function handleOddsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.channelId) {
    await interaction.reply({ content: 'This command must be used in a server channel.', ephemeral: true });
    return;
  }

  const challenger = interaction.user;
  const target = interaction.options.getUser('challenge', true);
  const max = interaction.options.getInteger('max', true);
  const prompt = interaction.options.getString('prompt', true).trim();

  if (target.bot) {
    await interaction.reply({ content: 'You cannot challenge a bot.', ephemeral: true });
    return;
  }

  if (target.id === challenger.id) {
    await interaction.reply({ content: 'You cannot challenge yourself.', ephemeral: true });
    return;
  }

  if (max < config.MIN_ODDS_MAX || max > config.MAX_ODDS_MAX) {
    await interaction.reply({
      content: `Max must be between ${config.MIN_ODDS_MAX} and ${config.MAX_ODDS_MAX}.`,
      ephemeral: true
    });
    return;
  }

  const createResult = manager.createGame({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    challengerId: challenger.id,
    targetId: target.id,
    max,
    prompt
  });

  if (!createResult.ok) {
    await interaction.reply({ content: createResult.message, ephemeral: true });
    return;
  }

  const game = createResult.game;

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(makeCustomId('accept', game.id))
      .setLabel('Accept Challenge')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(makeCustomId('decline', game.id))
      .setLabel('Decline')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: `Challenge sent to <@${target.id}>. Waiting for them to accept or decline...`,
    ephemeral: true
  });

  if (!interaction.channel?.isTextBased() || !('send' in interaction.channel)) {
    return;
  }

  const challengeMessage = await interaction.channel.send({
    content:
      `<@${challenger.id}> challenged <@${target.id}> to **What are the odds?**\n` +
      `Prompt: "${prompt}"\n` +
      `Range: 1 to **${max}**\n\n` +
      `Only <@${target.id}> can accept/decline. Timeout: ${Math.floor(config.GAME_TIMEOUT_MS / 1000)}s.`,
    components: [buttons]
  });

  manager.setChallengeMessageId(game.id, challengeMessage.id);
}

async function handleOddsButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) {
    return;
  }

  const game = manager.getGame(parsed.gameId);
  if (!game) {
    await interaction.reply({ content: 'This challenge is no longer active.', ephemeral: true });
    return;
  }

  if (parsed.action === 'accept') {
    const accepted = manager.acceptGame(game.id, interaction.user.id);
    if (!accepted.ok) {
      await interaction.reply({ content: accepted.message, ephemeral: true });
      return;
    }

    const enterButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(makeCustomId('enter', game.id))
        .setLabel('Enter Number')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.update({
      content:
        `<@${game.targetId}> accepted!\n` +
        `Both players must click **Enter Number** and submit a pick from 1 to **${game.max}**.\n` +
        `Players: <@${game.challengerId}> vs <@${game.targetId}>\n` +
        `Prompt: "${game.prompt}"`,
      components: [enterButtonRow]
    });
    return;
  }

  if (parsed.action === 'decline') {
    const declined = manager.declineGame(game.id, interaction.user.id);
    if (!declined.ok) {
      await interaction.reply({ content: declined.message, ephemeral: true });
      return;
    }

    await interaction.update({
      content: `<@${game.targetId}> declined the challenge from <@${game.challengerId}>.`,
      components: []
    });
    return;
  }

  if (parsed.action === 'enter') {
    if (interaction.user.id !== game.challengerId && interaction.user.id !== game.targetId) {
      await interaction.reply({ content: 'Only the two players can enter a number.', ephemeral: true });
      return;
    }

    if (game.status !== 'active') {
      await interaction.reply({ content: 'This game is not active.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(makeCustomId('submit', game.id))
      .setTitle('What are the odds?');

    const numberInput = new TextInputBuilder()
      .setCustomId('pick')
      .setLabel(`Enter a number (1-${game.max})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(String(game.max).length);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(numberInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }
}

async function handleOddsModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (parsed?.action !== 'submit') {
    return;
  }

  const rawPick = interaction.fields.getTextInputValue('pick').trim();
  const pick = Number.parseInt(rawPick, 10);

  if (!Number.isInteger(pick)) {
    await interaction.reply({ content: 'Enter a valid integer.', ephemeral: true });
    return;
  }

  const submitted = manager.submitPick(parsed.gameId, interaction.user.id, pick);
  if (!submitted.ok) {
    await interaction.reply({ content: submitted.message, ephemeral: true });
    return;
  }

  const { game, isComplete, matched } = submitted.result;

  await interaction.reply({ content: `Your pick \`${pick}\` has been submitted.`, ephemeral: true });

  if (!isComplete) {
    return;
  }

  if (!interaction.channel?.isTextBased() || !('send' in interaction.channel)) {
    return;
  }

  const challengerPick = game.challengerPick;
  const targetPick = game.targetPick;
  if (challengerPick === undefined || targetPick === undefined) {
    return;
  }

  const resultLine = matched
    ? `Numbers matched at **${challengerPick}**. <@${game.targetId}> loses and must do: "${game.prompt}"`
    : `No match. <@${game.challengerId}> chose **${challengerPick}**, <@${game.targetId}> chose **${targetPick}**.`;

  await interaction.channel.send({
    content: `Odds result for <@${game.challengerId}> vs <@${game.targetId}>:\n${resultLine}`
  });
}

void client.login(config.DISCORD_TOKEN);
