import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ageFrom } from '../services/demographics';
import { auth, db } from '../services/firebase';

interface Demographics {
  loaded: boolean;
  loggedIn: boolean;
  birthDate: string | null;
  age: number | null;
  interests: string[];
}

const EMPTY: Demographics = { loaded: false, loggedIn: false, birthDate: null, age: null, interests: [] };
const Context = createContext<Demographics>(EMPTY);

// Idade e interesses da conta actual, partilhados por toda a app.
export function DemographicsProvider({ children }: PropsWithChildren) {
  const [value, setValue] = useState<Demographics>(EMPTY);

  useEffect(() => {
    let unsubscribe = () => {};
    const stopAuth = onAuthStateChanged(auth, user => {
      unsubscribe();
      if (!user) { setValue({ ...EMPTY, loaded: true }); return; }
      setValue({ ...EMPTY, loggedIn: true });
      unsubscribe = onValue(ref(db, `userDemographics/${user.uid}`), snap => {
        const data = snap.val() || {};
        const birthDate = typeof data.birthDate === 'string' ? data.birthDate : null;
        setValue({
          loaded: true,
          loggedIn: true,
          birthDate,
          age: ageFrom(birthDate),
          interests: Object.keys(data.interests || {}).filter(k => data.interests[k] === true),
        });
      }, error => {
        console.warn('Não foi possível ler a idade/interesses:', error.message);
        setValue({ ...EMPTY, loaded: true, loggedIn: true });
      });
    });
    return () => { stopAuth(); unsubscribe(); };
  }, []);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useDemographics = () => useContext(Context);
