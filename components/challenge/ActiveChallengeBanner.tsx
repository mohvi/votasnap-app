import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Challenge } from '../../hooks/useChallenges';
import { colors, gradients } from '../../constants/theme';

function TimeLeft({ endsAt }: { endsAt: number }) {
  const diff = endsAt - Date.now();
  if (diff <= 0) return <Text style={styles.timeOver}>Encerrado</Text>;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return <Text style={styles.time}>⏱ {days}d</Text>;
  return <Text style={styles.time}>⏱ {hours}h</Text>;
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
          {/* Label — muda consoante for patrocinado ou não */}
          <Text style={styles.label}>
            {isSponsored ? '🏢 Desafio patrocinado' : '🏆 Desafio activo'}
          </Text>

          <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.prize}>
              {challenge.prizeType === 'cash' ? '💰' : '🎁'} {challenge.prize}
            </Text>
            <TimeLeft endsAt={challenge.endsAt} />
          </View>

          {/* Pill do patrocinador — só aparece quando challenge.type === 'sponsored' */}
          {isSponsored && (
            <View style={styles.sponsorPill}>
              <Text style={styles.sponsorText}>📢 {challenge.sponsor}</Text>
            </View>
          )}
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
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
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
    paddingVertical: 12,
  },
  gradientOverlay: {
    backgroundColor: 'rgba(255,40,106,0.55)',
  },
  info: { flex: 1, gap: 2 },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  prize: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  time: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  timeOver: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  sponsorPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  sponsorText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  cta: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
});