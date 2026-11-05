import { authenticatedRequest } from './api';
import { reportEvent } from './notifications';

export async function submitVote(challengeId: string, entryId: string, remove = false): Promise<void> {
  await authenticatedRequest('/api/challenges/vote', { challengeId, entryId, remove });
  // Notifica o dono da publicação (agrupado no servidor, no máximo 1 por hora).
  if (!remove) reportEvent({ type: 'vote', challengeId, entryId });
}
