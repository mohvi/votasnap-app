import { onValue, ref } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../services/firebase';

export function useSnaps() {
  const [snaps, setSnaps] = useState(0);
  const [justEarned, setJustEarned] = useState<number | null>(null);
  const previousSnaps = useRef<number | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onValue(ref(db, `users/${uid}/snaps`), snapshot => {
      const newValue = snapshot.val() || 0;

      // Detecta aumento de saldo para mostrar animação
      if (previousSnaps.current !== null && newValue > previousSnaps.current) {
        const diff = newValue - previousSnaps.current;
        setJustEarned(diff);
        setTimeout(() => setJustEarned(null), 2500);
      }

      previousSnaps.current = newValue;
      setSnaps(newValue);
    });

    return () => unsub();
  }, []);

  return { snaps, justEarned };
}