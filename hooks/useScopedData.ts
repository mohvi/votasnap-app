import { equalTo, get, limitToLast, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../services/firebase';

// Leituras limitadas ao que o ecrã mostra. Em vez de subscrever os nós
// inteiros (`entries`, `votes`, `publicProfiles`), cada ecrã escolhe os
// desafios relevantes e só esses são descarregados. Com milhares de
// publicações isto é a diferença entre megabytes e kilobytes por abertura.

type Dict = Record<string, any>;

// 'active' → só desafios activos; 'recent' → os últimos N por data de fim.
export function useChallengesScope(scope: 'active' | 'recent', limit = 30) {
  const [challenges, setChallenges] = useState<Dict>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const q = scope === 'active'
      ? query(ref(db, 'challenges'), orderByChild('status'), equalTo('active'))
      : query(ref(db, 'challenges'), orderByChild('endsAt'), limitToLast(limit));
    return onValue(
      q,
      snap => { setChallenges(snap.val() || {}); setLoaded(true); },
      error => { console.error('Erro ao ler desafios:', error); setLoaded(true); },
    );
  }, [scope, limit]);

  return { challenges, loaded };
}

// Lista estável de ids para usar como dependência de efeitos.
function useIdsKey(ids: string[]) {
  return useMemo(() => [...new Set(ids)].sort().join('|'), [ids]);
}

// Publicações em tempo real, apenas dos desafios indicados.
export function useEntriesFor(challengeIds: string[]) {
  const key = useIdsKey(challengeIds);
  const [entries, setEntries] = useState<Dict>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    setEntries(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => ids.includes(id))));
    if (!ids.length) { setLoaded(true); return undefined; }
    let pending = new Set(ids);
    const unsubs = ids.map(id => onValue(
      ref(db, `entries/${id}`),
      snap => {
        setEntries(prev => ({ ...prev, [id]: snap.val() || {} }));
        if (pending.delete(id) && pending.size === 0) setLoaded(true);
      },
      () => { if (pending.delete(id) && pending.size === 0) setLoaded(true); },
    ));
    return () => { pending = new Set(); unsubs.forEach(u => u()); };
  }, [key]);

  return { entries, loaded };
}

// Em que publicação o utilizador actual votou, por desafio. Lê só
// votes/{desafio}/{uid} — os votos dos outros não são públicos.
export function useMyVotes(challengeIds: string[]) {
  const key = useIdsKey(challengeIds);
  const uid = auth.currentUser?.uid;
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    if (!uid || !ids.length) { setVotes({}); setLoaded(true); return undefined; }
    let pending = new Set(ids);
    const unsubs = ids.map(id => onValue(
      ref(db, `votes/${id}/${uid}`),
      snap => {
        const entryId = snap.val()?.entryId;
        setVotes(prev => {
          const next = { ...prev };
          if (entryId) next[id] = entryId; else delete next[id];
          return next;
        });
        if (pending.delete(id) && pending.size === 0) setLoaded(true);
      },
      () => { if (pending.delete(id) && pending.size === 0) setLoaded(true); },
    ));
    return () => { pending = new Set(); unsubs.forEach(u => u()); };
  }, [key, uid]);

  return { votes, loaded };
}

// Perfis públicos pedidos um a um e guardados em memória durante a sessão:
// mudam raramente e o feed mostra sempre os mesmos autores.
const profileCache = new Map<string, Dict | null>();

export function useProfiles(uids: string[]) {
  const key = useIdsKey(uids);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const missing = (key ? key.split('|') : []).filter(uid => uid && !profileCache.has(uid));
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map(uid => get(ref(db, `publicProfiles/${uid}`))
      .then(snap => profileCache.set(uid, snap.val()))
      .catch(() => profileCache.set(uid, null))))
      .then(() => { if (!cancelled) setVersion(v => v + 1); });
    return () => { cancelled = true; };
  }, [key]);

  // Objecto estável enquanto nada muda: os ecrãs usam-no como dependência de efeitos.
  return useMemo(() => {
    const ids = key ? key.split('|') : [];
    return Object.fromEntries(ids.map(uid => [uid, profileCache.get(uid) || null])) as Dict;
    // `version` força o recálculo quando chegam perfis novos à cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
}
