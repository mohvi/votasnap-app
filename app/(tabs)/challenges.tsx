import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { equalTo, get, onValue, orderByChild, query, ref } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgeBadge } from '../../components/challenge/AgeNotice';
import ReminderButton from '../../components/challenge/ReminderButton';
import { SponsorName } from '../../components/challenge/SponsorName';
import AuthPrompt from '../../components/ui/AuthPrompt';
import { colors, fonts, gradients, radius, spacing } from '../../constants/theme';
import { useDemographics } from '../../hooks/DemographicsProvider';
import {
  Challenge, challengeDeadlines, challengeStartsAt, isChallengeOpen, isChallengeUpcoming, useNow,
} from '../../hooks/useChallenges';
import { useChallengesScope, useProfiles } from '../../hooks/useScopedData';
import { canAccessChallenge, challengeMinAge } from '../../services/demographics';
import { db } from '../../services/firebase';

const HOUR = 3600000;
const DAY = 24 * HOUR;

function formatSpan(ms: number) {
  if (ms <= 0) return 'agora';
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  const minutes = Math.max(1, Math.floor((ms % HOUR) / 60000));
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

// Desafios concluídos com vencedor confirmado (os mais recentes primeiro).
function useWinners(limit = 10) {
  const [list, setList] = useState<Challenge[]>([]);
  const [media, setMedia] = useState<Record<string, string>>({});
  useEffect(() => onValue(
    query(ref(db, 'challenges'), orderByChild('status'), equalTo('completed')),
    snap => {
      const items = Object.entries<any>(snap.val() || {})
        .map(([id, c]) => ({ ...c, id }) as Challenge)
        .filter(c => !!c.winnerId)
        .sort((a, b) => (b.confirmedAt || b.endsAt) - (a.confirmedAt || a.endsAt))
        .slice(0, limit);
      setList(items);
    },
    () => setList([]),
  ), [limit]);
  // Foto da publicação vencedora de cada desafio.
  const key = list.map(c => `${c.id}/${c.winnerEntryId}`).join('|');
  useEffect(() => {
    let cancelled = false;
    Promise.all(list.filter(c => c.winnerEntryId).map(c =>
      get(ref(db, `entries/${c.id}/${c.winnerEntryId}/mediaUrl`)).then(s => [c.id, s.val()] as const).catch(() => [c.id, null] as const),
    )).then(pairs => {
      if (!cancelled) setMedia(Object.fromEntries(pairs.filter(([, url]) => typeof url === 'string')) as Record<string, string>);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { winners: list, media };
}

function Cover({ challenge, height, style }: { challenge: Challenge; height: number | '100%'; style?: any }) {
  return challenge.coverImage ? (
    <Image source={{ uri: challenge.coverImage }} style={[styles.cover, { height }, style]} resizeMode="cover" />
  ) : (
    <LinearGradient colors={challenge.type === 'sponsored' ? gradients.primary : gradients.free} style={[styles.cover, { height }, style]}>
      <Ionicons name="trophy" size={34} color="rgba(255,255,255,0.85)" />
    </LinearGradient>
  );
}

function SectionTitle({ icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <View style={styles.sectionHead}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!count && <Text style={styles.sectionCount}>{count}</Text>}
    </View>
  );
}

export default function ChallengesScreen() {
  const { challenges: active, loaded } = useChallengesScope('active');
  const { age, interests } = useDemographics();
  const { winners, media } = useWinners();
  const [showAuth, setShowAuth] = useState(false);

  const all = useMemo(
    () => Object.entries<any>(active).map(([id, c]) => ({ ...c, id }) as Challenge).filter(c => canAccessChallenge(c, age)),
    [active, age],
  );
  const now = useNow(all.flatMap(challengeDeadlines));
  const liked = (c: Challenge) => (interests.includes(c.category) ? 0 : 1);

  // A decorrer: primeiro os dos interesses da pessoa, depois os que acabam mais cedo.
  const open = all.filter(c => isChallengeOpen(c, now)).sort((a, b) => liked(a) - liked(b) || a.endsAt - b.endsAt);
  const upcoming = all.filter(c => isChallengeUpcoming(c, now)).sort((a, b) => challengeStartsAt(a) - challengeStartsAt(b));
  const visibleWinners = winners.filter(c => canAccessChallenge(c, age));
  const winnerProfiles = useProfiles(visibleWinners.map(c => c.winnerId as string));

  if (!loaded) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Desafios</Text>
        <Text style={styles.headerSub}>Prémios oferecidos pelas marcas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* A decorrer */}
        <SectionTitle icon="flame" title="A decorrer" count={open.length} />
        {open.length === 0 ? (
          <Text style={styles.empty}>Nenhum desafio aberto agora. Vê o que vem a seguir.</Text>
        ) : open.map(c => (
          <TouchableOpacity key={c.id} style={styles.card} activeOpacity={0.88} onPress={() => router.push(`/challenge/${c.id}`)}>
            <Cover challenge={c} height={130} />
            <View style={styles.cardBody}>
              {c.type === 'sponsored' && !!c.sponsor && (
                <SponsorName name={c.sponsor} logo={c.sponsorLogo} textStyle={styles.sponsor} />
              )}
              <Text style={styles.cardTitle} numberOfLines={2}>{c.title}</Text>
              <View style={styles.metaRow}>
                <View style={styles.meta}>
                  <Ionicons name={c.prizeType === 'cash' ? 'cash-outline' : 'gift-outline'} size={14} color={colors.gold} />
                  <Text style={styles.prize} numberOfLines={1}>{c.prize}</Text>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{formatSpan(c.endsAt - now)}</Text>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{c.totalParticipants || 0}</Text>
                </View>
              </View>
              <AgeBadge minAge={challengeMinAge(c)} alcohol={!!c.alcohol} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Em breve */}
        {upcoming.length > 0 && (
          <>
            <SectionTitle icon="calendar" title="Em breve" count={upcoming.length} />
            {upcoming.map(c => (
              <TouchableOpacity key={c.id} style={styles.upcoming} activeOpacity={0.88} onPress={() => router.push(`/challenge/${c.id}`)}>
                <Cover challenge={c} height="100%" style={{ width: 96, minHeight: 110 }} />
                <View style={styles.upcomingBody}>
                  {c.type === 'sponsored' && !!c.sponsor && (
                    <SponsorName name={c.sponsor} logo={c.sponsorLogo} textStyle={styles.sponsor} />
                  )}
                  <Text style={styles.upcomingTitle} numberOfLines={2}>{c.title}</Text>
                  <Text style={styles.prizeSmall} numberOfLines={1}>{c.prize}</Text>
                  <View style={styles.upcomingFoot}>
                    <Text style={styles.opensIn}>Abre em {formatSpan(challengeStartsAt(c) - now)}</Text>
                    <ReminderButton
                      compact challengeId={c.id} title={c.title} startsAt={challengeStartsAt(c)}
                      onNeedLogin={() => setShowAuth(true)}
                    />
                  </View>
                  <AgeBadge minAge={challengeMinAge(c)} alcohol={!!c.alcohol} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Vencedores */}
        {visibleWinners.length > 0 && (
          <>
            <SectionTitle icon="trophy" title="Vencedores" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.winnersRow}>
              {visibleWinners.map(c => {
                const profile = winnerProfiles[c.winnerId as string];
                const photo = media[c.id];
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.winner}
                    activeOpacity={0.88}
                    onPress={() => c.winnerEntryId && router.push(`/entry/${c.id}/${c.winnerEntryId}`)}
                  >
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.winnerPhoto} />
                    ) : (
                      <View style={[styles.winnerPhoto, styles.winnerPhotoEmpty]}>
                        <Ionicons name="trophy" size={28} color={colors.gold} />
                      </View>
                    )}
                    <View style={styles.winnerBody}>
                      <Text style={styles.winnerName} numberOfLines={1}>@{profile?.username || 'vencedor'}</Text>
                      <Text style={styles.winnerPrize} numberOfLines={1}>Ganhou {c.prize}</Text>
                      <Text style={styles.winnerChallenge} numberOfLines={1}>
                        {c.sponsor ? `${c.sponsor} · ` : ''}{c.title}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </ScrollView>

      <AuthPrompt visible={showAuth} onClose={() => setShowAuth(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 10 },
  headerTitle: { color: colors.text, fontSize: 22, fontFamily: fonts.bold },
  headerSub: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 110 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  sectionCount: {
    color: colors.textSecondary, fontSize: 12, fontFamily: fonts.semibold,
    backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1,
  },
  empty: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, marginBottom: 8 },
  card: {
    backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14,
    borderWidth: 0.5, borderColor: colors.surfaceRaised,
  },
  cover: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 14, gap: 6 },
  sponsor: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.medium },
  cardTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  prize: { color: colors.gold, fontSize: 13, fontFamily: fonts.bold, flexShrink: 1 },
  metaText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.medium },
  upcoming: {
    flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, overflow: 'hidden',
    marginBottom: 12, borderWidth: 0.5, borderColor: colors.surfaceRaised,
  },
  upcomingBody: { flex: 1, padding: 12, gap: 4 },
  upcomingTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.bold },
  prizeSmall: { color: colors.gold, fontSize: 12, fontFamily: fonts.semibold },
  upcomingFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  opensIn: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.medium, flexShrink: 1 },
  winnersRow: { gap: 12, paddingRight: 8 },
  winner: {
    width: 170, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,215,0,0.35)',
  },
  winnerPhoto: { width: '100%', height: 150 },
  winnerPhotoEmpty: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  winnerBody: { padding: 10, gap: 2 },
  winnerName: { color: colors.text, fontSize: 14, fontFamily: fonts.bold },
  winnerPrize: { color: colors.gold, fontSize: 12, fontFamily: fonts.semibold },
  winnerChallenge: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular },
});
