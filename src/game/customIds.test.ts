import { describe, expect, it } from 'vitest';
import { makeCustomId, parseCustomId } from './customIds.js';

describe('customIds', () => {
  it('round-trips valid custom IDs', () => {
    const id = makeCustomId('accept', 'game-123');
    expect(id).toBe('odds:accept:game-123');
    expect(parseCustomId(id)).toEqual({ action: 'accept', gameId: 'game-123' });
  });

  it('rejects malformed IDs', () => {
    expect(parseCustomId('')).toBeNull();
    expect(parseCustomId('odds:bad:123')).toBeNull();
    expect(parseCustomId('other:accept:123')).toBeNull();
    expect(parseCustomId('odds:accept')).toBeNull();
  });
});
