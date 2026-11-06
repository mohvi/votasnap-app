import { auth } from './firebase';
import { readApiResponse } from './api-response';

// Participar e votar passam pelo site (Vercel), que verifica no servidor a
// idade mínima e a abertura do desafio antes de reencaminhar para o backend.
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://votasnap.vercel.app').trim();
export const CHALLENGE_GATE_URL = SITE_URL.replace(/\/$/, '') + '/api/challenge-action';

export async function authenticatedRequest<T>(path: string, body?: object, baseUrl?: string): Promise<T> {
  const base = (baseUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL)?.trim().replace(/\/$/, '');
  if (!base) throw new Error('Serviço indisponível. Contacta o suporte.');
  if (!base.startsWith('https://') && !(__DEV__ && base.startsWith('http://'))) {
    throw new Error('A ligação ao serviço precisa de HTTPS.');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Volta a fazer login.');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    return await readApiResponse<T>(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Não foi possível confirmar a operação. Verifica o estado antes de tentar novamente.');
    }
    throw error;
  } finally { clearTimeout(timeout); }
}
