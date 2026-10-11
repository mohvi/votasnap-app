import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { db } from '../services/firebase';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'free' | 'paid' | 'sponsored';
  entryFee?: number;
  prize: string;
  prizeType: 'physical' | 'cash' | 'badge';
  sponsor: string;
  coverImage: string;
  createdBy: string;
  createdAt: number;
  endsAt: number;
  status: 'active' | 'ended' | 'cancelled' | 'pending_confirmation' | 'completed';
  totalVotes: number;
  totalParticipants: number;
}

// Um desafio só é visível enquanto está activo E dentro do prazo. O encerramento
// no servidor é manual, por isso `status` pode continuar 'active' depois de `endsAt`.
export function isChallengeOpen(
  challenge: { status?: string; endsAt?: number } | null | undefined,
  now = Date.now(),
): boolean {
  return !!challenge && challenge.status === 'active'
    && Number.isFinite(challenge.endsAt) && (challenge.endsAt as number) > now;
}

// Devolve a hora actual e volta a renderizar quando o próximo prazo passa,
// para que um desafio desapareça no momento em que termina.
export function useNow(deadlines: (number | undefined)[]): number {
  const [now, setNow] = useState(Date.now());
  const key = deadlines.join(',');
  useEffect(() => {
    const next = Math.min(...deadlines.filter((d): d is number => Number.isFinite(d) && (d as number) > now));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - now + 50, 2 ** 31 - 1));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, now]);
  return now;
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
        const list: Challenge[] = Object.entries(data).map(([id, value]) => ({ ...(value as Challenge), id }));
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

  const now = useNow(challenges.map(c => c.endsAt));
  const visible = filter === 'active' ? challenges.filter(c => isChallengeOpen(c, now)) : challenges;
  return { challenges: visible, loading, error };
}
