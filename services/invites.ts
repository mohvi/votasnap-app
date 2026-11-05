import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import {
  equalTo, get, increment, limitToLast, onValue, orderByChild, query, ref, serverTimestamp, update,
} from 'firebase/database';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { auth, db } from './firebase';
import { reportEvent } from './notifications';

// Desafio "Convida amigos". Não há passos manuais: o convidado é atribuído
// automaticamente por uma destas vias, por ordem de prioridade:
//  1. o número dele foi convidado (invitedPhones) — confirmado pelo SMS do login;
//  2. o código do link: deep link, Play Install Referrer ou área de transferência.
// As regras do Firebase validam cada atribuição e o contador do ranking.

export const INVITE_BASE_URL = 'https://votasnap.vercel.app/invite';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=mz.votasnap.app';
const CLIPBOARD_PREFIX = 'VOTASNAP-CONVITE:';
const PENDING_KEY = 'votasnap.pendingInvite';
const REFERRER_CHECKED_KEY = 'votasnap.installReferrerChecked';
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export interface InviteCampaign {
  id: string;
  title: string;
  prize: string;
  goal: number;
  minimum: number;
  startsAt: number;
  endsAt: number;
  status: 'active' | 'ended';
  winnerUid?: string;
}

export type InviteSource = 'phone' | 'link' | 'referrer' | 'clipboard';

// ── Campanha activa ──

export function useActiveInviteCampaign() {
  const [campaign, setCampaign] = useState<InviteCampaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onValue(
    query(ref(db, 'inviteCampaigns'), orderByChild('status'), equalTo('active')),
    snap => {
      const list = Object.entries<any>(snap.val() || {}).map(([id, c]) => ({ ...c, id })) as InviteCampaign[];
      const now = Date.now();
      setCampaign(list.filter(c => c.endsAt > now).sort((a, b) => b.startsAt - a.startsAt)[0] ?? null);
      setLoading(false);
    },
    () => setLoading(false),
  ), []);

  return { campaign, loading };
}

// ── Números ──

// Aceita "84 123 4567", "841234567", "+258841234567"… e devolve "258841234567".
export function normalizeMzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('258') ? digits.slice(3) : digits.replace(/^0+/, '');
  return /^8[2-7][0-9]{7}$/.test(local) ? `258${local}` : null;
}

export const myPhoneKey = () => auth.currentUser?.phoneNumber?.replace('+', '') ?? null;

export function inviteLink(username: string) {
  return `${INVITE_BASE_URL}/${encodeURIComponent(username)}`;
}

export function inviteMessage(campaign: InviteCampaign, username: string) {
  return `Junta-te a mim no VotaSnap! 📸\n\n` +
    `Estou no desafio "${campaign.title}" — prémio: ${campaign.prize} 🎁\n` +
    `Cria a tua conta por aqui 👉 ${inviteLink(username)}`;
}

// Reclama o número e abre o WhatsApp nessa conversa, já com a mensagem.
export async function inviteByPhone(campaign: InviteCampaign, phoneKey: string, username: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Precisas de ter sessão iniciada.');
  if (phoneKey === myPhoneKey()) throw new Error('Não te podes convidar a ti próprio.');
  try {
    await update(ref(db), {
      [`invitedPhones/${campaign.id}/${phoneKey}`]: { inviterUid: uid, at: serverTimestamp() },
      [`inviteSent/${campaign.id}/${uid}/${phoneKey}`]: { at: serverTimestamp() },
      [`inviteSentCount/${campaign.id}/${uid}`]: increment(1),
    });
  } catch {
    // As regras recusam números já convidados, inválidos ou acima do limite.
    throw new Error('Este número já foi convidado por alguém, ou chegaste ao limite de convites.');
  }
  const url = `https://wa.me/${phoneKey}?text=${encodeURIComponent(inviteMessage(campaign, username))}`;
  await Linking.openURL(url).catch(() => undefined);
}

// ── Código pendente (link, Play Store ou área de transferência) ──

export async function savePendingInvite(code: string, source: InviteSource) {
  const clean = code.trim().toLowerCase();
  if (!USERNAME_RE.test(clean)) return;
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ code: clean, source, at: Date.now() }));
}

async function readPendingInvite(): Promise<{ code: string; source: InviteSource } | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Android + Play Store: o link do convite leva `referrer=invite%3Dana`.
// Corre uma vez por instalação.
export async function captureInstallReferrer() {
  if (Platform.OS !== 'android') return;
  try {
    if (await AsyncStorage.getItem(REFERRER_CHECKED_KEY)) return;
    await AsyncStorage.setItem(REFERRER_CHECKED_KEY, '1');
    const referrer = await Application.getInstallReferrerAsync();
    const match = /(?:^|&)invite=([^&]+)/.exec(referrer || '');
    if (match) await savePendingInvite(decodeURIComponent(match[1]), 'referrer');
  } catch {
    // Instalado fora da Play Store ou serviço indisponível.
  }
}

