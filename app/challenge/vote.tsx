import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { submitVote } from '../../services/voting';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../services/firebase';

export default function VoteScreen() {
  const { challengeId, entryId, userName } = useLocalSearchParams<{
    challengeId: string;
    entryId: string;
    userName: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState(false);
  const uid = auth.currentUser?.uid;

  const handleVote = async () => {
    if (!uid) { Alert.alert('Erro', 'Sessão expirada'); return; }
    setLoading(true);
    try {
      await submitVote(challengeId, entryId);

      // 5. Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setVoted(true);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Ecrã de sucesso após votar
  if (voted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrap}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Voto registado!</Text>
          <Text style={styles.successSub}>
            Votaste em <Text style={styles.successName}>{userName}</Text>.{'\n'}
            Partilha com os teus amigos para eles votarem também!
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtnWrap}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.backBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.backBtnText}>Voltar ao desafio</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Votar</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>

        {/* Card do participante */}
        <View style={styles.card}>
          <LinearGradient
            colors={['#1a1a1a', '#0a0a0a']}
            style={styles.cardBanner}
          >
            <Text style={styles.cardEmoji}>🎯</Text>
          </LinearGradient>
          <View style={styles.cardBody}>
            <Text style={styles.cardQuestion}>
              Queres votar na entrada de
            </Text>
            <Text style={styles.cardName}>{userName}</Text>
            <Text style={styles.cardWarning}>
              ⚠️ Só podes votar uma vez neste desafio
            </Text>
          </View>
        </View>

        {/* Botões */}
        <View style={styles.btnRow}>

          {/* Cancelar */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>

          {/* Confirmar voto */}
          <TouchableOpacity
            style={styles.voteWrap}
            onPress={handleVote}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.voteBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.voteBtnText}>Confirmar voto 🗳️</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 22 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  body: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 24,
  },

  card: {
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#222',
    overflow: 'hidden',
  },
  cardBanner: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: { fontSize: 64 },
  cardBody: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  cardQuestion: {
    color: '#888',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  cardName: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  cardWarning: {
    color: '#555',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },

  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 0.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  voteWrap: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  voteBtn: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },

  // Sucesso
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  successEmoji: { fontSize: 72, marginBottom: 8 },
  successTitle: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  successSub: {
    color: '#888',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  successName: {
    color: '#ff286a',
    fontFamily: 'Inter_700Bold',
  },
  backBtnWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  backBtnGrad: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
});