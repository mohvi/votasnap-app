import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ActiveChallengeBanner from '../../components/challenge/ActiveChallengeBanner';
import FeedCard from '../../components/feed/FeedCard';
import AuthPrompt from '../../components/ui/AuthPrompt';
import OnboardingModal from '../../components/ui/OnboardingModal';
import { useActiveChallenge } from '../../hooks/useActiveChallenge';
import { useAuth } from '../../hooks/useAuth';
import { useFeedEntries } from '../../hooks/useFeedEntries';
import { auth, db } from '../../services/firebase';
import { submitVote } from '../../services/voting';
import { colors, gradients } from '../../constants/theme';
import { toast } from 'sonner-native';

const { width, height: windowHeight } = Dimensions.get('window');

export default function FeedScreen() {
  const { allEntries, loading, refresh, userVotes } = useFeedEntries();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [feedHeight, setFeedHeight] = useState(windowHeight); // altura real visível (ecrã menos a tab bar)
  const [bannerExpanded, setBannerExpanded] = useState(true); // controla se o banner aparece inteiro ou minimizado

  const flatListRef = useRef<FlatList>(null);
  const { isLoggedIn } = useAuth();
  const { challenge: activeChallenge } = useActiveChallenge();
  const insets = useSafeAreaInsets();
  const uid = auth.currentUser?.uid;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  useEffect(() => {
    const checkOnboarding = async () => {
      const seen = await AsyncStorage.getItem('hasSeenAppOnboarding');
      if (!seen) setShowOnboarding(true);
    };
    checkOnboarding();
  }, []);

  const handleCloseOnboarding = async () => {
    await AsyncStorage.setItem('hasSeenAppOnboarding', 'true');
    setShowOnboarding(false);
  };

  const handleLike = useCallback(async (entry: any) => {
    if (!isLoggedIn) {
      setShowAuthPrompt(true);
      return;
    }
    if (!uid) return;
    if (entry.userId === uid) return; // não podes votar em ti mesmo
    if (votingId) return; // evita cliques em sequência rápida

    const votedEntryIdForChallenge = userVotes[entry.challengeId];
    const isUnvoting = votedEntryIdForChallenge === entry.id;

    // já votaste noutra participação deste MESMO desafio
    if (!isUnvoting && votedEntryIdForChallenge) {
      toast.warning('Já votaste neste desafio', { description: 'Só podes votar numa participação por desafio. Remove o teu voto atual (❤️) se quiseres votar noutra.' });
      return;
    }

    setVotingId(entry.id);

    try {
      await submitVote(entry.challengeId, entry.id, isUnvoting);
    } catch (e) {
      console.error('Erro ao votar:', e);
      toast.error('Não foi possível registar o teu voto. Tenta novamente.');
    } finally {
      setVotingId(null);
    }
  }, [uid, isLoggedIn, userVotes, votingId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  // Bloco reutilizável do banner — expandido ou minimizado (pílula)
  const renderChallengeBanner = () => {
    if (!activeChallenge) return null;

    if (!bannerExpanded) {
      return (
        <TouchableOpacity
          style={[styles.bannerPill, { top: insets.top + 8 }]}
          onPress={() => setBannerExpanded(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.bannerPillText} numberOfLines={1}>
            🏆 {activeChallenge.title}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <>
        <LinearGradient
          colors={['rgba(0,0,0,0.75)', 'transparent']}
          style={styles.topScrim}
          pointerEvents="none"
        />
        <View style={[styles.bannerOverlay, { top: insets.top + 8 }]}>
          <ActiveChallengeBanner challenge={activeChallenge} />
          <TouchableOpacity
            style={styles.collapseBtn}
            onPress={() => setBannerExpanded(false)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.collapseBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (allEntries.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        {renderChallengeBanner()}

        <Text style={styles.emptyEmoji}>🎯</Text>
        <Text style={styles.emptyTitle}>Ainda não há participações</Text>
        <Text style={styles.emptySub}>
          {activeChallenge
            ? `Sê o primeiro a participar em "${activeChallenge.title}"!`
            : 'Participa num desafio e sê o primeiro!'}
        </Text>
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() => {
            if (activeChallenge) {
              router.push({
                pathname: '/challenge/submit',
                params: { id: activeChallenge.id, title: activeChallenge.title },
              });
            }
          }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={gradients.primary} style={styles.reviewBtnGrad}>
            <Text style={styles.reviewBtnText}>🚀 Participar agora</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={e => setFeedHeight(Math.round(e.nativeEvent.layout.height))}
    >
      {renderChallengeBanner()}

    

      {/* Feed vertical — cada item ocupa o ecrã inteiro, com snap de página */}
      <FlatList
        ref={flatListRef}
        data={allEntries}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={feedHeight}
        snapToAlignment="start"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: feedHeight,
          offset: feedHeight * index,
          index,
        })}
        renderItem={({ item, index: itemIndex }) => {
          const hasVoted = userVotes[item.challengeId] === item.id;
          const isOwnEntry = item.userId === uid;
          const canLike = !isOwnEntry && isLoggedIn;
          const isActive = isFocused && itemIndex === currentIndex;

          return (
            <View style={{ width, height: feedHeight }}>
              <FeedCard
                entry={item}
                isActive={isActive}
                hasVoted={hasVoted}
                isOwnEntry={isOwnEntry}
                canLike={canLike}
                isLiking={votingId === item.id}
                onLike={() => handleLike(item)}
              />
            </View>
          );
        }}
      />

      {/* Indicador de progresso — fininho, topo, estilo TikTok */}
      <View style={[styles.progressTrack, { top: insets.top }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, ((currentIndex + 1) / allEntries.length) * 100)}%` },
          ]}
        />
      </View>

      <AuthPrompt
        visible={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        action="votar"
      />

      <OnboardingModal
        visible={showOnboarding}
        onClose={handleCloseOnboarding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: 32,
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  collapseBtn: {
    position: 'absolute',
    top: -6,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 21,
  },
  collapseBtnText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  bannerPill: {
    position: 'absolute',
    left: 14,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: width * 0.6,
  },
  bannerPillText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  snapsWrap: {
    position: 'absolute',
    right: 14,
    zIndex: 30,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 15, // abaixo do banner (zIndex 20) e do snapsWrap (zIndex 30)
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 25,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptySub: { color: colors.textMuted, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  reviewBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, width: '80%' },
  reviewBtnGrad: { paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: 14 },
  reviewBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_500Medium' },
});