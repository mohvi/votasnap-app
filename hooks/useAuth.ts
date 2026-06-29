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
        // Check if user is banned
        if (u) {
          const banSnap = await get(ref(db, `users/${u.uid}/banned`));
          console.log('banSnap', banSnap.val());
          
          if (banSnap.val() === true) {
            await signOut(auth);
            alert('A tua conta foi suspensa. Contacte 840237100, para recorrer');
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