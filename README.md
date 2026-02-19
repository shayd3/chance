# Chance Bot

A Discord bot built with TypeScript and discord.js for games of chance.

## Game: What are the odds?

`/odds challenge:@user max:number prompt:text`

Flow:
1. Challenger starts a game against a target user.
2. Target user accepts or declines.
3. If accepted, both users submit a secret number from `1..max`.
4. If both numbers match, the target loses and must do the prompt.
5. If they do not match, nothing happens.

Implemented safeguards:
- Timeout cancellation (`GAME_TIMEOUT_MS`, default 120s)
- Target can only be in one challenge per channel at a time
- Only target can accept/decline
- Only the two players can submit numbers

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Fill `.env`:
- `DISCORD_TOKEN`: Bot token
- `DISCORD_CLIENT_ID`: Application client ID
- `DISCORD_GUILD_ID`: Optional; if set, commands register instantly to that guild

4. Register slash commands:

```bash
pnpm register:commands
```

5. Run in development:

```bash
pnpm dev
```

## Scripts

- `pnpm dev` - Run bot with watch mode
- `pnpm build` - Type-check and compile to `dist/`
- `pnpm start` - Run compiled bot
- `pnpm register:commands` - Register slash commands
- `pnpm test` - Run unit tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm lint` - Run ESLint
