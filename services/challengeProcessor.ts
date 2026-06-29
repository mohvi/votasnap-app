import { get, ref, update } from 'firebase/database';
import { db } from './firebase';

const WINNER_SNAPS = 50;
const PARTICIPANT_SNAPS = 5;

interface Entry {
  userId: string;
  votes: number;
}

export async function processEndedChallenges() {
  try {
    const challengesSnap = await get(ref(db, 'challenges'));
    if (!challengesSnap.exists()) return;

    const challenges = challengesSnap.val();
    const now = Date.now();

    for (const [challengeId, challenge] of Object.entries(challenges) as [string, any][]) {
      // Só processa desafios activos que já passaram do prazo
      if (challenge.status !== 'active') continue;
      if (challenge.endsAt > now) continue;

      await processChallenge(challengeId, challenge);
    }
  } catch (e) {
    console.error('[PROCESSOR] Erro ao processar desafios:', e);
  }
}

async function processChallenge(challengeId: string, challenge: any) {
  const entriesSnap = await get(ref(db, `entries/${challengeId}`));

  if (!entriesSnap.exists()) {
    // Sem participantes — só marca como terminado
    await update(ref(db, `challenges/${challengeId}`), {
      status: 'ended',
      processedAt: Date.now(),
    });
    return;
  }

  const entries: Record<string, Entry> = entriesSnap.val();
  const entriesList = Object.entries(entries).map(([id, e]) => ({ id, ...e }));

  // Encontra o vencedor — mais votos
  entriesList.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const topEntry = entriesList[0];
  const hasVotes = (topEntry?.votes || 0) > 0;

  // Se ninguém tem votos, não há vencedor
  if (!hasVotes) {
    // Todos os participantes recebem Snaps de participação, mas sem vencedor
    for (const entry of entriesList) {
      const userSnap = await get(ref(db, `users/${entry.userId}`));
      const currentSnaps = userSnap.val()?.snaps || 0;

      await update(ref(db, `users/${entry.userId}`), {
        snaps: currentSnaps + PARTICIPANT_SNAPS,
      });

      const historyRef = ref(db, `snaps_history/${entry.userId}/${challengeId}_${entry.id}`);
      await update(historyRef, {
        amount: PARTICIPANT_SNAPS,
        type: 'challenge_participated',
        description: `Participaste em "${challenge.title}" (sem votos suficientes)`,
        createdAt: Date.now(),
      });
    }

    await update(ref(db, `challenges/${challengeId}`), {
      status: 'ended',
      winnerId: null,
      processedAt: Date.now(),
      noWinnerReason: 'no_votes',
    });
    return;
  }

  // Verifica se há empate no topo
  const tiedEntries = entriesList.filter(e => (e.votes || 0) === topEntry.votes);
  const isTie = tiedEntries.length > 1;

  const winner = topEntry;

  // Distribui Snaps
  for (const entry of entriesList) {
    const isWinner = entry.id === winner.id && !isTie;
    const snapsEarned = isWinner ? WINNER_SNAPS : PARTICIPANT_SNAPS;

    const userSnap = await get(ref(db, `users/${entry.userId}`));
    const currentSnaps = userSnap.val()?.snaps || 0;

    await update(ref(db, `users/${entry.userId}`), {
      snaps: currentSnaps + snapsEarned,
    });

    const historyRef = ref(db, `snaps_history/${entry.userId}/${challengeId}_${entry.id}`);
    await update(historyRef, {
      amount: snapsEarned,
      type: isWinner ? 'challenge_won' : 'challenge_participated',
      description: isWinner
        ? `Venceste "${challenge.title}"`
        : `Participaste em "${challenge.title}"`,
      createdAt: Date.now(),
    });

    if (isWinner) {
      const wins = userSnap.val()?.wins || 0;
      await update(ref(db, `users/${entry.userId}`), { wins: wins + 1 });
    }
  }

  // Marca o desafio — se houver empate, fica para a equipa decidir manualmente
  await update(ref(db, `challenges/${challengeId}`), {
    status: isTie ? 'pending_confirmation' : 'pending_confirmation',
    winnerId: isTie ? null : winner.userId,
    winnerEntryId: isTie ? null : winner.id,
    winnerVotes: winner.votes || 0,
    isTie,
    tiedCount: isTie ? tiedEntries.length : 0,
    processedAt: Date.now(),
  });
}