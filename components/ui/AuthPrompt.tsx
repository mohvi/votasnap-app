import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  action?: 'votar' | 'participar' | 'default';
}

export default function AuthPrompt({ visible, onClose, action = 'default' }: Props) {
  const messages = {
    votar: {
      emoji: '🗳️',
      title: 'Vota nos teus favoritos!',
      sub: 'Cria uma conta gratuita para votar e ajudar alguém a ganhar o prémio.',
    },
    participar: {
      emoji: '🏆',
      title: 'Participa nos desafios!',
      sub: 'Cria uma conta gratuita para participar e ganhar prémios reais.',
    },
    default: {
      emoji: '👋',
      title: 'Junta-te ao VotaSnap!',
      sub: 'Cria uma conta gratuita para interagir com a comunidade.',
    },
  };

  const msg = messages[action];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.sheet}
          activeOpacity={1}
        >
          {/* Handle */}
          <View style={styles.handle} />

          <Text style={styles.emoji}>{msg.emoji}</Text>
          <Text style={styles.title}>{msg.title}</Text>
          <Text style={styles.sub}>{msg.sub}</Text>

          {/* Registar */}
          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push('/auth/login');
            }}
            activeOpacity={0.85}
            style={styles.registerWrap}
          >
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.registerBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.registerText}>Criar conta gratuita</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Login */}
          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push('/auth/login');
            }}
            style={styles.loginBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.loginText}>Já tenho conta — Entrar</Text>
          </TouchableOpacity>

          {/* Continuar sem conta */}
          <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
            <Text style={styles.skipText}>Continuar sem conta</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 0.5,
    borderColor: '#222',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 8,
  },
  emoji: { fontSize: 52 },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  registerWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  registerBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  registerText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderWidth: 0.5,
    borderColor: '#333',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    color: '#555',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});