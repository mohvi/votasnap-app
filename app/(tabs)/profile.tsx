import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { get, onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useSnaps } from '../../hooks/useSnaps';
import { auth, db } from '../../services/firebase';

interface UserProfile {
  uid: string;
  name: string;
  username: string;
  bio: string;
  avatar: string | null;
  phone: string;
  createdAt: number;
}

interface UserEntry {
  id: string;
  challengeId: string;
  challengeTitle: string;
  challengePrize: string;
  mediaUrl: string;
  caption: string;
  votes: number;
  createdAt: number;
  isWinner?: boolean;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [totalVotesGiven, setTotalVotesGiven] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isLoggedIn } = useAuth();
  const uid = auth.currentUser?.uid;

  const { snaps } = useSnaps();



  // Carregar perfil
  useEffect(() => {
    if (!uid) return;
    const unsub = onValue(ref(db, `users/${uid}`), snap => {
      if (snap.exists()) setProfile(snap.val());
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  // Carregar entradas do utilizador
  useEffect(() => {
    if (!uid) return;
    const loadEntries = async () => {
      const challengesSnap = await get(ref(db, 'challenges'));
      if (!challengesSnap.exists()) return;
      const challenges = challengesSnap.val();
      const userEntries: UserEntry[] = [];

      await Promise.all(
        Object.entries(challenges).map(async ([challengeId, challenge]: [string, any]) => {
          const entriesSnap = await get(ref(db, `entries/${challengeId}`));
          if (!entriesSnap.exists()) return;
          Object.entries(entriesSnap.val()).forEach(([entryId, entry]: [string, any]) => {
            if (entry.userId !== uid) return;
            userEntries.push({
              id: entryId,
              challengeId,
              challengeTitle: challenge.title,
              challengePrize: challenge.prize,
              mediaUrl: entry.mediaUrl,
              caption: entry.caption,
              votes: entry.votes || 0,
              createdAt: entry.createdAt,
            });
          });
        })
      );

      userEntries.sort((a, b) => b.votes - a.votes);
      setEntries(userEntries);
    };
    loadEntries();
  }, [uid]);

  // Contar votos dados
  useEffect(() => {
    if (!uid) return;
    const loadVotes = async () => {
      const challengesSnap = await get(ref(db, 'challenges'));
      if (!challengesSnap.exists()) return;
      let count = 0;
      await Promise.all(
        Object.keys(challengesSnap.val()).map(async challengeId => {
          const voteSnap = await get(ref(db, `votes/${challengeId}/${uid}`));
          if (voteSnap.exists()) count++;
        })
      );
      setTotalVotesGiven(count);
    };
    loadVotes();
  }, [uid]);

  const handleLogout = () => {
    Alert.alert(
      'Terminar sessão',
      'Tens a certeza que queres sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const totalVotesReceived = entries.reduce((sum, e) => sum + e.votes, 0);

if (!isLoggedIn) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>👤</Text>
        <Text style={styles.emptyTitle}>A tua conta</Text>
        <Text style={styles.emptySub}>
          Entra ou cria uma conta para ver o teu perfil,{'\n'}
          histórico de desafios e prémios ganhos.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
          style={styles.loginWrap}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#ff286a', '#ff8c5a']}
            style={styles.loginBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.loginBtnText}>Entrar ou criar conta</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff286a" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Perfil não encontrado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
     {/* Header */}
<View style={styles.header}>
  <Text style={styles.headerTitle}>Perfil</Text>
  <View style={styles.headerActions}>
    <View style={styles.snapsBadge}>
      <Text style={styles.snapsIcon}>🪙</Text>
      <Text style={styles.snapsText}>{snaps}</Text>
    </View>
    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
      <Text style={styles.logoutText}>Sair</Text>
    </TouchableOpacity>
  </View>
</View>
        {/* Avatar + info */}
        <View style={styles.profileTop}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.avatarPlaceholder}
            >
              <Text style={styles.avatarText}>
                {profile.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </LinearGradient>
          )}
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/auth/setup-profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.editBtnText}>✏️ Editar perfil</Text>
          </TouchableOpacity>
        
        </View>
        {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
        <Text style={styles.statNum}>{snaps}</Text>
        <Text style={styles.statLabel}>Snaps</Text>
      </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{entries.length}</Text>
            <Text style={styles.statLabel}>Desafios</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{totalVotesReceived}</Text>
            <Text style={styles.statLabel}>Votos recebidos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{totalVotesGiven}</Text>
            <Text style={styles.statLabel}>Votos dados</Text>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badgesRow}>
            {entries.length >= 1 && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>🎯</Text>
                <Text style={styles.badgeLabel}>Participante</Text>
              </View>
            )}
            {totalVotesReceived >= 10 && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>⭐</Text>
                <Text style={styles.badgeLabel}>Popular</Text>
              </View>
            )}
            {totalVotesReceived >= 100 && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>🔥</Text>
                <Text style={styles.badgeLabel}>Em chamas</Text>
              </View>
            )}
            {totalVotesGiven >= 10 && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>🗳️</Text>
                <Text style={styles.badgeLabel}>Votante activo</Text>
              </View>
            )}
            {entries.length === 0 && totalVotesGiven === 0 && (
              <Text style={styles.noBadges}>
                Participa em desafios para ganhar badges!
              </Text>
            )}
          </View>
        </View>

        {/* Entradas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            As minhas entradas ({entries.length})
          </Text>

          {entries.length === 0 ? (
            <View style={styles.emptyEntries}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyText}>
                Ainda não participaste em nenhum desafio
              </Text>
            </View>
          ) : (
            entries.map((entry, i) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.entryCard}
                onPress={() => router.push(`/challenge/${entry.challengeId}`)}
                activeOpacity={0.8}
              >
                {/* Miniatura */}
                <Image
                  source={{ uri: entry.mediaUrl }}
                  style={styles.entryThumb}
                  resizeMode="cover"
                />

                {/* Info */}
                <View style={styles.entryInfo}>
                  <Text style={styles.entryChallenge} numberOfLines={1}>
                    {entry.challengeTitle}
                  </Text>
                  <Text style={styles.entryCaption} numberOfLines={1}>
                    {entry.caption}
                  </Text>
                  <View style={styles.entryMeta}>
                    <Text style={styles.entryVotes}>🗳️ {entry.votes} votos</Text>
                    {i === 0 && entries.length > 1 && (
                      <View style={styles.topBadge}>
                        <Text style={styles.topBadgeText}>🥇 Melhor entrada</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.entryArrow}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', fontSize: 16, fontFamily: 'Inter_500Medium' },
  scroll: { paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
snapsBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  backgroundColor: 'rgba(255,215,0,0.12)',
  borderWidth: 0.5,
  borderColor: 'rgba(255,215,0,0.35)',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 20,
},
snapsIcon: { fontSize: 13 },
snapsText: { color: '#FFD700', fontSize: 13, fontFamily: 'Inter_700Bold' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  logoutBtn: {
    backgroundColor: '#e41e1e',
    borderWidth: 0.5,
    borderColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  logoutText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_400Regular' },

  profileTop: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#ff286a',
    marginBottom: 4,
  },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { color: '#fff', fontSize: 36, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff' },
  username: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#888' },
  bio: {
    fontSize: 14, fontFamily: 'Inter_400Regular', color: '#aaa',
    textAlign: 'center', lineHeight: 20, paddingHorizontal: 32,
  },
  editBtn: {
    marginTop: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 0.5,
    borderColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#1a1a1a',
    marginBottom: 8,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNum: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#555', marginTop: 2 },
  statDivider: { width: 0.5, backgroundColor: '#1a1a1a', marginVertical: 12 },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: {
    fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 12,
  },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  badge: {
    backgroundColor: '#111',
    borderWidth: 0.5,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  badgeEmoji: { fontSize: 22 },
  badgeLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#888' },
  noBadges: { color: '#555', fontSize: 13, fontFamily: 'Inter_400Regular' },

  emptyEntries: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: {
    color: '#555', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center',
  },
  exploreWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  exploreBtn: { paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  exploreBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#1a1a1a',
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  entryThumb: {
    width: 60, height: 60, borderRadius: 10, backgroundColor: '#1a1a1a',
  },
  entryInfo: { flex: 1, gap: 4 },
  entryChallenge: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  entryCaption: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#666' },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryVotes: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#ff286a' },
  topBadge: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 0.5,
    borderColor: '#FFD700',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFD700' },
  entryArrow: { color: '#555', fontSize: 20 },
  emptyTitle: {
  color: '#fff', fontSize: 20,
  fontFamily: 'Inter_700Bold', textAlign: 'center',
},
emptySub: {
  color: '#888', fontSize: 14,
  fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22,
},
loginWrap: { borderRadius: 14, overflow: 'hidden', width: '85%', marginTop: 8 },
loginBtn: { paddingVertical: 16, alignItems: 'center' },
loginBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});