import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/theme';
import { useDemographics } from '../../hooks/DemographicsProvider';

// Faixa "18+" com o aviso legal para desafios de bebidas alcoólicas.
export function AgeBadge({ minAge, alcohol, style }: { minAge: number; alcohol?: boolean; style?: any }) {
  if (!minAge) return null;
  return (
    <View style={[styles.badgeRow, style]}>
      <View style={styles.badge}><Text style={styles.badgeText}>{minAge}+</Text></View>
      {alcohol && (
        <Text style={styles.notice} numberOfLines={2}>
          Proibido a menores de 18 anos. Beba com moderação.
        </Text>
      )}
    </View>
  );
}

// Ecrã para quem abre um desafio com idade mínima sem a ter (ou sem a ter indicado).
export function AgeLockedScreen({ minAge }: { minAge: number }) {
  const { loggedIn, birthDate } = useDemographics();
  const needsDate = loggedIn && !birthDate;
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.back} accessibilityLabel="Voltar">
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.center}>
        <View style={styles.icon}><Text style={styles.iconText}>{minAge}+</Text></View>
        <Text style={styles.title}>Desafio para maiores de {minAge}</Text>
        <Text style={styles.text}>
          {!loggedIn
            ? 'Entra na tua conta e indica a tua data de nascimento para ver este desafio.'
            : needsDate
              ? 'Indica a tua data de nascimento para ver este desafio.'
              : 'Este desafio não está disponível para a tua idade.'}
        </Text>
        {(!loggedIn || needsDate) && (
          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            onPress={() => router.push(loggedIn ? { pathname: '/about-you', params: { reason: 'age' } } : '/auth/login')}
          >
            <Text style={styles.btnText}>{loggedIn ? 'Indicar data de nascimento' : 'Entrar'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: colors.danger, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: colors.text, fontSize: 11, fontFamily: fonts.bold },
  notice: { flex: 1, color: colors.textSecondary, fontSize: 11, fontFamily: fonts.medium },
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  icon: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  iconText: { color: colors.danger, fontSize: 24, fontFamily: fonts.bold },
  title: { color: colors.text, fontSize: 20, fontFamily: fonts.bold, textAlign: 'center' },
  text: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 21 },
  btn: { marginTop: 8, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  btnText: { color: colors.text, fontSize: 14, fontFamily: fonts.bold },
});
