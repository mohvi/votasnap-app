import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../constants/theme';
import { claimInviteAttribution, savePendingInvite } from '../../services/invites';

// Aberto por votasnap.vercel.app/invite/{username} ou votasnap://invite/{username}:
// guarda o código e segue para o feed. A atribuição acontece quando a conta
// e o perfil existirem (agora, se já existirem).
export default function InviteLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    (async () => {
      if (code) {
        await savePendingInvite(String(code), 'link');
        await claimInviteAttribution();
      }
      router.replace('/(tabs)');
    })();
  }, [code]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
