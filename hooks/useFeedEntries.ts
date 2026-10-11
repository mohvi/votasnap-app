import { onValue, ref } from 'firebase/database';
import { useCallback, useEffect, useRef, useState } from 'react';
import { auth, db } from '../services/firebase';
import { useBlockedUsers } from './BlockedUsersProvider';
import { isChallengeOpen, useNow } from './useChallenges';

export interface FeedEntry {
  id: string;
  challengeId: string;
  challengeTitle: string;
  challengePrize: string;
  challengePrizeType: string;
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

  // Snapshots brutos vindos do Firebase, mantidos em estado próprio
  const [challenges, setChallenges] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<Record<string, any>>({});
  const [entriesByChallenge, setEntriesByChallenge] = useState<Record<string, any>>({});
  const [votesByChallenge, setVotesByChallenge] = useState<Record<string, any>>({});

  const [challengesLoaded, setChallengesLoaded] = useState(false);
  const now = useNow(Object.values<any>(challenges).map(c => c?.endsAt));
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [votesLoaded, setVotesLoaded] = useState(false);

  // Mapa: challengeId -> entryId em que o utilizador atual votou (fonte única de verdade)
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});

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

  // --- Listeners em tempo real ---

  useEffect(() => {
    const challengesRef = ref(db, 'challenges');
    const unsubscribe = onValue(
      challengesRef,
      snap => {
        setChallenges(snap.exists() ? snap.val() : {});
        setChallengesLoaded(true);
      },
      error => {
        console.error('Erro ao escutar challenges:', error);
        setChallengesLoaded(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const usersRef = ref(db, 'publicProfiles');
    const unsubscribe = onValue(
      usersRef,
      snap => {
        setUsers(snap.exists() ? snap.val() : {});
        setUsersLoaded(true);
      },
      error => {
        console.error('Erro ao escutar users:', error);
        setUsersLoaded(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Nó "entries" inteiro — é aqui que os votos mudam, por isso precisa de ser tempo real
  useEffect(() => {
    const entriesRef = ref(db, 'entries');
    const unsubscribe = onValue(
      entriesRef,
      snap => {
        setEntriesByChallenge(snap.exists() ? snap.val() : {});
        setEntriesLoaded(true);
      },
      error => {
        console.error('Erro ao escutar entries:', error);
        setEntriesLoaded(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Nó "votes" inteiro — usado para saber em que o utilizador atual já votou,
  // e também para bloquear votos duplicados no mesmo desafio
  useEffect(() => {
    const votesRef = ref(db, 'votes');
    const unsubscribe = onValue(
      votesRef,
      snap => {
        setVotesByChallenge(snap.exists() ? snap.val() : {});
        setVotesLoaded(true);
      },
      error => {
        console.error('Erro ao escutar votes:', error);
        setVotesLoaded(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // --- Recalcular userVotes sempre que o nó votes muda ---

  useEffect(() => {
    if (!votesLoaded) return;
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      setUserVotes({});
      return;
    }
    const votes: Record<string, string> = {};
    for (const [challengeId, challengeVotes] of Object.entries<any>(votesByChallenge)) {
      const myVote = challengeVotes?.[currentUid];
      if (myVote?.entryId) {
        votes[challengeId] = myVote.entryId;
      }
    }
    setUserVotes(votes);
  }, [votesByChallenge, votesLoaded]);

  // --- Recalcular fresh/all sempre que algum dos nós muda ---

  useEffect(() => {
    if (!challengesLoaded || !usersLoaded || !entriesLoaded || !votesLoaded) {
      return;
    }

    const currentUid = auth.currentUser?.uid;
    const fresh: FeedEntry[] = [];
    const all: FeedEntry[] = [];

    for (const [challengeId, challenge] of Object.entries<any>(challenges)) {
      if (!isChallengeOpen(challenge, now)) continue;

      const alreadyVoted = !!(currentUid && votesByChallenge?.[challengeId]?.[currentUid]);
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
  }, [challenges, users, entriesByChallenge, votesByChallenge, challengesLoaded, usersLoaded, entriesLoaded, votesLoaded, now]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  return { freshEntries: freshEntries.filter(e => !blocked.includes(e.userId)),
    allEntries: allEntries.filter(e => !blocked.includes(e.userId)), loading, refreshing, refresh, userVotes };
}
