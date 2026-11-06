import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../services/firebase';
import { useBlockedUsers } from './BlockedUsersProvider';
import { challengeDeadlines, isChallengeOpen, useNow } from './useChallenges';
import { useDemographics } from './DemographicsProvider';
import { canAccessChallenge, challengeMinAge } from '../services/demographics';
import { useChallengesScope, useEntriesFor, useMyVotes, useProfiles } from './useScopedData';

export interface FeedEntry {
  id: string;
  challengeId: string;
  challengeTitle: string;
  challengePrize: string;
  challengePrizeType: string;
  challengeMinAge?: number;
  challengeAlcohol?: boolean;
  userId: string;
  userName: string;
  userAvatar: string | null;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption: string;
  votes: number;
  createdAt: number;
  isWinner?: boolean; 
}

export function useFeedEntries() {
  const { blocked } = useBlockedUsers();
  const [freshEntries, setFreshEntries] = useState<FeedEntry[]>([]);
  const [allEntries, setAllEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Só desafios activos, as suas publicações e o voto do próprio utilizador.
  const { challenges: activeChallenges, loaded: challengesLoaded } = useChallengesScope('active');
  // Desafios com idade mínima só para quem a declarou (nem se descarregam as publicações).
  const { age } = useDemographics();
  const challenges = useMemo(
    () => Object.fromEntries(Object.entries<any>(activeChallenges).filter(([, c]) => canAccessChallenge(c, age))),
    [activeChallenges, age],
  );
  const challengeIds = useMemo(() => Object.keys(challenges), [challenges]);
  const { entries: entriesByChallenge, loaded: entriesLoaded } = useEntriesFor(challengeIds);
  const { votes: userVotes, loaded: votesLoaded } = useMyVotes(challengeIds);
  const authorIds = useMemo(
    () => Object.values<any>(entriesByChallenge).flatMap(list => Object.values<any>(list || {}).map(e => e?.userId).filter(Boolean)),
    [entriesByChallenge],
  );
  const users = useProfiles(authorIds);
  const now = useNow(Object.values<any>(challenges).flatMap(challengeDeadlines));

  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffledOnceRef = useRef(false);
  const orderRef = useRef<{ all: string[]; fresh: string[] }>({ all: [], fresh: [] });

  // --- Recalcular fresh/all sempre que algum dos nós muda ---

  useEffect(() => {
    if (!challengesLoaded || !entriesLoaded || !votesLoaded) {
      return;
    }

    const currentUid = auth.currentUser?.uid;
    const fresh: FeedEntry[] = [];
    const all: FeedEntry[] = [];

    for (const [challengeId, challenge] of Object.entries<any>(challenges)) {
      if (!isChallengeOpen(challenge, now)) continue;

      const alreadyVoted = !!userVotes[challengeId];
      const entries = entriesByChallenge?.[challengeId];
      if (!entries) continue;

      for (const [entryId, entry] of Object.entries<any>(entries)) {
        if (!entry?.mediaUrl) continue;

        const userData = users[entry.userId] || {};
        const userName = userData?.username || userData?.name || 'Utilizador';
        const userAvatar = userData?.avatar || null;

        const feedEntry: FeedEntry = {
          id: entryId,
          challengeId,
          challengeTitle: challenge.title ?? '',
          challengePrize: challenge.prize ?? '',
          challengePrizeType: challenge.prizeType ?? '',
          challengeMinAge: challengeMinAge(challenge),
          challengeAlcohol: !!challenge.alcohol,
          userId: entry.userId,
          userName,
          userAvatar,
          mediaUrl: entry.mediaUrl,
          mediaType: entry.mediaType || 'photo',
          caption: entry.caption ?? '',
          votes: entry.votes || 0,
          createdAt: entry.createdAt || Date.now(),
        };

        all.push(feedEntry);

        if (entry.userId !== currentUid && !alreadyVoted) {
          fresh.push(feedEntry);
        }
      }
    }

    const sortedAll = all.sort((a, b) => b.createdAt - a.createdAt);
    const sortedFresh = fresh.sort((a, b) => b.createdAt - a.createdAt);

    if (!shuffledOnceRef.current) {
      // Primeira carga: embaralha e fixa a ordem
      const shuffledAll = shuffle(sortedAll);
      const shuffledFresh = shuffle(sortedFresh);
      orderRef.current = {
        all: shuffledAll.map(e => e.id),
        fresh: shuffledFresh.map(e => e.id),
      };
      setAllEntries(shuffledAll);
      setFreshEntries(shuffledFresh);
      shuffledOnceRef.current = true;
    } else {
      // Atualizações seguintes: mantém a ordem fixada, só atualiza os dados dos cards
      // (ex: contagem de votos) e adiciona novas entradas no fim da lista.
      const reorder = (ids: string[], pool: FeedEntry[]) => {
        const poolMap = new Map(pool.map(e => [e.id, e]));
        const ordered: FeedEntry[] = [];
        const seen = new Set<string>();

        for (const id of ids) {
          const e = poolMap.get(id);
          if (e) {
            ordered.push(e);
            seen.add(id);
          }
        }
        for (const e of pool) {
          if (!seen.has(e.id)) ordered.push(e);
        }
        return ordered;
      };

      const reorderedAll = reorder(orderRef.current.all, sortedAll);
      const reorderedFresh = reorder(orderRef.current.fresh, sortedFresh);

      orderRef.current = {
        all: reorderedAll.map(e => e.id),
        fresh: reorderedFresh.map(e => e.id),
      };

      setAllEntries(reorderedAll);
      setFreshEntries(reorderedFresh);
    }

    setLoading(false);
    setRefreshing(false);
  }, [challenges, users, entriesByChallenge, userVotes, challengesLoaded, entriesLoaded, votesLoaded, now]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  return { freshEntries: freshEntries.filter(e => !blocked.includes(e.userId)),
    allEntries: allEntries.filter(e => !blocked.includes(e.userId)), loading, refreshing, refresh, userVotes };
}
