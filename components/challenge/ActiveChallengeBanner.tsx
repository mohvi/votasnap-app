import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Challenge } from '../../hooks/useChallenges';
import { SponsorName } from './SponsorName';
import { challengeMinAge } from '../../services/demographics';
import { colors, fonts, gradients } from '../../constants/theme';

const META = 'rgba(255,255,255,0.85)';

function TimeLeft({ endsAt }: { endsAt: number }) {
  const diff = endsAt - Date.now();
  if (diff <= 0) return <Text style={styles.meta}>Encerrado</Text>;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return (
    <View style={styles.metaItem}>
      <Ionicons name="time-outline" size={12} color={META} />
      <Text style={styles.meta}>{days > 0 ? `${days}d` : `${hours}h`}</Text>
    </View>
  );
}

export default function ActiveChallengeBanner({ challenge }: { challenge: Challenge }) {
  const handlePress = () => {
    router.push({
      pathname: '/challenge/submit',
      params: { id: challenge.id, title: challenge.title },
    });
  };

  const isSponsored = challenge.type === 'sponsored' && !!challenge.sponsor;

  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={handlePress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Participar no desafio ${challenge.title}`}
    >
      {challenge.coverImage ? (
        <Image source={{ uri: challenge.coverImage }} style={styles.bgImage} />
      ) : null}
      <LinearGradient
        colors={gradients.primary}
        style={[styles.gradient, challenge.coverImage && styles.gradientOverlay]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.info}>
          {isSponsored ? (
            <SponsorName name={challenge.sponsor} logo={challenge.sponsorLogo} textStyle={styles.label} />
          ) : (
            <Text style={styles.label}>Desafio activo</Text>
          )}

          <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name={challenge.prizeType === 'cash' ? 'cash-outline' : 'gift-outline'} size={13} color={colors.gold} />
              <Text style={styles.prize} numberOfLines={1}>{challenge.prize}</Text>
            </View>
            <TimeLeft endsAt={challenge.endsAt} />
            {challengeMinAge(challenge) > 0 && (
              <Text style={styles.meta}>{challengeMinAge(challenge)}+</Text>
            )}
          </View>
        </View>

        <View style={styles.cta}>
          <Text style={styles.ctaText}>Participar</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bgImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  gradientOverlay: {
    backgroundColor: 'rgba(255,40,106,0.55)',
  },
  info: { flex: 1, gap: 2, minWidth: 0 },
  label: {
    color: META,
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 1,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  prize: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: fonts.bold,
    flexShrink: 1,
  },
  meta: {
    color: META,
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  cta: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
});
