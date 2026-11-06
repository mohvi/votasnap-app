import { ref, serverTimestamp, set, update } from 'firebase/database';
import { auth, db } from './firebase';

// Idade e interesses ficam em userDemographics/{uid}: só o próprio e a
// administração os lêem. As marcas só recebem números agregados (faixas etárias).

export const INTERESTS = [
  { key: 'fotografia', label: 'Fotografia', icon: 'camera-outline' },
  { key: 'musica', label: 'Música', icon: 'musical-notes-outline' },
  { key: 'danca', label: 'Dança', icon: 'body-outline' },
  { key: 'moda', label: 'Moda', icon: 'shirt-outline' },
  { key: 'beleza', label: 'Beleza', icon: 'sparkles-outline' },
  { key: 'desporto', label: 'Desporto', icon: 'football-outline' },
  { key: 'culinaria', label: 'Comida', icon: 'restaurant-outline' },
  { key: 'bebidas', label: 'Bebidas', icon: 'wine-outline' },
  { key: 'tecnologia', label: 'Tecnologia', icon: 'phone-portrait-outline' },
  { key: 'viagens', label: 'Viagens', icon: 'airplane-outline' },
  { key: 'arte', label: 'Arte', icon: 'color-palette-outline' },
  { key: 'humor', label: 'Humor', icon: 'happy-outline' },
] as const;

export type InterestKey = (typeof INTERESTS)[number]['key'];

export const MIN_APP_AGE = 13;

// 'AAAA-MM-DD' → idade em anos completos, ou null se a data for inválida.
export function ageFrom(birthDate: string | null | undefined, now = Date.now()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate || '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(Date.UTC(y, mo - 1, d));
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== mo - 1 || birth.getUTCDate() !== d) return null;
  const today = new Date(now);
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() < mo - 1 || (today.getUTCMonth() === mo - 1 && today.getUTCDate() < d)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

// Converte dia/mês/ano escritos pela pessoa em 'AAAA-MM-DD' (ou null).
export function toBirthDate(day: string, month: string, year: string): string | null {
  const value = `${year.trim().padStart(4, '0')}-${month.trim().padStart(2, '0')}-${day.trim().padStart(2, '0')}`;
  return ageFrom(value) === null ? null : value;
}

// Idade mínima exigida por um desafio. Bebidas alcoólicas são sempre 18+.
export function challengeMinAge(challenge: { minAge?: number | null; alcohol?: boolean | null } | null | undefined): number {
  if (!challenge) return 0;
  if (challenge.alcohol) return 18;
  return Number(challenge.minAge) > 0 ? Number(challenge.minAge) : 0;
}

// Sem restrição, todos vêem. Com restrição, só quem declarou idade suficiente
// (visitantes e contas sem data de nascimento não vêem).
export function canAccessChallenge(challenge: Parameters<typeof challengeMinAge>[0], age: number | null): boolean {
  const min = challengeMinAge(challenge);
  return min === 0 || (age !== null && age >= min);
}

export async function saveBirthDate(birthDate: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sessão expirada. Volta a fazer login.');
  await set(ref(db, `userDemographics/${uid}/birthDate`), birthDate);
}

export async function saveInterests(keys: string[]) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sessão expirada. Volta a fazer login.');
  const allowed = new Set<string>(INTERESTS.map(i => i.key));
  const interests: Record<string, true | null> = {};
  for (const i of INTERESTS) interests[i.key] = null;
  for (const k of keys) if (allowed.has(k)) interests[k] = true;
  await update(ref(db, `userDemographics/${uid}`), { interests, updatedAt: serverTimestamp() });
}
