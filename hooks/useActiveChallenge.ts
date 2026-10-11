import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { Challenge, isChallengeOpen, useNow } from './useChallenges';

export function useActiveChallenge() {
  const [candidates, setCandidates] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const challengesRef = query(
      ref(db, 'challenges'),
      orderByChild('status'),
      equalTo('active')
    );

    const unsub = onValue(challengesRef, snapshot => {
      const data = snapshot.val() || {};
      const list: Challenge[] = Object.entries(data).map(([id, value]) => ({ ...(value as Challenge), id }));
      // Se houver mais de um por engano, escolhe o mais recente
      list.sort((a, b) => b.createdAt - a.createdAt);
      setCandidates(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const now = useNow(candidates.map(c => c.endsAt));
  const challenge = candidates.find(c => isChallengeOpen(c, now)) ?? null;

  return { challenge, loading };
}
