import { Ionicons } from '@expo/vector-icons';
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
import InviteStrip from '../../components/invite/InviteStrip';
import { useActiveInviteCampaign } from '../../services/invites';
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
  const autoCollapsed = useRef(false);
  const { isLoggedIn } = useAuth();
  const { challenge: activeChallenge } = useActiveChallenge();
  const { campaign: inviteCampaign } = useActiveInviteCampaign();
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
      const index = viewableItems[0].index ?? 0;
      setCurrentIndex(index);
      // Ao passar para a segunda publicação, o banner minimiza-se (uma só vez)
      // para o conteúdo ocupar o ecrã.
      if (index > 0 && !autoCollapsed.current) {
        autoCollapsed.current = true;
        setBannerExpanded(false);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  // Bloco reutilizável do banner — expandido ou minimizado (pílula)
  const renderChallengeBanner = () => {
    // Sem desafio de fotografia (ou banner minimizado), o convite fica sozinho no topo.
    if (!activeChallenge) {
      return inviteCampaign ? (
        <View style={[styles.bannerOverlay, { top: insets.top }]}>
          <InviteStrip campaign={inviteCampaign} />
        </View>
      ) : null;
    }

    if (!bannerExpanded) {
      // Minimizado: uma só linha com o desafio e, se houver, o convite.
      return (
        <View style={[styles.pillRow, { top: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.bannerPill}
            onPress={() => setBannerExpanded(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Ver desafio ${activeChallenge.title}`}
          >
            <Ionicons name="trophy" size={13} color={colors.gold} />
            <Text style={styles.bannerPillText} numberOfLines={1}>
              {activeChallenge.title}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
          </TouchableOpacity>
          {inviteCampaign && <InviteStrip campaign={inviteCampaign} compact />}
        </View>
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
          {inviteCampaign && <InviteStrip campaign={inviteCampaign} />}
          <TouchableOpacity
            style={styles.collapseBtn}
            onPress={() => setBannerExpanded(false)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Minimizar"
          >
            <Ionicons name="chevron-up" size={14} color={colors.text} />
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

        <View style={styles.emptyIcon}>
          <Ionicons name="images-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Ainda não há participações</Text>
        <Text style={styles.emptySub}>
          {activeChallenge
            ? `Sê o primeiro a participar em "${activeChallenge.title}"!`
            : 'Participa num desafio e sê o primeiro!'}
        </Text>
        {activeChallenge && (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => {
              router.push({
                pathname: '/challenge/submit',
                params: { id: activeChallenge.id, title: activeChallenge.title },
              });
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.reviewBtnGrad}>
              <Text style={styles.reviewBtnText}>Participar agora</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
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
        hasActiveChallenge={!!activeChallenge}
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
  pillRow: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bannerPillText: {
    flexShrink: 1,
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
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,40,106,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptySub: { color: colors.textMuted, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  reviewBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, width: '80%' },
  reviewBtnGrad: { paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: 14 },
  reviewBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_500Medium' },
});