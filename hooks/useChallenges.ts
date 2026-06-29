import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { db } from '../services/firebase';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'free' | 'paid' | 'sponsored';
  prize: string;
  prizeType: 'physical' | 'cash' | 'badge';
  sponsor: string;
  coverImage: string;
  createdBy: string;
  createdAt: number;
  endsAt: number;
  status: 'active' | 'ended' | 'cancelled';
  totalVotes: number;
  totalParticipants: number;
}

export function useChallenges(filter: 'all' | 'active' = 'active') {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const challengesRef = filter === 'active'
      ? query(ref(db, 'challenges'), orderByChild('status'), equalTo('active'))
      : ref(db, 'challenges');

    const unsub = onValue(
      challengesRef,
      snapshot => {
        if (!snapshot.exists()) {
          setChallenges([]);
          setLoading(false);
          return;
        }
        const data = snapshot.val();
        const list: Challenge[] = Object.values(data);
        // ordena por mais recentes primeiro
        list.sort((a, b) => b.createdAt - a.createdAt);
        setChallenges(list);
        setLoading(false);
      },
      err => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [filter]);

  return { challenges, loading, error };
}