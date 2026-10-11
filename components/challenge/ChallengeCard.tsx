import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Image,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { Challenge } from '../../hooks/useChallenges';
import { colors, gradients } from '../../constants/theme';

const CATEGORY_EMOJI: Record<string, string> = {
  fotografia: '📸',
  musica: '🎵',
  danca: '💃',
  culinaria: '🍲',
  moda: '👗',
  desporto: '⚽',
  arte: '🎨',
  humor: '😂',
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
  if (days > 0) return <Text style={styles.time}>⏱ {days}d restantes</Text>;
  return <Text style={styles.time}>⏱ {hours}h restantes</Text>;
}

export default function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const emoji = CATEGORY_EMOJI[challenge.category] || '🏆';
  const gradientColors = TYPE_COLORS[challenge.type] || TYPE_COLORS.free;
  const hasCoverImage = !!challenge.coverImage;

  const handlePress = () => {
    router.push(`/challenge/${challenge.id}`);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.92}
      onPress={handlePress}
    >
      {/* Banner */}
      {hasCoverImage ? (
        <View style={styles.banner}>
          <Image
            source={{ uri: challenge.coverImage }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          {/* Escurece a imagem para os badges ficarem legíveis */}
          <View style={styles.bannerOverlay} />

          {/* Badge tipo */}
          <View style={styles.badges}>
            {challenge.type === 'sponsored' && challenge.sponsor && (
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

          {/* Prémio */}
          <View style={styles.prizeBadge}>
            <Text style={styles.prizeText}>
              {challenge.prizeType === 'cash' ? '💰' : challenge.prizeType === 'physical' ? '🎁' : '🏅'}{' '}
              {challenge.prize}
            </Text>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={[colors.surface, colors.background]}
          style={styles.banner}
        >
          <Text style={styles.bannerEmoji}>{emoji}</Text>

          {/* Badge tipo */}
          <View style={styles.badges}>
            {challenge.type === 'sponsored' && challenge.sponsor && (
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

          {/* Prémio */}
          <View style={styles.prizeBadge}>
            <Text style={styles.prizeText}>
              {challenge.prizeType === 'cash' ? '💰' : challenge.prizeType === 'physical' ? '🎁' : '🏅'}{' '}
              {challenge.prize}
            </Text>
          </View>
        </LinearGradient>
      )}

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{challenge.title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {challenge.description}
        </Text>

        {/* Stats + tempo */}
        <View style={styles.footer}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{challenge.totalParticipants}</Text>
              <Text style={styles.statLabel}>participantes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{challenge.totalVotes}</Text>
              <Text style={styles.statLabel}>votos</Text>
            </View>
          </View>
          <TimeLeft endsAt={challenge.endsAt} />
        </View>

        {/* Botão - mesma navegação que o card inteiro */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePress}
        >
          <LinearGradient
            colors={gradientColors}
            style={styles.btn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.btnText}>Ver desafio →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.surfaceRaised,
    marginBottom: 16,
  },
  banner: {
    height: 130,
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
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  bannerEmoji: {
    fontSize: 52,
  },
  badges: {
    position: 'absolute',
    top: 10,
    left: 10,
    gap: 6,
  },
  sponsorBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sponsorText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  prizeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prizeText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  body: {
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stat: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: colors.textSubtle,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  time: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  timeOver: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.danger,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});