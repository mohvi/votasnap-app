import appCheck from '@react-native-firebase/app-check';

export async function initAppCheck() {
  try {
    const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();

    rnfbProvider.configure({
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
        debugToken: __DEV__ ? 'O_TEU_DEBUG_TOKEN_AQUI' : undefined,
      },
      apple: {
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      },
    });

    await appCheck().initializeAppCheck({
      provider: rnfbProvider,
      isTokenAutoRefreshEnabled: true,
    });

    console.log('[APP CHECK] Inicializado com sucesso');
  } catch (e) {
    console.error('[APP CHECK] Erro ao inicializar:', e);
  }
}