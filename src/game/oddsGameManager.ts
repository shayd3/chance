import { randomUUID } from 'node:crypto';

export interface OddsGame {
  id: string;
  guildId: string;
  channelId: string;
  challengerId: string;
  targetId: string;
  max: number;
  prompt: string;
  status: 'pending' | 'active';
  challengerPick?: number;
  targetPick?: number;
  createdAtMs: number;
  expiresAtMs: number;
  timeoutHandle: NodeJS.Timeout;
}

interface CreateGameInput {
  guildId: string;
  channelId: string;
  challengerId: string;
  targetId: string;
  max: number;
  prompt: string;
}

interface SubmitPickResult {
  game: OddsGame;
  isComplete: boolean;
  matched: boolean;
}

type ExpireReason = 'pending' | 'active';
type ExpireCallback = (game: OddsGame, reason: ExpireReason) => Promise<void>;

export class OddsGameManager {
  private readonly gamesById = new Map<string, OddsGame>();
  private readonly targetLocks = new Map<string, string>();

  constructor(
    private readonly timeoutMs: number,
    private readonly onExpire: ExpireCallback
  ) {}

  createGame(input: CreateGameInput): { ok: true; game: OddsGame } | { ok: false; message: string } {
    const lockKey = this.getTargetLockKey(input.guildId, input.channelId, input.targetId);
    if (this.targetLocks.has(lockKey)) {
      return {
        ok: false,
        message: 'That user already has an active odds challenge in this channel.'
      };
    }

    const createdAtMs = Date.now();
    const gameId = randomUUID();
    const game: OddsGame = {
      id: gameId,
      guildId: input.guildId,
      channelId: input.channelId,
      challengerId: input.challengerId,
      targetId: input.targetId,
      max: input.max,
      prompt: input.prompt,
      status: 'pending',
      createdAtMs,
      expiresAtMs: createdAtMs + this.timeoutMs,
      timeoutHandle: setTimeout(() => {
        void this.expireGame(gameId);
      }, this.timeoutMs)
    };

    this.gamesById.set(gameId, game);
    this.targetLocks.set(lockKey, gameId);

    return { ok: true, game };
  }

  getGame(gameId: string): OddsGame | undefined {
    return this.gamesById.get(gameId);
  }

  acceptGame(gameId: string, userId: string): { ok: true; game: OddsGame } | { ok: false; message: string } {
    const game = this.gamesById.get(gameId);
    if (!game) {
      return { ok: false, message: 'This challenge no longer exists.' };
    }
    if (game.status !== 'pending') {
      return { ok: false, message: 'This challenge is no longer awaiting acceptance.' };
    }
    if (game.targetId !== userId) {
      return { ok: false, message: 'Only the challenged user can accept this game.' };
    }

    game.status = 'active';
    return { ok: true, game };
  }

  declineGame(gameId: string, userId: string): { ok: true; game: OddsGame } | { ok: false; message: string } {
    const game = this.gamesById.get(gameId);
    if (!game) {
      return { ok: false, message: 'This challenge no longer exists.' };
    }
    if (game.targetId !== userId) {
      return { ok: false, message: 'Only the challenged user can decline this game.' };
    }

    this.removeGame(gameId);
    return { ok: true, game };
  }

  submitPick(gameId: string, userId: string, pick: number): { ok: true; result: SubmitPickResult } | { ok: false; message: string } {
    const game = this.gamesById.get(gameId);
    if (!game) {
      return { ok: false, message: 'This challenge no longer exists.' };
    }
    if (game.status !== 'active') {
      return { ok: false, message: 'This challenge has not started yet.' };
    }
    if (pick < 1 || pick > game.max) {
      return { ok: false, message: `Your pick must be between 1 and ${game.max}.` };
    }

    if (userId === game.challengerId) {
      if (game.challengerPick !== undefined) {
        return { ok: false, message: 'You already submitted your number.' };
      }
      game.challengerPick = pick;
    } else if (userId === game.targetId) {
      if (game.targetPick !== undefined) {
        return { ok: false, message: 'You already submitted your number.' };
      }
      game.targetPick = pick;
    } else {
      return { ok: false, message: 'Only the two players can submit numbers.' };
    }

    const isComplete = game.challengerPick !== undefined && game.targetPick !== undefined;
    const matched = isComplete && game.challengerPick === game.targetPick;

    if (isComplete) {
      this.removeGame(game.id);
    }

    return {
      ok: true,
      result: {
        game,
        isComplete,
        matched
      }
    };
  }

  private async expireGame(gameId: string): Promise<void> {
    const game = this.gamesById.get(gameId);
    if (!game) {
      return;
    }

    const reason: ExpireReason = game.status;
    this.removeGame(gameId);
    await this.onExpire(game, reason);
  }

  private removeGame(gameId: string): void {
    const game = this.gamesById.get(gameId);
    if (!game) {
      return;
    }

    clearTimeout(game.timeoutHandle);
    const lockKey = this.getTargetLockKey(game.guildId, game.channelId, game.targetId);

    this.gamesById.delete(gameId);
    this.targetLocks.delete(lockKey);
  }

  private getTargetLockKey(guildId: string, channelId: string, targetId: string): string {
    return `${guildId}:${channelId}:${targetId}`;
  }
}
