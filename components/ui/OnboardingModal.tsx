import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, fontSize, gradients, radius, spacing } from '../../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  hasActiveChallenge?: boolean;
}

type IconName = keyof typeof Ionicons.glyphMap;

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'camera-outline',
    title: 'Participa em desafios',
    text: 'Publica a tua foto ou vídeo no tema do desafio. Participar é sempre grátis.',
  },
  {
    icon: 'heart-outline',
    title: 'Vota no feed',
    text: 'Toca no coração ou dá dois toques na publicação. Tens um voto por desafio.',
  },
  {
    icon: 'trophy-outline',
    title: 'Ganha prémios',
    text: 'A publicação com mais votos ganha o prémio oferecido pela marca do desafio.',
  },
];

export default function OnboardingModal({ visible, onClose, hasActiveChallenge }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient colors={gradients.primary} style={styles.logoBox}>
            <Ionicons name="trophy" size={28} color={colors.text} />
          </LinearGradient>

          <Text style={styles.title}>Bem-vindo ao VotaSnap</Text>
          <Text style={styles.subtitle}>
            Participa em desafios, vota na comunidade e ganha prémios reais.
          </Text>

          <View style={styles.steps}>
            {STEPS.map(step => (
              <View key={step.title} style={styles.step}>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={step.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {hasActiveChallenge && (
            <View style={styles.tip}>
              <Ionicons name="flame" size={16} color={colors.warning} />
              <Text style={styles.tipText}>Há um desafio a decorrer agora.</Text>
            </View>
          )}

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.btnWrap} accessibilityRole="button">
            <LinearGradient colors={gradients.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.btnText}>Começar</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 24,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    borderWidth: 0.5,
    borderColor: colors.surfaceRaised,
    alignItems: 'center',
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.sm },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  steps: { width: '100%', gap: 18, marginBottom: spacing.xl },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepText: { flex: 1, gap: 3 },
  stepTitle: { color: colors.text, fontSize: fontSize.md, fontFamily: fonts.bold },
  stepDesc: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, lineHeight: 18 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  tipText: { color: colors.warning, fontSize: 13, fontFamily: fonts.semibold },
  btnWrap: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  btn: { paddingVertical: spacing.lg, alignItems: 'center' },
  btnText: { color: colors.text, fontSize: 15, fontFamily: fonts.bold },
});
