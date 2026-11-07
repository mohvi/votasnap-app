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
  // Código da província do perfil (ex.: 'MP'), para desafios regionais.
  province: string | null;
}

const EMPTY: Demographics = { loaded: false, loggedIn: false, birthDate: null, age: null, interests: [], province: null };
const Context = createContext<Demographics>(EMPTY);

// Idade e interesses da conta actual, partilhados por toda a app.
export function DemographicsProvider({ children }: PropsWithChildren) {
  const [value, setValue] = useState<Demographics>(EMPTY);

  useEffect(() => {
    let unsubscribe = () => {};
    let unsubscribeProvince = () => {};
    const stopAuth = onAuthStateChanged(auth, user => {
      unsubscribe();
      unsubscribeProvince();
      if (!user) { setValue({ ...EMPTY, loaded: true }); return; }
      setValue({ ...EMPTY, loggedIn: true });
      unsubscribeProvince = onValue(ref(db, `users/${user.uid}/province`), snap => {
        const province = typeof snap.val() === 'string' && snap.val() ? snap.val() : null;
        setValue(v => ({ ...v, province }));
      }, error => console.warn('Não foi possível ler a província:', error.message));
      unsubscribe = onValue(ref(db, `userDemographics/${user.uid}`), snap => {
        const data = snap.val() || {};
        const birthDate = typeof data.birthDate === 'string' ? data.birthDate : null;
        setValue(v => ({
          loaded: true,
          loggedIn: true,
          birthDate,
          age: ageFrom(birthDate),
          interests: Object.keys(data.interests || {}).filter(k => data.interests[k] === true),
          province: v.province,
        }));
      }, error => {
        console.warn('Não foi possível ler a idade/interesses:', error.message);
        setValue(v => ({ ...EMPTY, loaded: true, loggedIn: true, province: v.province }));
      });
    });
    return () => { stopAuth(); unsubscribe(); unsubscribeProvince(); };
  }, []);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useDemographics = () => useContext(Context);
