import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  GAME_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  MIN_ODDS_MAX: z.coerce.number().int().min(2).default(2),
  MAX_ODDS_MAX: z.coerce.number().int().min(2).default(10_000)
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
