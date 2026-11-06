import { authenticatedRequest, CHALLENGE_GATE_URL } from './api';
import { reportEvent } from './notifications';

export async function submitVote(challengeId: string, entryId: string, remove = false): Promise<void> {
  await authenticatedRequest('?action=vote', { challengeId, entryId, remove }, CHALLENGE_GATE_URL);
  // Notifica o dono da publicação (agrupado no servidor, no máximo 1 por hora).
  if (!remove) reportEvent({ type: 'vote', challengeId, entryId });
}
