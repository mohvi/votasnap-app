import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { push, ref, set } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image, StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FeedEntry } from '../../hooks/useFeedEntries';
import { auth, db } from '../../services/firebase';
import { sharePost } from '../../services/share';

const { width, height } = Dimensions.get('window');

interface Props {
  entry: FeedEntry;
  isVoting: boolean;
  isSkipping: boolean;
  reviewed: boolean;
  isActive: boolean;
}

function VideoPlayer({ uri, isActive }: { uri: string; isActive: boolean }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);

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
    setIsPaused(prev => !prev);
    setShowControls(true);
    setTimeout(() => setShowControls(false), 1500);
  };

  return (
    <TouchableOpacity
      style={styles.mediaTouch}
      onPress={handleTap}
      activeOpacity={1}
    >
      <VideoView
        style={styles.media}
        player={player}
        nativeControls={false}
        contentFit="contain"
      />

      {showControls && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseIcon}>
            {isPaused ? '▶️' : '⏸️'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.muteBtn}
        onPress={() => setIsMuted(prev => !prev)}
        activeOpacity={0.8}
      >
        <Text style={styles.muteIcon}>
          {isMuted ? '🔇' : '🔊'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function FeedCard({ entry, isVoting, isSkipping, reviewed, isActive }: Props) {

  const handleReport = () => {
    Alert.alert(
      'Denunciar conteúdo',
      'Por que razão queres denunciar este post?',
      [
        { text: 'Conteúdo inapropriado', onPress: () => submitReport('conteudo_inapropriado') },
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Não segue o tema do desafio', onPress: () => submitReport('fora_do_tema') },
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

  return (
    <View style={styles.card}>

      {entry.mediaType === 'video' ? (
        <VideoPlayer uri={entry.mediaUrl} isActive={isActive} />
      ) : (
        <Image
          source={{ uri: entry.mediaUrl }}
          style={styles.media}
          resizeMode="contain"
        />
      )}

      {/* Gradiente baixo */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.92)']}
        style={styles.overlay}
      />

      {/* Overlay voto */}
      {isVoting && (
        <View style={[styles.actionOverlay, styles.voteOverlay]}>
          <Text style={styles.actionEmoji}>{reviewed ? '👀' : '🗳️'}</Text>
          <Text style={styles.actionText}>
            {reviewed ? 'JÁ VOTASTE' : 'VOTADO!'}
          </Text>
        </View>
      )}

      {/* Overlay skip */}
      {isSkipping && (
        <View style={[styles.actionOverlay, styles.skipOverlay]}>
          <Text style={styles.actionEmoji}>⏭️</Text>
          <Text style={styles.actionText}>SKIP</Text>
        </View>
      )}

      {/* Info utilizador — baixo (badge de desafio removido, agora fixo no topo da app) */}
      <View style={styles.userInfo}>
        <View style={styles.userRow}>
          {entry.userAvatar ? (
            <Image source={{ uri: entry.userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {entry.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userText}>
            <Text style={styles.userName}>@{entry.userName}</Text>
            <Text style={styles.votes}>{entry.votes} votos</Text>
          </View>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => sharePost({
              challengeTitle: entry.challengeTitle,
              userName: entry.userName,
              challengeId: entry.challengeId,
              entryId: entry.id,
              prize: entry.challengePrize,
            })}
            activeOpacity={0.8}
          >
            <Text style={styles.shareIcon}>↗️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reportBtn}
            onPress={handleReport}
            activeOpacity={0.8}
          >
            <Text style={styles.reportIcon}>⚠️</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.caption} numberOfLines={2}>
          {entry.caption}
        </Text>

        {/* Hints */}
        <View style={styles.hintsRow}>
          <View style={styles.hint}>
            <Text style={styles.hintEmoji}>👈</Text>
            <Text style={styles.hintText}>Skip</Text>
          </View>
          {reviewed ? (
            <View style={[styles.hint, styles.hintReviewed]}>
              <Text style={styles.hintEmoji}>👁️</Text>
              <Text style={styles.hintText}>Modo revisão</Text>
            </View>
          ) : (
            <View style={[styles.hint, styles.hintVote]}>
              <Text style={styles.hintEmoji}>👉</Text>
              <Text style={styles.hintText}>Votar</Text>
            </View>
          )}
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
    height: 300,
  },
  actionOverlay: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    bottom: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    zIndex: 10,
  },
  voteOverlay: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 4,
    borderColor: '#22c55e',
  },
  skipOverlay: {
    backgroundColor: 'rgba(100,100,100,0.2)',
    borderWidth: 4,
    borderColor: '#666',
  },
  actionEmoji: { fontSize: 64 },
  actionText: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginTop: 10,
    letterSpacing: 4,
  },
  userInfo: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    gap: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff286a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  userText: { flex: 1, gap: 2 },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  votes: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  caption: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shareIcon: { fontSize: 16 },
  hintsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  hintVote: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 0.5,
    borderColor: '#22c55e',
  },
  hintReviewed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: '#555',
  },
  hintEmoji: { fontSize: 14 },
  hintText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
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
  pauseIcon: {
    fontSize: 64,
  },
  muteBtn: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  muteIcon: { fontSize: 18 },
  reportBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reportIcon: { fontSize: 16 },
});