import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { push, ref, set } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FeedEntry } from '../../hooks/useFeedEntries';
import { useBlockedUsers } from '../../hooks/BlockedUsersProvider';
import { auth, db } from '../../services/firebase';
import { sharePost } from '../../services/share';

const { width, height } = Dimensions.get('window');
const DOUBLE_TAP_DELAY = 280;

interface Props {
  entry: FeedEntry;
  isActive: boolean;
  hasVoted: boolean;
  isOwnEntry: boolean;
  canLike: boolean;
  isLiking: boolean;
  onLike: () => void;
}

export function VideoPlayer({
  uri,
  isActive = true,
  onDoubleTap,
}: {
  uri: string;
  isActive?: boolean;
  onDoubleTap?: () => void;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const lastTap = useRef(0);
  const singleTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(uri, player => {
    player.loop = true;
    player.muted = false;
    if (isActive) player.play();
  });

  useEffect(() => {
    if (isActive && !isPaused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isPaused]);

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted]);

  const handleTap = () => {
    const now = Date.now();
    const isDoubleTap = now - lastTap.current < DOUBLE_TAP_DELAY;

    if (isDoubleTap) {
      if (singleTapTimeout.current) {
        clearTimeout(singleTapTimeout.current);
        singleTapTimeout.current = null;
      }
      onDoubleTap?.();
      lastTap.current = 0;
      return;
    }

    lastTap.current = now;
    singleTapTimeout.current = setTimeout(() => {
      setIsPaused(prev => !prev);
      setShowControls(true);
      setTimeout(() => setShowControls(false), 1200);
    }, DOUBLE_TAP_DELAY);
  };

  return (
    <TouchableOpacity style={styles.mediaTouch} onPress={handleTap} activeOpacity={1}>
      <VideoView style={styles.media} player={player} nativeControls={false} contentFit="contain" />

      {showControls && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseIcon}>{isPaused ? '▶️' : '⏸️'}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.muteBtn} onPress={() => setIsMuted(prev => !prev)} activeOpacity={0.8}>
        <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🔊'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function FeedCard({
  entry,
  isActive,
  hasVoted,
  isOwnEntry,
  canLike,
  isLiking,
  onLike,
}: Props) {
  const { blocked, block } = useBlockedUsers();
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [burstVisible, setBurstVisible] = useState(false);
  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;

  const playBurst = () => {
    setBurstVisible(true);
    burstScale.setValue(0);
    burstOpacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(burstScale, { toValue: 1.15, useNativeDriver: true, speed: 20 }),
        Animated.timing(burstOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]),
      Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      Animated.delay(350),
      Animated.timing(burstOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setBurstVisible(false));
  };

  // Só anima o coração ao DAR like — remover (unlike) não dispara o burst,
  // igual ao comportamento do TikTok.
  const handleLikePress = () => {
    if (!canLike || isLiking) return;
    if (!hasVoted) playBurst();
    onLike();
  };

  const handleDoubleTap = () => {
    if (!canLike || isLiking) return;
    if (!hasVoted) playBurst();
    onLike();
  };

  const handleActions = () => {
    Alert.alert('Gerir conteúdo', 'Escolhe uma opção.', [
      { text: 'Denunciar conteúdo/utilizador', onPress: handleReport },
      { text: 'Bloquear utilizador', onPress: async () => {
        try { await block(entry.userId); }
        catch (error) { Alert.alert('Não foi possível bloquear', error instanceof Error ? error.message : 'Tenta novamente.'); }
      } },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleReport = () => {
    Alert.alert(
      'Denunciar conteúdo',
      'Por que razão queres denunciar este post?',
      [
        { text: 'Conteúdo inapropriado', onPress: () => submitReport('conteudo_inapropriado') },
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Atenção', 'Precisas de ter conta para denunciar conteúdo.');
      return;
    }
    try {
      const reportRef = push(ref(db, 'reports'));
      await set(reportRef, {
        entryId: entry.id,
        challengeId: entry.challengeId,
        reportedUserId: entry.userId,
        reportedUserName: entry.userName,
        reportedBy: uid,
        reason,
        mediaUrl: entry.mediaUrl,
        caption: entry.caption,
        status: 'pending',
        createdAt: Date.now(),
      });
      Alert.alert('Denúncia enviada', 'A nossa equipa vai analisar este conteúdo.');
    } catch (e) {
      console.error('Erro ao denunciar:', e);
    }
  };

  if (blocked.includes(entry.userId)) return null;

  return (
    <View style={styles.card}>
      {entry.mediaType === 'video' ? (
        <VideoPlayer uri={entry.mediaUrl} isActive={isActive} onDoubleTap={handleDoubleTap} />
      ) : (
        <TouchableOpacity style={styles.mediaTouch} activeOpacity={1} onPress={handleDoubleTap}>
          <Image source={{ uri: entry.mediaUrl }} style={styles.media} resizeMode="contain" />
        </TouchableOpacity>
      )}

      {/* Burst de coração — centrado, ao estilo TikTok */}
      {burstVisible && (
        <Animated.Text
          style={[
            styles.heartBurst,
            { transform: [{ scale: burstScale }], opacity: burstOpacity },
          ]}
          pointerEvents="none"
        >
          ❤️
        </Animated.Text>
      )}

      {/* Gradiente inferior */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.92)']} style={styles.overlay} pointerEvents="none" />

      {/* Coluna de ações — direita, estilo TikTok */}
      <View style={styles.actionColumn}>
        <View style={styles.avatarWrap}>
          {entry.userAvatar ? (
            <Image source={{ uri: entry.userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{entry.userName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleLikePress}
          disabled={!canLike || isLiking}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionIcon, hasVoted && styles.actionIconActive]}>
            {hasVoted ? '❤️' : '🤍'}
          </Text>
          <Text style={styles.actionCount}>{entry.votes || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() =>
            sharePost({
              challengeTitle: entry.challengeTitle,
              userName: entry.userName,
              challengeId: entry.challengeId,
              entryId: entry.id,
              prize: entry.challengePrize,
            })
          }
        >
          <Text style={styles.actionIcon}>↗️</Text>
          <Text style={styles.actionCount}>Partilhar</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityLabel="Denunciar ou bloquear utilizador" style={styles.actionBtn} activeOpacity={0.8} onPress={handleActions}>
          <Text style={styles.actionIcon}>⚠️</Text>
        </TouchableOpacity>
      </View>

      {/* Info do utilizador — baixo esquerda */}
      <View style={styles.userInfo}>
        {isOwnEntry && (
          <View style={styles.ownBadge}>
            <Text style={styles.ownBadgeText}>O teu post</Text>
          </View>
        )}

        <Text style={styles.userName}>@{entry.userName}</Text>

        <TouchableOpacity activeOpacity={0.8} onPress={() => setCaptionExpanded(prev => !prev)}>
          <Text style={styles.caption} numberOfLines={captionExpanded ? undefined : 2}>
            {entry.caption}
          </Text>
        </TouchableOpacity>

        <View style={styles.challengeTag}>
          <Text style={styles.challengeTagText} numberOfLines={1}>
            🏆 {entry.challengeTitle}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width,
    height,
    backgroundColor: '#000',
    position: 'relative',
  },
  media: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  heartBurst: {
    position: 'absolute',
    top: height * 0.36,
    alignSelf: 'center',
    fontSize: 90,
    zIndex: 99,
  },
  mediaTouch: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pauseIcon: { fontSize: 64 },
  muteBtn: {
    position: 'absolute',
    bottom: 210,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  muteIcon: { fontSize: 18 },

  // Coluna de ações — direita
  actionColumn: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    alignItems: 'center',
    gap: 18,
    zIndex: 10,
  },
  avatarWrap: {
    marginBottom: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ff286a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    fontSize: 34,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionIconActive: {},
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Info inferior — esquerda
  userInfo: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 90,
    gap: 6,
  },
  ownBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,40,106,0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,40,106,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 2,
  },
  ownBadgeText: {
    color: '#ff286a',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  caption: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  challengeTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 2,
    maxWidth: '100%',
  },
  challengeTagText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});
