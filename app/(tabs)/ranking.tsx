import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { colors, gradients } from '../../constants/theme';
import { isChallengeOpen, useNow } from '../../hooks/useChallenges';
import { useChallengesScope, useEntriesFor, useProfiles } from '../../hooks/useScopedData';

interface RankEntry {
  id: string;
  challengeId: string;
  challengeTitle: string;
  challengePrize: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  mediaUrl: string;
  caption: string;
  votes: number;
}

interface Challenge {
  id: string;
  title: string;
  prize: string;
  prizeType: string;
  totalVotes: number;
  totalParticipants: number;
  endsAt: number;
}

const MEDAL_COLORS: Record<number, string> = { 1: colors.gold, 2: colors.silver, 3: colors.bronze };

function Medal({ place }: { place: 1 | 2 | 3 }) {
  return (
    <View style={[styles.medal, { backgroundColor: MEDAL_COLORS[place] }]}>
      <Text style={styles.medalText}>{place}</Text>
    </View>
  );
}

export default function RankingScreen() {
  const [topEntries, setTopEntries] = useState<RankEntry[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Só desafios activos e as respectivas publicações; perfis pedidos por autor.
  const { challenges: liveChallenges, loaded: challengesLoaded } = useChallengesScope('active');
  const challengeIds = useMemo(() => Object.keys(liveChallenges), [liveChallenges]);
  const { entries: liveEntries, loaded: entriesLoaded } = useEntriesFor(challengeIds);
  const authorIds = useMemo(
    () => Object.values<any>(liveEntries).flatMap(list => Object.values<any>(list || {}).map(e => e?.userId).filter(Boolean)),
    [liveEntries],
  );
  const liveProfiles = useProfiles(authorIds);
  const now = useNow(Object.values<any>(liveChallenges).map(c => c?.endsAt));

  useEffect(() => {
    if (!challengesLoaded || !entriesLoaded) return;
    const active = Object.entries(liveChallenges)
      .filter(([, challenge]) => isChallengeOpen(challenge, now))
      .map(([id, challenge]) => ({ ...challenge, id }));
    setChallenges(active);
    if (selectedChallenge !== 'all' && !active.some(c => c.id === selectedChallenge)) setSelectedChallenge('all');
    const entries: RankEntry[] = [];
    for (const challenge of active) {
      for (const [entryId, entry] of Object.entries<any>(liveEntries[challenge.id] || {})) {
        const user = liveProfiles[entry.userId];
        entries.push({ id: entryId, challengeId: challenge.id, challengeTitle: challenge.title,
          challengePrize: challenge.prize, userId: entry.userId, userName: user?.username || 'Utilizador',
          userAvatar: user?.avatar || null, mediaUrl: entry.mediaUrl, caption: entry.caption, votes: entry.votes || 0 });
      }
    }
    entries.sort((a, b) => b.votes - a.votes);
    setTopEntries(entries);
    setLoading(false);
  }, [liveChallenges, liveEntries, liveProfiles, challengesLoaded, entriesLoaded, selectedChallenge, now]);

  const filtered = selectedChallenge === 'all'
    ? topEntries
    : topEntries.filter(e => e.challengeId === selectedChallenge);

  const getMedalColor = (i: number) => {
    if (i === 0) return [colors.gold, colors.warning];
    if (i === 1) return [colors.silver, colors.textSecondary];
    if (i === 2) return gradients.bronze;
    return [colors.surface, colors.surfaceSunken];
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="trophy" size={20} color={colors.gold} />
        <Text style={styles.headerTitle}>Ranking</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* Top 3 destaque */}
        {filtered.length >= 3 && (
          <View style={styles.podium}>
            {/* 2º lugar */}
            <View style={[styles.podiumItem, styles.podiumSecond]}>
              {filtered[1].userAvatar ? (
                <Image source={{ uri: filtered[1].userAvatar }} style={styles.podiumAvatar} />
              ) : (
                <LinearGradient colors={[colors.silver, colors.textSecondary]} style={styles.podiumAvatar}>
                  <Text style={styles.podiumAvatarText}>
                    {filtered[1].userName.charAt(0)}
                  </Text>
                </LinearGradient>
              )}
              <Medal place={2} />
              <Text style={styles.podiumName} numberOfLines={1}>
                {filtered[1].userName}
              </Text>
              <Text style={styles.podiumVotes}>{filtered[1].votes} votos</Text>
            </View>

            {/* 1º lugar */}
            <View style={[styles.podiumItem, styles.podiumFirst]}>
              <View style={styles.crownWrap}>
                <MaterialCommunityIcons name="crown" size={24} color={colors.gold} />
              </View>
              {filtered[0].userAvatar ? (
                <Image source={{ uri: filtered[0].userAvatar }} style={[styles.podiumAvatar, styles.podiumAvatarFirst]} />
              ) : (
                <LinearGradient colors={gradients.primary} style={[styles.podiumAvatar, styles.podiumAvatarFirst]}>
                  <Text style={[styles.podiumAvatarText, { fontSize: 24 }]}>
                    {filtered[0].userName.charAt(0)}
                  </Text>
                </LinearGradient>
              )}
              <Medal place={1} />
              <Text style={styles.podiumName} numberOfLines={1}>
                {filtered[0].userName}
              </Text>
              <Text style={[styles.podiumVotes, { color: colors.primary }]}>
                {filtered[0].votes} votos
              </Text>
              <LinearGradient
                colors={gradients.primary}
                style={styles.winnerBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}>
                <Ionicons name="gift" size={11} color={colors.text} />
                <Text style={styles.winnerBadgeText} numberOfLines={1}>
                  {filtered[0].challengePrize}
                </Text>
              </LinearGradient>
            </View>
            <View style={[styles.podiumItem, styles.podiumThird]}>
              {filtered[2].userAvatar ? (
                <Image source={{ uri: filtered[2].userAvatar }} style={styles.podiumAvatar} />
              ) : (
                <LinearGradient colors={gradients.bronze} style={styles.podiumAvatar}>
                  <Text style={styles.podiumAvatarText}>
                    {filtered[2].userName.charAt(0)}
                  </Text>
                </LinearGradient>
              )}
              <Medal place={3} />
              <Text style={styles.podiumName} numberOfLines={1}>
                {filtered[2].userName}
              </Text>
              <Text style={styles.podiumVotes}>{filtered[2].votes} votos</Text>
            </View>
          </View>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}>
          <TouchableOpacity
            onPress={() => setSelectedChallenge('all')}
            style={[styles.filter, selectedChallenge === 'all' && styles.filterActive]}>
            <Text style={[styles.filterText, selectedChallenge === 'all' && styles.filterTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {challenges.map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setSelectedChallenge(c.id)}
              style={[styles.filter, selectedChallenge === c.id && styles.filterActive]}>
              <Text style={[styles.filterText, selectedChallenge === c.id && styles.filterTextActive]}
                numberOfLines={1}>
                {c.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista completa */}
        <View style={styles.list}>
          <Text style={styles.listTitle}>Classificação completa</Text>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="podium-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Ainda não há participações</Text>
              <Text style={styles.emptyText}>Quando alguém participar num desafio, a classificação aparece aqui.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/')} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>Ver o feed</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map((entry, i) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.row}
                onPress={() => router.push(`/challenge/${entry.challengeId}`)}
                activeOpacity={0.8}
              >
                {/* Posição */}
                <LinearGradient
                  colors={getMedalColor(i) as [string, string]}
                  style={styles.position}
                >
                  <Text style={styles.positionText}>
                    {i + 1}
                  </Text>
                </LinearGradient>

                {/* Avatar */}
                {entry.userAvatar ? (
                  <Image source={{ uri: entry.userAvatar }} style={styles.rowAvatar} />
                ) : (
                  <View style={styles.rowAvatarPlaceholder}>
                    <Text style={styles.rowAvatarText}>
                      {entry.userName.charAt(0)}
                    </Text>
                  </View>
                )}

                {/* Info */}
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{entry.userName}</Text>
                  <Text style={styles.rowChallenge} numberOfLines={1}>
                    {entry.challengeTitle}
                  </Text>
                </View>

                {/* Votos */}
                <View style={styles.rowVotes}>
                  <Text style={styles.rowVotesNum}>{entry.votes}</Text>
                  <Text style={styles.rowVotesLabel}>votos</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          {filtered.length > 0 && filtered.length < 3 && (
            <View style={styles.hint}>
              <Ionicons name="share-social-outline" size={18} color={colors.primary} />
              <Text style={styles.hintText}>
                Ainda há poucos participantes. Partilha o desafio com amigos para receberes mais votos.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surface,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Pódio
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 8,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: colors.surfaceRaised,
    padding: 12,
    gap: 4,
  },
  podiumFirst: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,40,106,0.06)',
    paddingTop: 8,
  },
  podiumSecond: { marginBottom: 12 },
  podiumThird: { marginBottom: 20 },
  crownWrap: { marginBottom: 2 },
  podiumAvatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  podiumAvatarFirst: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: colors.primary,
  },
  podiumAvatarText: {
    color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold',
  },
  medal: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginTop: -14,
    borderWidth: 2, borderColor: colors.surfaceSunken,
  },
  medalText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#000' },
  podiumName: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: '#fff',
    textAlign: 'center',
  },
  podiumVotes: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  winnerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4,
  },
  winnerBadgeText: { flexShrink: 1, fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Filtros
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    maxWidth: 160,
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular',
  },
  filterTextActive: {
    color: '#fff', fontFamily: 'Inter_700Bold',
  },

  // Lista
  list: { paddingHorizontal: 16, paddingTop: 8 },
  listTitle: {
    fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 12,
  },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, marginBottom: 4,
    backgroundColor: 'rgba(255,40,106,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyText: { color: colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: colors.primary,
  },
  emptyBtnText: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_700Bold' },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8,
    padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,40,106,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(255,40,106,0.3)',
  },
  hintText: { flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.surface,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  position: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  positionText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  rowAvatar: { width: 40, height: 40, borderRadius: 20 },
  rowAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  rowAvatarText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  rowChallenge: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textSubtle },
  rowVotes: { alignItems: 'center' },
  rowVotesNum: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary },
  rowVotesLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.textSubtle },
});