import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { db } from '../services/firebase';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  // A participação é sempre gratuita. 'paid' só existe em desafios antigos.
  type: 'free' | 'sponsored' | 'paid';
  prize: string;
  prizeType: 'physical' | 'cash' | 'badge';
  sponsor: string;
  sponsorId?: string | null;
  sponsorLogo?: string | null;
  coverImage: string;
  createdBy: string;
  createdAt: number;
  endsAt: number;
  status: 'active' | 'ended' | 'cancelled' | 'pending_confirmation' | 'completed';
  totalVotes: number;
  totalParticipants: number;
  // Agendado: anunciado em "Em breve" e aberto a partir de startsAt.
  startsAt?: number | null;
  // Idade mínima (0, 16 ou 18). Desafios de álcool são sempre 18+.
  minAge?: number | null;
  alcohol?: boolean | null;
  winnerId?: string | null;
  winnerEntryId?: string | null;
  winnerVotes?: number | null;
  confirmedAt?: number | null;
}

// Desafios antigos não têm startsAt: abriram quando foram criados.
export function challengeStartsAt(challenge: { startsAt?: number | null; createdAt?: number }): number {
  return Number.isFinite(challenge.startsAt) ? (challenge.startsAt as number) : (challenge.createdAt ?? 0);
}

// Anunciado mas ainda não aberto.
export function isChallengeUpcoming(
  challenge: { status?: string; startsAt?: number | null; createdAt?: number } | null | undefined,
  now = Date.now(),
): boolean {
  return !!challenge && challenge.status === 'active' && challengeStartsAt(challenge) > now;
}

// Desafios sem marca são da comunidade (organizados pela VotaSnap).
export function challengeTypeLabel(type?: string): string {
  return type === 'sponsored' ? 'Patrocinado' : 'Comunidade';
}

// Um desafio só é visível enquanto está activo E dentro do prazo. O encerramento
// no servidor é manual, por isso `status` pode continuar 'active' depois de `endsAt`.
export function isChallengeOpen(
  challenge: { status?: string; endsAt?: number; startsAt?: number | null; createdAt?: number } | null | undefined,
  now = Date.now(),
): boolean {
  return !!challenge && challenge.status === 'active'
    && challengeStartsAt(challenge) <= now
    && Number.isFinite(challenge.endsAt) && (challenge.endsAt as number) > now;
}

// Prazos que mudam o estado de um desafio (abrir e fechar), para useNow.
export function challengeDeadlines(challenge: { endsAt?: number; startsAt?: number | null } | null | undefined) {
  return challenge ? [challenge.endsAt, challenge.startsAt ?? undefined] : [];
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

  const now = useNow(challenges.flatMap(challengeDeadlines));
  const visible = filter === 'active' ? challenges.filter(c => isChallengeOpen(c, now)) : challenges;
  return { challenges: visible, loading, error };
}
