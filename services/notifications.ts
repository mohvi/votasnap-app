import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { ref, update } from 'firebase/database';
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

  // O projectId tem de ser o do app.json (extra.eas.projectId): é a ele que a
  // Expo associa as credenciais FCM/APNs usadas no envio.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.log('[PUSH] projectId do EAS em falta');
    return null;
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

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

// As notificações são enviadas pelo painel de administração (função /api/push
// na Vercel), nunca pela app: os tokens dos outros utilizadores não são
// legíveis pelos clientes.

// Ecrã a abrir quando o utilizador toca numa notificação.
export function notificationRoute(data: Record<string, unknown> | undefined): string | null {
  const url = typeof data?.url === 'string' ? data.url : null;
  if (url && /^\/[A-Za-z0-9_\-/()]{0,120}$/.test(url)) return url;
  if (typeof data?.challengeId === 'string') return `/challenge/${data.challengeId}`;
  return null;
}
