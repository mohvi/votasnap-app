import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { get, ref, set, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoPlayer } from '../../../components/feed/FeedCard';
import { auth, db } from '../../../services/firebase';

interface Entry {
  userId: string;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption: string;
  votes: number;
}

interface Challenge {
  title: string;
  prize: string;
  prizeType: string;
  status: string;
  endsAt: number;
}

interface User {
  name: string;
  avatar: string | null;
}

export default function EntryDeepLinkScreen() {
  const { challengeId, entryId } = useLocalSearchParams<{
    challengeId: string;
    entryId: string;
  }>();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const uid = auth.currentUser?.uid;
  const isLoggedIn = !!uid;
  const isEnded = challenge ? challenge.endsAt < Date.now() || challenge.status !== 'active' : false;

  useEffect(() => {
    const load = async () => {
      try {
        // Carregar entrada
        const entrySnap = await get(ref(db, `entries/${challengeId}/${entryId}`));
        if (!entrySnap.exists()) { setLoading(false); return; }
        const entryData = entrySnap.val();
        setEntry(entryData);

        // Carregar desafio
        const challengeSnap = await get(ref(db, `challenges/${challengeId}`));
        if (challengeSnap.exists()) setChallenge(challengeSnap.val());

        // Carregar utilizador
        const userSnap = await get(ref(db, `users/${entryData.userId}`));
        if (userSnap.exists()) setUser(userSnap.val());

        // Verificar se já votou
        if (uid) {
          const voteSnap = await get(ref(db, `votes/${challengeId}/${uid}`));
          setHasVoted(voteSnap.exists());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [challengeId, entryId, uid]);

  const handleVote = async () => {
    if (!isLoggedIn) {
      Alert.alert(
        'Precisas de uma conta',
        'Para votar precisas de te registar no VotaSnap.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Registar', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    if (hasVoted) { Alert.alert('Já votaste', 'Já votaste neste desafio!'); return; }
    if (isEnded) { Alert.alert('Desafio encerrado', 'Este desafio já terminou.'); return; }
    if (entry?.userId === uid) { Alert.alert('Atenção', 'Não podes votar na tua própria entrada.'); return; }

    setVoting(true);
    try {
      await set(ref(db, `votes/${challengeId}/${uid}`), {
        entryId,
        votedAt: Date.now(),
      });
      const entrySnap = await get(ref(db, `entries/${challengeId}/${entryId}`));
      const currentVotes = entrySnap.val()?.votes || 0;
      await update(ref(db, `entries/${challengeId}/${entryId}`), {
        votes: currentVotes + 1,
      });
      const challengeSnap = await get(ref(db, `challenges/${challengeId}`));
      const currentTotal = challengeSnap.val()?.totalVotes || 0;
      await update(ref(db, `challenges/${challengeId}`), {
        totalVotes: currentTotal + 1,
      });
      setHasVoted(true);
      setEntry(prev => prev ? { ...prev, votes: prev.votes + 1 } : prev);
      Alert.alert('Votado! 🗳️', `Votaste em ${user?.name}!`);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff286a" size="large" />
      </View>
    );
  }

  if (!entry || !challenge) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorTitle}>Post não encontrado</Text>
        <Text style={styles.errorSub}>Este link pode ter expirado.</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          style={styles.homeWrap}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#ff286a', '#ff8c5a']}
            style={styles.homeBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.homeBtnText}>Ir para o VotaSnap</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {challenge.title}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Media */}
      <View style={styles.mediaWrap}>
         {entry.mediaType === 'video' ? (
                <VideoPlayer uri={entry.mediaUrl} />
              ) : (
                <Image
                  source={{ uri: entry.mediaUrl }}
                  style={styles.media}
                  resizeMode="contain"
                />
              )}
      </View>

      {/* Info */}
      <View style={styles.info}>

        {/* Desafio badge */}
        <LinearGradient
          colors={['#ff286a', '#ff8c5a']}
          style={styles.challengeBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.challengeTitle} numberOfLines={1}>
            🏆 {challenge.title}
          </Text>
          <Text style={styles.challengePrize}>
            {challenge.prizeType === 'cash' ? '💰' : '🎁'} {challenge.prize}
          </Text>
        </LinearGradient>

        {/* Utilizador */}
        <View style={styles.userRow}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.votes}>{entry.votes} votos</Text>
          </View>
        </View>

        {/* Caption */}
        <Text style={styles.caption}>{entry.caption}</Text>

        {/* Botão votar */}
        {isEnded ? (
          <View style={styles.endedBox}>
            <Text style={styles.endedText}>⏱ Este desafio já terminou</Text>
          </View>
        ) : hasVoted ? (
          <View style={styles.votedBox}>
            <Text style={styles.votedText}>✓ Já votaste neste desafio</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleVote}
            disabled={voting}
            activeOpacity={0.85}
            style={styles.voteBtnWrap}
          >
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.voteBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {voting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.voteBtnText}>
                    {isLoggedIn ? '🗳️ Votar neste post' : '🗳️ Entra para votar'}
                  </Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Ver desafio completo */}
        <TouchableOpacity
          onPress={() => router.push(`/challenge/${challengeId}`)}
          style={styles.seeAllBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.seeAllText}>
            Ver todos os participantes →
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: 32,
  },
  errorEmoji: { fontSize: 56 },
  errorTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  errorSub: { color: '#888', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  homeWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 8, width: '80%' },
  homeBtn: { paddingVertical: 14, alignItems: 'center' },
  homeBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },

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
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold',
  },

  mediaWrap: {
    height: 320,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: { width: '100%', height: '100%' },

  info: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  challengeBadge: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  challengeTitle: {
    color: '#fff', fontSize: 13,
    fontFamily: 'Inter_700Bold', flex: 1,
  },
  challengePrize: {
    color: '#FFD700', fontSize: 12,
    fontFamily: 'Inter_700Bold', marginLeft: 8,
  },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#ff286a' },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ff286a',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  userInfo: { gap: 2 },
  userName: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  votes: { color: '#888', fontSize: 12, fontFamily: 'Inter_400Regular' },
  caption: {
    color: '#aaa', fontSize: 14,
    fontFamily: 'Inter_400Regular', lineHeight: 20,
  },

  endedBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  endedText: { color: '#555', fontSize: 14, fontFamily: 'Inter_500Medium' },
  votedBox: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 0.5, borderColor: '#22c55e',
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  votedText: { color: '#22c55e', fontSize: 14, fontFamily: 'Inter_500Medium' },
  voteBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  voteBtn: { paddingVertical: 16, alignItems: 'center' },
  voteBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  seeAllBtn: {
    alignItems: 'center', paddingVertical: 8,
  },
  seeAllText: {
    color: '#ff286a', fontSize: 14, fontFamily: 'Inter_500Medium',
  },
});