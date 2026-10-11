import { LinearGradient } from 'expo-linear-gradient';
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, gradients } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
  <View style={styles.backdrop}>
    <View style={styles.card}>

      <View style={styles.logoWrap}>
        <LinearGradient
          colors={gradients.primary}
          style={styles.logoBox}
        >
          <Text style={styles.logoEmoji}>🏆</Text>
        </LinearGradient>
      </View>

      <Text style={styles.title}>Bem-vindo ao VotaSnap</Text>

      <Text style={styles.subtitle}>
        Participa em desafios, vota na comunidade e ganha prémios reais.
      </Text>

      <View style={styles.steps}>

        {/* PASSO 1 */}
        <View style={styles.step}>
          <View style={styles.stepIconWrap}>
            <Text style={styles.stepIcon}>🏆</Text>
          </View>

          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Participa em desafios</Text>

            <Text style={styles.stepDesc}>
              Publica a tua foto ou vídeo e concorre a prémios em dinheiro.
            </Text>
          </View>
        </View>

        {/* PASSO 2 */}
        <View style={styles.step}>
          <View style={styles.stepIconWrap}>
            <Text style={styles.stepIcon}>👈👉</Text>
          </View>

          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Vota no Feed</Text>

            <Text style={styles.stepDesc}>
              Desliza para a direita para votar ou para a esquerda para passar.
            </Text>
          </View>
        </View>

        {/* PASSO 3 */}
        <View style={styles.step}>
          <View style={styles.stepIconWrap}>
            <Text style={styles.stepIcon}>🪙</Text>
          </View>

          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Ganha SnapCoins</Text>

            <Text style={styles.stepDesc}>
              Completa missões, vota e participa para ganhar moedas e subir no ranking.
            </Text>
          </View>
        </View>

      </View>

      <Text style={styles.tip}>
        🔥 Existem desafios a decorrer neste momento.
      </Text>

      <TouchableOpacity
        onPress={onClose}
        activeOpacity={0.85}
        style={styles.btnWrap}
      >
        <LinearGradient
          colors={gradients.primary}
          style={styles.btn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.btnText}>
            Começar agora 🚀
          </Text>
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
    padding: 24,
  },
  card: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 0.5,
    borderColor: colors.surfaceRaised,
    alignItems: 'center',
  },
  logoWrap: { marginBottom: 16 },
  logoBox: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 26 },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginBottom: 24,
  },
  steps: { width: '100%', gap: 18, marginBottom: 24 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepIcon: { fontSize: 18 },
  stepText: { flex: 1, gap: 3 },
  stepTitle: {
    color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold',
  },
  stepDesc: {
    color: colors.textMuted, fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18,
  },
  subtitle: {
  color: colors.textSecondary,
  fontSize: 14,
  textAlign: 'center',
  marginBottom: 24,
  lineHeight: 20,
  fontFamily: 'Inter_400Regular',
},

tip: {
  color: colors.warning,
  fontSize: 13,
  textAlign: 'center',
  marginBottom: 18,
  fontFamily: 'Inter_600SemiBold',
},
  btnWrap: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  btn: { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});