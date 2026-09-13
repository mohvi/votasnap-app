import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { auth } from '../services/firebase';
import { submitVote } from '../services/voting';
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
      await submitVote(entry.challengeId, entry.id, isUnvoting);
    } catch (e) {
      console.error('Erro ao votar:', e);
      Alert.alert('Erro', 'Não foi possível registar o teu voto. Tenta novamente.');
    } finally {
      setVotingId(null);
    }
  }, [uid, isLoggedIn, userVotes, votingId, onRequireAuth]);

  return { votingId, handleLike };
}