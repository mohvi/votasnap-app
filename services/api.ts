import { auth } from './firebase';
import { readApiResponse } from './api-response';

// Participar e votar passam pelo site (Vercel), que verifica no servidor a
// idade mínima e a abertura do desafio antes de reencaminhar para o backend.
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://votasnap.vercel.app').trim();
const CHALLENGE_GATE_URL = SITE_URL.replace(/\/$/, '') + '/api/challenge-action';

async function send(url: string, body?: object): Promise<Response> {
  if (!url.startsWith('https://') && !(__DEV__ && url.startsWith('http://'))) {
    throw new Error('A ligação ao serviço precisa de HTTPS.');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Volta a fazer login.');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    return await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Não foi possível confirmar a operação. Verifica o estado antes de tentar novamente.');
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function authenticatedRequest<T>(path: string, body?: object): Promise<T> {
  const base = process.env.EXPO_PUBLIC_BACKEND_URL?.trim().replace(/\/$/, '');
  if (!base) throw new Error('Serviço indisponível. Contacta o suporte.');
  return readApiResponse<T>(await send(base + path, body));
}

// Participar ou votar. Se a própria Vercel falhar antes de correr o nosso
// código (erro 5xx sem JSON), o pedido nunca chegou ao backend, por isso vai
// directamente para lá em vez de bloquear a pessoa. Recusas da verificação
// (idade, desafio fechado) vêm em JSON e são respeitadas.
export async function challengeAction<T>(action: 'submit' | 'vote', body: object): Promise<T> {
  // Falhas de rede ou de tempo não caem para o backend: o pedido pode já ter
  // passado, e repeti-lo podia duplicar a participação.
  const response = await send(`${CHALLENGE_GATE_URL}?action=${action}`, body);
  if (response.status < 500) return readApiResponse<T>(response);
  const text = await response.clone().text();
  let isJson = true;
  try { JSON.parse(text); } catch { isJson = false; }
  if (isJson) return readApiResponse<T>(response);
  return authenticatedRequest<T>(`/api/challenges/${action}`, body);
}
