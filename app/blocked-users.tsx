import { router } from 'expo-router';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBlockedUsers } from '../hooks/BlockedUsersProvider';
import { colors } from '../constants/theme';
import { toast } from 'sonner-native';

export default function BlockedUsersScreen() {
  const { blocked, unblock } = useBlockedUsers();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
    <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.primary, paddingVertical: 16 }}>Voltar</Text></TouchableOpacity>
    <Text style={{ color: 'white', fontSize: 24 }}>Utilizadores bloqueados</Text>
    <ScrollView>
      {!blocked.length && <Text style={{ color: colors.textSecondary, marginTop: 24 }}>Não tens utilizadores bloqueados.</Text>}
      {blocked.map((uid, index) => <TouchableOpacity key={uid} style={{ paddingVertical: 20 }} onPress={async () => {
        try { await unblock(uid); } catch { toast.error('Não foi possível desbloquear. Tenta novamente.'); }
      }}>
        <Text style={{ color: 'white' }}>Utilizador bloqueado {index + 1}</Text>
        <Text style={{ color: colors.primary, marginTop: 8 }}>Desbloquear</Text>
      </TouchableOpacity>)}
    </ScrollView>
  </SafeAreaView>;
}
