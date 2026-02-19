const PREFIX = 'odds';

type Action = 'accept' | 'decline' | 'enter' | 'submit';

export function makeCustomId(action: Action, gameId: string): string {
  return `${PREFIX}:${action}:${gameId}`;
}

export function parseCustomId(customId: string): { action: Action; gameId: string } | null {
  const [prefix, actionRaw, gameId] = customId.split(':');
  if (prefix !== PREFIX || !actionRaw || !gameId) {
    return null;
  }

  if (actionRaw !== 'accept' && actionRaw !== 'decline' && actionRaw !== 'enter' && actionRaw !== 'submit') {
    return null;
  }

  return { action: actionRaw, gameId };
}
