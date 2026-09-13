import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref, remove, set } from 'firebase/database';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { auth, db } from '../services/firebase';

const Context = createContext({
  blocked: [] as string[],
  block: async (_uid: string): Promise<void> => {},
  unblock: async (_uid: string): Promise<void> => {},
});

export function BlockedUsersProvider({ children }: PropsWithChildren) {
  const [blocked, setBlocked] = useState<string[]>([]);
  useEffect(() => {
    let unsubscribe = () => {};
    const stopAuth = onAuthStateChanged(auth, user => {
      unsubscribe(); setBlocked([]);
      if (user) unsubscribe = onValue(ref(db, 'blocks/' + user.uid), snapshot => {
        setBlocked(Object.keys(snapshot.val() || {}));
      }, error => console.warn('Não foi possível carregar os bloqueios:', error.message));
    });
    return () => { stopAuth(); unsubscribe(); };
  }, []);
  const path = (uid: string) => {
    const current = auth.currentUser;
    if (!current || current.uid === uid) throw new Error('Não é possível bloquear este utilizador.');
    return ref(db, 'blocks/' + current.uid + '/' + uid);
  };
  const block = async (uid: string) => { await set(path(uid), true); };
  const unblock = async (uid: string) => { await remove(path(uid)); };
  return <Context.Provider value={{ blocked, block, unblock }}>{children}</Context.Provider>;
}

export const useBlockedUsers = () => useContext(Context);
