import { ref, serverTimestamp, set } from 'firebase/database';
import { db } from './firebase';

const MIN_INTERVAL_MS = 30 * 60 * 1000;
let lastMarked = 0;

// Grava users/{uid}/lastLogin com a hora do servidor (a regra só aceita essa).
// Falhas são ignoradas: é só uma métrica, não pode atrapalhar a app.
export function markActive(uid: string) {
  const now = Date.now();
  if (now - lastMarked < MIN_INTERVAL_MS) return;
  lastMarked = now;
  set(ref(db, `users/${uid}/lastLogin`), serverTimestamp()).catch(() => {
    lastMarked = 0;
  });
}
