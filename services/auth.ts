import { signInWithCustomToken } from 'firebase/auth';
import { get, ref, set, update } from 'firebase/database';
import { auth, db } from './firebase';

const API_URL = process.env.EXPO_PUBLIC_API_URL_PROD || 'https://us-central1-votasnap.cloudfunctions.net';


async function saveOrUpdateUser(uid: string, phone: string) {
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  if (!snap.exists()) {
    await set(userRef, {
      uid, phone,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      profileComplete: false,
    });
    return { isNewUser: true, profileComplete: false };
  }
  await update(userRef, { lastLogin: Date.now() });
  return {
    isNewUser: false,
    profileComplete: snap.val()?.profileComplete || false,
  };
}

// ─── PRODUÇÃO ──────────────────────────────────────────────────────────────

export async function sendCode(phone: string): Promise<void> {
  const res = await fetch(`${API_URL}/sendVerificationCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: `258${phone}` }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Erro ao enviar SMS');
}

export async function verifyCode(phone: string, code: string) {
  const res = await fetch(`${API_URL}/verifyCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: `258${phone}`, code }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.attemptsLeft
        ? `${data.attemptsLeft} tentativas restantes`
        : data.error || 'Código inválido'
    );
  }
  await signInWithCustomToken(auth, data.token);
  return saveOrUpdateUser(data.userId, data.phone);
}

export async function resendCode(phone: string): Promise<number | null> {
  const res = await fetch(`${API_URL}/resendCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: `258${phone}` }),
  });
  const data = await res.json();
  if (!data.success) {
    if (data.waitTime) return data.waitTime;
    throw new Error(data.error || 'Erro ao reenviar');
  }
  return null;
}