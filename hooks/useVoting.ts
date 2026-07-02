import { get, ref, remove, runTransaction, set } from 'firebase/database';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { auth, db } from '../services/firebase';
import { notifyVoteReceived } from '../services/notifications';
import { FeedEntry } from './useFeedEntries';

interface UseVotingParams {
  userVotes: Record<string, string>; // challengeId -> entryId
  isLoggedIn: boolean;
  onRequireAuth: () => void;
}

export function useVoting({ userVotes, isLoggedIn, onRequireAuth }: UseVotingParams) {
  const [votingId, setVotingId] = useState<string | null>(null);
  const uid = auth.currentUser?.uid;

  const handleLike = useCallback(async (entry: FeedEntry) => {
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }
    if (!uid) return;
    if (entry.userId === uid) return; // não podes votar em ti mesmo
    if (votingId) return; // evita cliques em sequência rápida

    const votedEntryIdForChallenge = userVotes[entry.challengeId];
    const isUnvoting = votedEntryIdForChallenge === entry.id;

    // já votaste noutra participação deste MESMO desafio
    if (!isUnvoting && votedEntryIdForChallenge) {
      Alert.alert(
        'Já votaste neste desafio',
        'Só podes votar numa participação por desafio. Remove o teu voto atual (❤️) se quiseres votar noutra.'
      );
      return;
    }

    setVotingId(entry.id);

    try {
      const votesCountRef = ref(db, `entries/${entry.challengeId}/${entry.id}/votes`);
      const totalVotesRef = ref(db, `challenges/${entry.challengeId}/totalVotes`);

      if (isUnvoting) {
        await remove(ref(db, `votes/${entry.challengeId}/${uid}`));
        await runTransaction(votesCountRef, current => Math.max((current || 0) - 1, 0));
        await runTransaction(totalVotesRef, current => Math.max((current || 0) - 1, 0));
      } else {
        await set(ref(db, `votes/${entry.challengeId}/${uid}`), {
          entryId: entry.id,
          votedAt: Date.now(),
        });
        await runTransaction(votesCountRef, current => (current || 0) + 1);
        await runTransaction(totalVotesRef, current => (current || 0) + 1);

        const voterSnap = await get(ref(db, `users/${uid}`));
        const voterName = voterSnap.val()?.name || 'Alguém';
        const challengeSnap = await get(ref(db, `challenges/${entry.challengeId}`));
        const challengeTitle = challengeSnap.val()?.title || 'um desafio';

        await notifyVoteReceived({
          entryOwnerId: entry.userId,
          voterName,
          challengeTitle,
          challengeId: entry.challengeId,
          entryId: entry.id,
        });
      }
    } catch (e) {
      console.error('Erro ao votar:', e);
      Alert.alert('Erro', 'Não foi possível registar o teu voto. Tenta novamente.');
    } finally {
      setVotingId(null);
    }
  }, [uid, isLoggedIn, userVotes, votingId, onRequireAuth]);

  return { votingId, handleLike };
}