import * as Clipboard from 'expo-clipboard';
import { Alert, Share } from 'react-native';

const APP_URL = 'https://votasnap.vercel.app';

export function buildEntryLink(challengeId: string, entryId: string) {
  return `${APP_URL}/entry/${challengeId}/${entryId}`;
}

export function buildChallengeLink(challengeId: string) {
  return `${APP_URL}/challenge/${challengeId}`;
}

export async function shareEntry({
  challengeTitle,
  userName,
  challengeId,
  entryId,
  prize,
}: {
  challengeTitle: string;
  userName: string;
  challengeId: string;
  entryId: string;
  prize: string;
}) {
  const link = buildEntryLink(challengeId, entryId);
const message =
  `🗳️ Vota em mim no VotaSnap!\n\n` +
  `Estou a participar no desafio "${challengeTitle}".\n` +
  `O prémio é: ${prize} 🎁\n\n` +
  `Vota aqui 👉 ${link}`;

  try {
    await Share.share({ message });
  } catch (e: any) {
    await Clipboard.setStringAsync(message);
    Alert.alert('Link copiado! 📋', 'Cola onde quiseres para partilhar.');
  }
}

export async function sharePost({
  challengeTitle,
  userName,
  challengeId,
  entryId,
  prize,
}: {
  challengeTitle: string;
  userName: string;
  challengeId: string;
  entryId: string;
  prize: string;
}) {
  const link = buildEntryLink(challengeId, entryId);
  const message =
    `👀 Vê este post no VotaSnap!\n\n` +
    `${userName} está a participar em "${challengeTitle}".\n` +
    `Prémio: ${prize} 🎁\n\n` +
    `Vota aqui 👉 ${link}`;

  try {
    await Share.share({ message });
  } catch (e: any) {
    await Clipboard.setStringAsync(message);
    Alert.alert('Link copiado! 📋', 'Cola onde quiseres para partilhar.');
  }
}

export async function copyLink(challengeId: string, entryId: string) {
  const link = buildEntryLink(challengeId, entryId);
  await Clipboard.setStringAsync(link);
  Alert.alert('Link copiado! 📋', link);
}