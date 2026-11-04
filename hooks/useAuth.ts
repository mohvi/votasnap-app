import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        // Um banimento temporário deixa de contar quando o prazo passa,
        // mesmo antes de um admin o levantar (as regras fazem o mesmo).
        if (u) {
          const [banSnap, untilSnap] = await Promise.all([
            get(ref(db, `users/${u.uid}/banned`)),
            get(ref(db, `users/${u.uid}/bannedUntil`)),
          ]);
          const until = untilSnap.val();
          const expired = typeof until === 'number' && until <= Date.now();

          if (banSnap.val() === true && !expired) {
            await signOut(auth);
            const untilText = typeof until === 'number'
              ? ` até ${new Date(until).toLocaleDateString('pt-MZ')}`
              : '';
            alert(`A tua conta foi suspensa${untilText}. Contacte 840237100, para recorrer`);
            setUser(null);
            setLoading(false);
            return;
          }
        }
        
        // User is either not logged in or not banned
        setUser(u);
        setLoading(false);
      } catch (error) {
        console.error('Error checking ban status:', error);
        // On error, still set the user to avoid breaking the app
        setUser(u);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return { user, loading, isLoggedIn: !!user };
}