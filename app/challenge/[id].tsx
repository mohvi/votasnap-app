import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { get, onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthPrompt from '../../components/ui/AuthPrompt';
import { useAuth } from '../../hooks/useAuth';
import { Challenge } from '../../hooks/useChallenges';
import { useBlockedUsers } from '../../hooks/BlockedUsersProvider';
import { auth, db } from '../../services/firebase';
import { colors, gradients } from '../../constants/theme';

interface Entry {
  id: string;
  userId: string;
  mediaUrl: string;
  caption: string;
  votes: number;
  createdAt: number;
  userName?: string;
  userAvatar?: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  fotografia: '📸', musica: '🎵', danca: '💃',
  culinaria: '🍲', moda: '👗', desporto: '⚽',
  arte: '🎨', humor: '😂',
};

const TYPE_COLORS: Record<string, readonly [string, string]> = {
  sponsored: gradients.primary,
  paid: gradients.paid,
  free: gradients.free,
};

function TimeLeft({ endsAt }: { endsAt: number }) {
  const diff = endsAt - Date.now();
  if (diff <= 0) return <Text style={styles.timeOver}>Encerrado</Text>;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return <Text style={styles.timeLeft}>⏱ {days} dias restantes</Text>;
  return <Text style={styles.timeLeft}>⏱ {hours}h restantes</Text>;
}

export default function ChallengeDetailScreen() {
  const { blocked } = useBlockedUsers();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const uid = auth.currentUser?.uid;
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    const unsub = onValue(ref(db, `challenges/${id}`), snap => {
      if (snap.exists()) setChallenge({ id, ...snap.val() });
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsub = onValue(ref(db, `entries/${id}`), async snap => {
      if (!snap.exists()) { setEntries([]); return; }
      const raw = snap.val();
      const list: Entry[] = await Promise.all(
        Object.entries(raw).map(async ([entryId, val]: [string, any]) => {
          const userSnap = await get(ref(db, `publicProfiles/${val.userId}`));
          const user = userSnap.val();
          return {
            id: entryId,
            ...val,
            userName: user?.username || 'Utilizador',
            userAvatar: user?.avatar || null,
          };
        })
      );
      list.sort((a, b) => (b.votes || 0) - (a.votes || 0));
      setEntries(list);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!uid) return;
    get(ref(db, `votes/${id}/${uid}`)).then(snap => setHasVoted(snap.exists()));
    get(ref(db, `entries/${id}`)).then(snap => {
      if (!snap.exists()) return;
      const vals: any[] = Object.values(snap.val());
      setHasEntered(vals.some(e => e.userId === uid));
    });
  }, [id, uid]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Desafio não encontrado</Text>
      </View>
    );
  }

  const gradientColors = TYPE_COLORS[challenge.type] || TYPE_COLORS.free;
  const emoji = CATEGORY_EMOJI[challenge.category] || '🏆';
  const isEnded = challenge.endsAt < Date.now() || challenge.status !== 'active';
  const hasCoverImage = !!challenge.coverImage;

  // Patrocinador — verifica type e presença do nome, igual ao ChallengeCard
  const isSponsored = challenge.type === 'sponsored' && !!challenge.sponsor;

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {challenge.title}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Banner — agora com cover image quando disponível, igual ao ChallengeCard */}
        {hasCoverImage ? (
          <View style={styles.banner}>
            <Image
              source={{ uri: challenge.coverImage }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            {/* Escurece levemente a imagem para os badges ficarem legíveis */}
            <View style={styles.bannerOverlay} />

            {/* Badges em cima — patrocinador + tipo */}
            <View style={styles.badges}>
              {isSponsored && (
                <View style={styles.sponsorBadge}>
                  <Text style={styles.sponsorText}>📢 {challenge.sponsor}</Text>
                </View>
              )}
              <LinearGradient
                colors={gradientColors}
                style={styles.typeBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.typeText}>
                  {challenge.type === 'sponsored' ? 'Patrocinado'
                    : challenge.type === 'paid' ? 'Pago'
                    : 'Gratuito'}
                </Text>
              </LinearGradient>
            </View>

            {/* Prémio em baixo à direita */}
            <View style={styles.prizeBadge}>
              <Text style={styles.prizeText}>
                {challenge.prizeType === 'cash' ? '💰'
                  : challenge.prizeType === 'physical' ? '🎁' : '🏅'
                }{' '}{challenge.prize}
              </Text>
            </View>
          </View>
        ) : (
          <LinearGradient colors={[colors.surface, colors.background]} style={styles.banner}>
            <Text style={styles.bannerEmoji}>{emoji}</Text>

            <View style={styles.badges}>
              {isSponsored && (
                <View style={styles.sponsorBadge}>
                  <Text style={styles.sponsorText}>📢 {challenge.sponsor}</Text>
                </View>
              )}
              <LinearGradient
                colors={gradientColors}
                style={styles.typeBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.typeText}>
                  {challenge.type === 'sponsored' ? 'Patrocinado'
                    : challenge.type === 'paid' ? 'Pago'
                    : 'Gratuito'}
                </Text>
              </LinearGradient>
            </View>

            <View style={styles.prizeBadge}>
              <Text style={styles.prizeText}>
                {challenge.prizeType === 'cash' ? '💰'
                  : challenge.prizeType === 'physical' ? '🎁' : '🏅'
                }{' '}{challenge.prize}
              </Text>
            </View>
          </LinearGradient>
        )}

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title}>{challenge.title}</Text>
          <Text style={styles.description}>{challenge.description}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{challenge.totalParticipants}</Text>
              <Text style={styles.statLabel}>Participantes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{challenge.totalVotes}</Text>
              <Text style={styles.statLabel}>Votos totais</Text>
            </View>
            <View style={styles.statBox}>
              <TimeLeft endsAt={challenge.endsAt} />
              <Text style={styles.statLabel}>Prazo</Text>
            </View>
          </View>

          {/* Acções */}
          {!isEnded && (
            <View style={styles.actions}>
              {!hasEntered ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.btnWrap}
                  onPress={() => {
                    if (!isLoggedIn) {
                      setShowAuthPrompt(true);
                      return;
                    }
                    router.push({
                      pathname: '/challenge/submit',
                      params: { id: challenge.id, title: challenge.title },
                    });
                  }}
                >
                  <LinearGradient
                    colors={gradientColors}
                    style={styles.btn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.btnText}>Participar neste desafio</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.enteredBadge}>
                  <Text style={styles.enteredText}>✓ Já participas neste desafio</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Participantes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Participantes ({entries.length})
          </Text>

          {entries.length === 0 ? (
            <View style={styles.emptyEntries}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyText}>
                Ainda não há participantes. Sê o primeiro!
              </Text>
            </View>
          ) : (
            entries.filter(entry => !blocked.includes(entry.userId)).map((entry, index) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={[
                  styles.rank,
                  index === 0 && styles.rank1,
                  index === 1 && styles.rank2,
                  index === 2 && styles.rank3,
                ]}>
                  <Text style={styles.rankText}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </Text>
                </View>

                {entry.userAvatar ? (
                  <Image source={{ uri: entry.userAvatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {entry.userName?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}

                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>{entry.userName}</Text>
                  <Text style={styles.entryCaption} numberOfLines={1}>
                    {entry.caption}
                  </Text>
                  <View style={styles.voteBarWrap}>
                    <View style={styles.voteBar}>
                      <LinearGradient
                        colors={gradientColors}
                        style={[
                          styles.voteBarFill,
                          {
                            width: challenge.totalVotes > 0
                              ? `${Math.round((entry.votes / challenge.totalVotes) * 100)}%`
                              : '0%' as any,
                          },
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                    </View>
                    <Text style={styles.voteCount}>{entry.votes || 0} votos</Text>
                  </View>
                </View>

                {!hasVoted && !isEnded && entry.userId !== uid && (
                  <TouchableOpacity
                    style={styles.voteBtn}
                    activeOpacity={0.8}
                    onPress={() => router.push({
                      pathname: '/challenge/vote',
                      params: {
                        challengeId: challenge.id,
                        entryId: entry.id,
                        userName: entry.userName,
                      },
                    })}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      style={styles.voteBtnGrad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.voteBtnText}>Votar</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {hasVoted && (
                  <View style={styles.votedBadge}>
                    <Text style={styles.votedText}>✓</Text>
                  </View>
                )}
              </View>
            ))
          )}

          <AuthPrompt
            visible={showAuthPrompt}
            onClose={() => setShowAuthPrompt(false)}
            action="participar"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, fontSize: 16, fontFamily: 'Inter_500Medium' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surface,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 22, fontFamily: 'Inter_400Regular' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  scroll: { paddingBottom: 100 },

  // Banner — agora com suporte a imagem de fundo (igual ao ChallengeCard)
  banner: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  bannerEmoji: { fontSize: 64 },

  // Badges cantos — igual ao ChallengeCard
  badges: {
    position: 'absolute',
    top: 12,
    left: 12,
    gap: 6,
  },
  sponsorBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sponsorText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_400Regular' },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  prizeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  prizeText: { color: colors.gold, fontSize: 13, fontFamily: 'Inter_700Bold' },

  info: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff', lineHeight: 28 },
  description: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textMuted, lineHeight: 20 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRightWidth: 0.5, borderRightColor: colors.surfaceRaised,
  },
  statNum: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.textSubtle, marginTop: 2 },
  timeLeft: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary },
  timeOver: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.danger },

  actions: { gap: 10 },
  btnWrap: { borderRadius: 12, overflow: 'hidden' },
  btn: { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  enteredBadge: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 0.5, borderColor: colors.success,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  enteredText: { color: colors.success, fontSize: 14, fontFamily: 'Inter_500Medium' },

  section: { paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 12 },

  emptyEntries: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: colors.textSubtle, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.surfaceRaised,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  rank: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  rank1: { backgroundColor: 'rgba(255,215,0,0.15)' },
  rank2: { backgroundColor: 'rgba(192,192,192,0.15)' },
  rank3: { backgroundColor: 'rgba(205,127,50,0.15)' },
  rankText: { fontSize: 16 },

  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  entryInfo: { flex: 1, gap: 3 },
  entryName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  entryCaption: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSubtle },
  voteBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  voteBar: {
    flex: 1, height: 4, backgroundColor: colors.surfaceRaised,
    borderRadius: 2, overflow: 'hidden',
  },
  voteBarFill: { height: '100%', borderRadius: 2 },
  voteCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textSubtle, minWidth: 50 },

  voteBtn: { borderRadius: 8, overflow: 'hidden' },
  voteBtnGrad: { paddingHorizontal: 14, paddingVertical: 8 },
  voteBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },

  votedBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  votedText: { color: colors.success, fontSize: 16 },
});