// APK directo / iPhone: a página do convite copia "VOTASNAP-CONVITE:ana".
// No iPhone o sistema pede autorização para colar.
export async function captureClipboardInvite() {
  try {
    if (await readPendingInvite()) return;
    if (!(await Clipboard.hasStringAsync())) return;
    const text = await Clipboard.getStringAsync();
    const match = new RegExp(`${CLIPBOARD_PREFIX}([a-z0-9_.]{3,20})`, 'i').exec(text || '');
    if (match) await savePendingInvite(match[1], 'clipboard');
  } catch {
    // Sem acesso à área de transferência.
  }
}

// ── Atribuição ──

async function uidForUsername(username: string) {
  const snap = await get(query(ref(db, 'publicProfiles'), orderByChild('username'), equalTo(username)));
  return Object.keys(snap.val() || {})[0] ?? null;
}

async function activeCampaignOnce(): Promise<InviteCampaign | null> {
  const snap = await get(query(ref(db, 'inviteCampaigns'), orderByChild('status'), equalTo('active')));
  const now = Date.now();
  const list = Object.entries<any>(snap.val() || {}).map(([id, c]) => ({ ...c, id })) as InviteCampaign[];
  return list.find(c => c.endsAt > now) ?? null;
}

let claiming = false;

// Idempotente: pode ser chamada em cada arranque. Só escreve quando há
// campanha activa, perfil criado e alguém a quem atribuir o convite.
export async function claimInviteAttribution(): Promise<string | null> {
  const user = auth.currentUser;
  const phone = myPhoneKey();
  if (!user || !phone || claiming) return null;
  claiming = true;
  try {
    const campaign = await activeCampaignOnce();
    if (!campaign) return null;
    if ((await get(ref(db, `inviteAttributions/${campaign.id}/${user.uid}`))).exists()) return null;
    if (!(await get(ref(db, `publicProfiles/${user.uid}/username`))).exists()) return null;

    let inviterUid: string | null = null;
    let via: InviteSource | null = null;
    const claim = await get(ref(db, `invitedPhones/${campaign.id}/${phone}`));
    if (claim.exists()) {
      inviterUid = claim.val().inviterUid;
      via = 'phone';
    } else {
      const pending = await readPendingInvite();
      if (pending) {
        inviterUid = await uidForUsername(pending.code);
        via = pending.source;
      }
    }
    if (!inviterUid || !via || inviterUid === user.uid) return null;

    await update(ref(db), {
      [`inviteAttributions/${campaign.id}/${user.uid}`]: { inviterUid, at: serverTimestamp(), via },
      [`invitePhonesUsed/${phone}`]: campaign.id,
      [`inviteProgress/${campaign.id}/${inviterUid}/count`]: increment(1),
      [`inviteProgress/${campaign.id}/${inviterUid}/updatedAt`]: serverTimestamp(),
    });
    await AsyncStorage.removeItem(PENDING_KEY);
    reportEvent({ type: 'invite', campaignId: campaign.id });
    return inviterUid;
  } catch {
    // Conta antiga, número já usado ou campanha fechada: as regras recusam.
    await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
    return null;
  } finally {
    claiming = false;
  }
}

// ── Progresso e ranking ──

export interface RankRow { uid: string; count: number; updatedAt: number }

// Top N por número de convites; em empate, quem lá chegou primeiro.
export function useInviteRanking(campaignId: string | undefined, limit = 50) {
  const [rows, setRows] = useState<RankRow[]>([]);
  useEffect(() => {
    if (!campaignId) return undefined;
    return onValue(
      query(ref(db, `inviteProgress/${campaignId}`), orderByChild('count'), limitToLast(limit)),
      snap => {
        const list = Object.entries<any>(snap.val() || {})
          .map(([uid, p]) => ({ uid, count: p?.count || 0, updatedAt: p?.updatedAt || 0 }));
        setRows(list.sort((a, b) => b.count - a.count || a.updatedAt - b.updatedAt));
      },
    );
  }, [campaignId, limit]);
  return rows;
}

export function useMyInviteProgress(campaignId: string | undefined) {
  const uid = auth.currentUser?.uid;
  const [count, setCount] = useState(0);
  const [sent, setSent] = useState<string[]>([]);
  useEffect(() => {
    if (!campaignId || !uid) return undefined;
    const a = onValue(ref(db, `inviteProgress/${campaignId}/${uid}/count`), s => setCount(s.val() || 0));
    const b = onValue(ref(db, `inviteSent/${campaignId}/${uid}`), s => setSent(Object.keys(s.val() || {})));
    return () => { a(); b(); };
  }, [campaignId, uid]);
  return { count, sent };
}
