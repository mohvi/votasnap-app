import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { get, ref, update } from 'firebase/database';
import { Platform } from 'react-native';
import { auth, db } from './firebase';

const isNotificationsAvailable = () => {
  try {
    require('expo-notifications');
    return true;
  } catch {
    return false;
  }
};

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (!isNotificationsAvailable()) {
    console.log('[PUSH] expo-notifications não disponível neste ambiente');
    return null;
  }
  if (!Device.isDevice) {
    console.log('[PUSH] Precisa de dispositivo físico');
    return null;
  }

  const Notifications = require('expo-notifications');

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[PUSH] Permissão negada');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'VotaSnap',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ff286a',
    });
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId:
        Constants.expoConfig?.extra?.eas?.projectId ??
        'ce729688-374a-4762-80dd-103cd7d4748d',
    })
  ).data;

  console.log('[PUSH] Token:', token);

  return token;
}

export async function savePushToken(token: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await update(ref(db, `users/${uid}`), {
    pushToken: token,
    pushTokenUpdatedAt: Date.now(),
  });
}

export async function sendPushNotification({
  toToken,
  title,
  body,
  data,
}: {
  toToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      to: toToken,
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: 'high',
    }),
  });
}

export async function notifyVoteReceived({
  entryOwnerId,
  voterName,
  challengeTitle,
  challengeId,
  entryId,
}: {
  entryOwnerId: string;
  voterName: string;
  challengeTitle: string;
  challengeId: string;
  entryId: string;
}) {
  try {
    const userSnap = await get(ref(db, `users/${entryOwnerId}`));
    if (!userSnap.exists()) return;
    const token = userSnap.val()?.pushToken;
    if (!token) return;
    await sendPushNotification({
      toToken: token,
      title: '🗳️ Novo voto!',
      body: `${voterName} votou na tua entrada em "${challengeTitle}"`,
      data: { challengeId, entryId, type: 'vote' },
    });
  } catch (e) {
    console.error('[PUSH] Erro ao notificar voto:', e);
  }
}

export async function notifyChallengeEnded({
  userId,
  challengeTitle,
  challengeId,
  isWinner,
  prize,
}: {
  userId: string;
  challengeTitle: string;
  challengeId: string;
  isWinner: boolean;
  prize: string;
}) {
  try {
    const userSnap = await get(ref(db, `users/${userId}`));
    if (!userSnap.exists()) return;
    const token = userSnap.val()?.pushToken;
    if (!token) return;
    await sendPushNotification({
      toToken: token,
      title: isWinner ? '🏆 Ganhaste!' : '⏱ Desafio encerrado',
      body: isWinner
        ? `Parabéns! Ganhaste "${challengeTitle}" e o prémio: ${prize}!`
        : `O desafio "${challengeTitle}" terminou. Vê os resultados!`,
      data: { challengeId, type: 'challenge_ended' },
    });
  } catch (e) {
    console.error('[PUSH] Erro ao notificar fim de desafio:', e);
  }
}
