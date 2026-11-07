import { ref, serverTimestamp, set, update } from 'firebase/database';
import { auth, db } from './firebase';
import PROVINCES from '../hooks/useProvinces';

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

// Províncias de um desafio regional (códigos como 'SF'). Vazio = nacional.
export function challengeProvinces(challenge: { provinces?: string[] | Record<string, unknown> | null } | null | undefined): string[] {
  const p = challenge?.provinces;
  if (Array.isArray(p)) return p.filter(x => typeof x === 'string' && x);
  if (p && typeof p === 'object') return Object.values(p).filter((x): x is string => typeof x === 'string' && !!x);
  return [];
}

// "Sofala" ou "Maputo e Maputo Cidade"; vazio nos desafios nacionais.
export function regionLabel(challenge: Parameters<typeof challengeProvinces>[0]): string {
  const names = challengeProvinces(challenge).map(code => PROVINCES.find(p => p.code === code)?.name || code);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

// Pode participar: desafio nacional, ou a província do perfil está na lista.
export function canJoinRegion(challenge: Parameters<typeof challengeProvinces>[0], province: string | null): boolean {
  const list = challengeProvinces(challenge);
  return list.length === 0 || (!!province && list.includes(province));
}

// Aparece no feed, na montra e no ranking: idade suficiente e, se o desafio é
// regional, a província certa. Quem não tem província (visitantes) vê tudo,
// mas só participa quem vive lá. Votar continua aberto a todos pelo link.
export function isChallengeListed(
  challenge: Parameters<typeof challengeMinAge>[0] & Parameters<typeof challengeProvinces>[0],
  age: number | null,
  province: string | null,
): boolean {
  return canAccessChallenge(challenge, age) && (!province || canJoinRegion(challenge, province));
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
