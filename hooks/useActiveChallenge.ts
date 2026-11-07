import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { isChallengeListed } from '../services/demographics';
import { db } from '../services/firebase';
import { useDemographics } from './DemographicsProvider';
import { Challenge, challengeDeadlines, isChallengeOpen, useNow } from './useChallenges';

// O desafio em destaque: o mais recente que está aberto e a que a pessoa
// tem acesso (desafios 18+ não aparecem a menores nem a visitantes).
export function useActiveChallenge() {
  const [candidates, setCandidates] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const { age, province } = useDemographics();

  useEffect(() => {
    const challengesRef = query(
      ref(db, 'challenges'),
      orderByChild('status'),
      equalTo('active')
    );

    const unsub = onValue(challengesRef, snapshot => {
      const data = snapshot.val() || {};
      const list: Challenge[] = Object.entries(data).map(([id, value]) => ({ ...(value as Challenge), id }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setCandidates(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const now = useNow(candidates.flatMap(challengeDeadlines));
  const challenge = candidates.find(c => isChallengeOpen(c, now) && isChallengeListed(c, age, province)) ?? null;

  return { challenge, loading };
}
