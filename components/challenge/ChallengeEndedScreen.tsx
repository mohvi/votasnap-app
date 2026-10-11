import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, fontSize, gradients, radius, spacing } from '../../constants/theme';

// Mostrado quando um link ou notificação aponta para um desafio que já terminou.
// O conteúdo de desafios encerrados não é exibido.
export default function ChallengeEndedScreen() {
  return (
    <SafeAreaView style={styles.center}>
      <Ionicons name="flag" size={56} color={colors.textMuted} />
      <Text style={styles.title}>Este desafio terminou</Text>
      <Text style={styles.sub}>
        As participações deixaram de estar disponíveis. Vê o desafio activo no VotaSnap.
      </Text>
      <TouchableOpacity
        onPress={() => router.replace('/(tabs)')}
        style={styles.btnWrap}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <LinearGradient colors={gradients.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={styles.btnText}>Ir para o VotaSnap</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontFamily: fonts.bold, textAlign: 'center' },
  sub: { color: colors.textMuted, fontSize: fontSize.md, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 22 },
  btnWrap: { width: '80%', borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.sm },
  btn: { paddingVertical: spacing.lg, alignItems: 'center' },
  btnText: { color: colors.text, fontSize: fontSize.lg, fontFamily: fonts.semibold },
});
