import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { Challenge } from './useChallenges';

export function useActiveChallenge() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const challengesRef = query(
      ref(db, 'challenges'),
      orderByChild('status'),
      equalTo('active')
    );

    const unsub = onValue(challengesRef, snapshot => {
      if (!snapshot.exists()) {
        setChallenge(null);
        setLoading(false);
        return;
      }
      const data = snapshot.val();
      const list: Challenge[] = Object.entries(data).map(([id, value]) => ({ ...(value as Challenge), id }));
      // Se houver mais de um por engano, escolhe o mais recente
      list.sort((a, b) => b.createdAt - a.createdAt);
      setChallenge(list[0] || null);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { challenge, loading };
}
