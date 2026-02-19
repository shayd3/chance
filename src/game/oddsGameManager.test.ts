import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OddsGameManager, type OddsGame } from './oddsGameManager.js';

function createInput(overrides?: Partial<{
  guildId: string;
  channelId: string;
  challengerId: string;
  targetId: string;
  max: number;
  prompt: string;
}>): {
  guildId: string;
  channelId: string;
  challengerId: string;
  targetId: string;
  max: number;
  prompt: string;
} {
  return {
    guildId: 'guild-1',
    channelId: 'channel-1',
    challengerId: 'challenger-1',
    targetId: 'target-1',
    max: 10,
    prompt: 'do a thing',
    ...overrides
  };
}

describe('OddsGameManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a game and blocks concurrent challenge for same target in same channel', () => {
    const manager = new OddsGameManager(120_000, async () => {});
    const first = manager.createGame(createInput());
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = manager.createGame(createInput());
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.message).toContain('already has an active odds challenge');
    }
  });

  it('allows only target to accept and flips game to active', () => {
    const manager = new OddsGameManager(120_000, async () => {});
    const created = manager.createGame(createInput());
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const wrongUser = manager.acceptGame(created.game.id, 'someone-else');
    expect(wrongUser.ok).toBe(false);

    const accepted = manager.acceptGame(created.game.id, created.game.targetId);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) {
      return;
    }
    expect(accepted.game.status).toBe('active');
  });

  it('handles matching and non-matching picks and closes game on completion', () => {
    const manager = new OddsGameManager(120_000, async () => {});
    const created = manager.createGame(createInput());
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const accepted = manager.acceptGame(created.game.id, created.game.targetId);
    expect(accepted.ok).toBe(true);

    const firstPick = manager.submitPick(created.game.id, created.game.challengerId, 4);
    expect(firstPick.ok).toBe(true);
    if (firstPick.ok) {
      expect(firstPick.result.isComplete).toBe(false);
      expect(firstPick.result.matched).toBe(false);
    }

    const secondPick = manager.submitPick(created.game.id, created.game.targetId, 4);
    expect(secondPick.ok).toBe(true);
    if (secondPick.ok) {
      expect(secondPick.result.isComplete).toBe(true);
      expect(secondPick.result.matched).toBe(true);
    }

    expect(manager.getGame(created.game.id)).toBeUndefined();
  });

  it('rejects out-of-range picks and duplicate submissions', () => {
    const manager = new OddsGameManager(120_000, async () => {});
    const created = manager.createGame(createInput({ max: 5 }));
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    manager.acceptGame(created.game.id, created.game.targetId);

    const outOfRange = manager.submitPick(created.game.id, created.game.challengerId, 8);
    expect(outOfRange.ok).toBe(false);

    const valid = manager.submitPick(created.game.id, created.game.challengerId, 2);
    expect(valid.ok).toBe(true);

    const duplicate = manager.submitPick(created.game.id, created.game.challengerId, 3);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.message).toContain('already submitted');
    }
  });

  it('releases target lock when challenge is declined', () => {
    const manager = new OddsGameManager(120_000, async () => {});
    const first = manager.createGame(createInput());
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const declined = manager.declineGame(first.game.id, first.game.targetId);
    expect(declined.ok).toBe(true);

    const second = manager.createGame(createInput());
    expect(second.ok).toBe(true);
  });

  it('expires pending games and invokes timeout callback', async () => {
    const expired: Array<{ game: OddsGame; reason: 'pending' | 'active' }> = [];
    const manager = new OddsGameManager(1000, async (game, reason) => {
      expired.push({ game, reason });
    });

    const created = manager.createGame(createInput());
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    expect(expired).toHaveLength(1);
    expect(expired[0]?.reason).toBe('pending');
    expect(expired[0]?.game.id).toBe(created.game.id);
    expect(manager.getGame(created.game.id)).toBeUndefined();
  });

  it('expires active games and reports active reason', async () => {
    const expired: Array<{ game: OddsGame; reason: 'pending' | 'active' }> = [];
    const manager = new OddsGameManager(1000, async (game, reason) => {
      expired.push({ game, reason });
    });

    const created = manager.createGame(createInput());
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    manager.acceptGame(created.game.id, created.game.targetId);
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    expect(expired).toHaveLength(1);
    expect(expired[0]?.reason).toBe('active');
  });
});
