import { onValue, ref } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../services/firebase';
import { FeedEntry } from './useFeedEntries';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function useExploreEntries() {
  const [allEntries, setAllEntries] = useState<FeedEntry[]>([]); // "Geral" — todos, embaralhados
  const [winnerEntries, setWinnerEntries] = useState<FeedEntry[]>([]); // "Vencedores" — 1 por desafio terminado
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});

  const [challenges, setChallenges] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<Record<string, any>>({});
  const [entriesByChallenge, setEntriesByChallenge] = useState<Record<string, any>>({});
  const [votesByChallenge, setVotesByChallenge] = useState<Record<string, any>>({});

  const [challengesLoaded, setChallengesLoaded] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [votesLoaded, setVotesLoaded] = useState(false);

  const shuffledOnceRef = useRef(false);
  const orderRef = useRef<string[]>([]);

  // --- Listeners em tempo real (mesmo padrão do useFeedEntries) ---

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'challenges'),
      snap => { setChallenges(snap.exists() ? snap.val() : {}); setChallengesLoaded(true); },
      () => setChallengesLoaded(true)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'users'),
      snap => { setUsers(snap.exists() ? snap.val() : {}); setUsersLoaded(true); },
      () => setUsersLoaded(true)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'entries'),
      snap => { setEntriesByChallenge(snap.exists() ? snap.val() : {}); setEntriesLoaded(true); },
      () => setEntriesLoaded(true)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'votes'),
      snap => { setVotesByChallenge(snap.exists() ? snap.val() : {}); setVotesLoaded(true); },
      () => setVotesLoaded(true)
    );
    return () => unsub();
  }, []);

  // --- Voto do utilizador por desafio (para toggle de like dentro do viewer) ---

  useEffect(() => {
    if (!votesLoaded) return;
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) { setUserVotes({}); return; }
    const votes: Record<string, string> = {};
    for (const [challengeId, challengeVotes] of Object.entries<any>(votesByChallenge)) {
      const myVote = challengeVotes?.[currentUid];
      if (myVote?.entryId) votes[challengeId] = myVote.entryId;
    }
    setUserVotes(votes);
  }, [votesByChallenge, votesLoaded]);

  // --- Recalcular allEntries / winnerEntries ---

  useEffect(() => {
    if (!challengesLoaded || !usersLoaded || !entriesLoaded || !votesLoaded) return;

    const all: FeedEntry[] = [];
    const winners: FeedEntry[] = [];

    for (const [challengeId, challenge] of Object.entries<any>(challenges)) {
      const entries = entriesByChallenge?.[challengeId];
      if (!entries) continue;

      // Desafio "terminado" = qualquer status diferente de "active"
      // (segue o mesmo critério binário já usado no useFeedEntries)
      const isFinished = challenge?.status !== 'active';
      let topEntry: FeedEntry | null = null;

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

        if (isFinished && (!topEntry || feedEntry.votes > topEntry.votes)) {
          topEntry = feedEntry;
        }
      }

      if (topEntry) {
        winners.push({ ...topEntry, isWinner: true });
      }
    }

    const sortedWinners = winners.sort((a, b) => b.votes - a.votes);

    if (!shuffledOnceRef.current) {
      const shuffledAll = shuffle(all);
      orderRef.current = shuffledAll.map(e => e.id);
      setAllEntries(shuffledAll);
      shuffledOnceRef.current = true;
    } else {
      // mantém a ordem fixada, só atualiza os dados (ex: contagem de votos)
      const poolMap = new Map(all.map(e => [e.id, e]));
      const ordered: FeedEntry[] = [];
      const seen = new Set<string>();
      for (const id of orderRef.current) {
        const e = poolMap.get(id);
        if (e) { ordered.push(e); seen.add(id); }
      }
      for (const e of all) {
        if (!seen.has(e.id)) ordered.push(e);
      }
      orderRef.current = ordered.map(e => e.id);
      setAllEntries(ordered);
    }

    setWinnerEntries(sortedWinners);
    setLoading(false);
  }, [challenges, users, entriesByChallenge, votesByChallenge, challengesLoaded, usersLoaded, entriesLoaded, votesLoaded]);

  return { allEntries, winnerEntries, loading, userVotes };
}