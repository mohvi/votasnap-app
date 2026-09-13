import { authenticatedRequest } from './api';

export async function submitVote(challengeId: string, entryId: string, remove = false): Promise<void> {
  await authenticatedRequest('/api/challenges/vote', { challengeId, entryId, remove });
}
