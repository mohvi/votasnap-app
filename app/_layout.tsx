import { Inter_400Regular, Inter_500Medium, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { router, Stack } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';
import { BlockedUsersProvider } from '../hooks/BlockedUsersProvider';
import {
  registerForPushNotifications,
  savePushToken,
} from '../services/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });


  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Registar push token quando utilizador faz login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        try {
          const token = await registerForPushNotifications();
          if (token) await savePushToken(token);
        } catch (e) {
          console.log('[PUSH] Não disponível:', e);
        }
      }
    });
    return () => unsub();
  }, []);

  // Listeners de notificação — só se o módulo estiver disponível
useEffect(() => {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  let notifListener: any;
  let responseList: any;

  try {
    const Notifications = require('expo-notifications');

    // Verifica se o módulo nativo está disponível
    if (!Notifications?.setNotificationHandler) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    notifListener = Notifications.addNotificationReceivedListener(
      (notification: any) => {
        console.log('[PUSH] Recebida:', notification);
      }
    );

    responseList = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response.notification.request.content.data;
        if (data?.challengeId) {
          router.push(`/challenge/${data.challengeId}`);
        }
      }
    );
  } catch {
    // Expo Go — ignora silenciosamente
  }

  return () => {
    try {
      notifListener?.remove();
      responseList?.remove();
    } catch {}
  };
}, []);


  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
    <BlockedUsersProvider>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0D0D0D' }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/setup-profile" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenge/[id]" />
        <Stack.Screen name="challenge/submit" />
        <Stack.Screen name="challenge/vote" />
        <Stack.Screen name="entry/[challengeId]/[entryId]" />
      </Stack>
    </GestureHandlerRootView>
    </BlockedUsersProvider>
    </SafeAreaProvider>
  );
}
