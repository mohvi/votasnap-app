import { useEffect, useMemo, useRef, useState } from 'react';
import { FeedEntry } from './useFeedEntries';
import { useBlockedUsers } from './BlockedUsersProvider';
import { useChallengesScope, useEntriesFor, useMyVotes, useProfiles } from './useScopedData';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function useExploreEntries() {
  const { blocked } = useBlockedUsers();
  const [allEntries, setAllEntries] = useState<FeedEntry[]>([]); // "Geral" — todos, embaralhados
  const [winnerEntries, setWinnerEntries] = useState<FeedEntry[]>([]); // "Vencedores" — 1 por desafio terminado
  const [loading, setLoading] = useState(true);

  // Os últimos 30 desafios (activos e terminados) chegam para "Geral" e
  // "Vencedores"; desafios antigos deixam de ser descarregados a cada abertura.
  const { challenges, loaded: challengesLoaded } = useChallengesScope('recent', 30);
  const challengeIds = useMemo(() => Object.keys(challenges), [challenges]);
  const { entries: entriesByChallenge, loaded: entriesLoaded } = useEntriesFor(challengeIds);
  const { votes: userVotes, loaded: votesLoaded } = useMyVotes(challengeIds);
  const authorIds = useMemo(
    () => Object.values<any>(entriesByChallenge).flatMap(list => Object.values<any>(list || {}).map(e => e?.userId).filter(Boolean)),
    [entriesByChallenge],
  );
  const users = useProfiles(authorIds);

  const shuffledOnceRef = useRef(false);
  const orderRef = useRef<string[]>([]);

  // --- Recalcular allEntries / winnerEntries ---

  useEffect(() => {
    if (!challengesLoaded || !entriesLoaded || !votesLoaded) return;

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
  }, [challenges, users, entriesByChallenge, challengesLoaded, entriesLoaded, votesLoaded]);

  return { allEntries: allEntries.filter(e => !blocked.includes(e.userId)),
    winnerEntries: winnerEntries.filter(e => !blocked.includes(e.userId)), loading, userVotes };
}
