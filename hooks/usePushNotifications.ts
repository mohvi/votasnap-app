import { router } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { notificationRoute, registerForPushNotifications, savePushToken } from '../services/notifications';

// Usado no layout das tabs: só corre quando o utilizador já tem sessão e
// perfil, por isso a permissão não é pedida no meio do registo.
//  - regista/actualiza o token push do utilizador;
//  - abre o ecrã indicado pela notificação tocada, incluindo a que abriu a
//    app a partir de fechada (getLastNotificationResponse).
export function usePushNotifications() {
  useEffect(() => {
    if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

    registerForPushNotifications()
      .then(token => (token ? savePushToken(token) : undefined))
      .catch(e => console.log('[PUSH] Não disponível:', e));

    let Notifications: typeof import('expo-notifications');
    try {
      Notifications = require('expo-notifications');
    } catch {
      return;
    }
    if (!Notifications?.addNotificationResponseReceivedListener) return;

    let lastHandled: string | null = null;
    const open = (response: import('expo-notifications').NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (id === lastHandled) return;
      lastHandled = id;
      const route = notificationRoute(response.notification.request.content.data as Record<string, unknown>);
      if (route) router.push(route as never);
      Notifications.clearLastNotificationResponse();
    };

    try {
      open(Notifications.getLastNotificationResponse());
    } catch {}
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
