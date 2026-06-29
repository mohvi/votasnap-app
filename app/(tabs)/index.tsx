import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { get, ref, set, update } from 'firebase/database';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActiveChallengeBanner from '../../components/challenge/ActiveChallengeBanner';
import FeedCard from '../../components/feed/FeedCard';
import AuthPrompt from '../../components/ui/AuthPrompt';
import OnboardingModal from '../../components/ui/OnboardingModal';
import SnapsCounter from '../../components/ui/SnapsCounter';
import { useActiveChallenge } from '../../hooks/useActiveChallenge';
import { useAuth } from '../../hooks/useAuth';
import { useFeedEntries } from '../../hooks/useFeedEntries';
import { auth, db } from '../../services/firebase';
import { notifyVoteReceived } from '../../services/notifications';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

export default function FeedScreen() {
  const { freshEntries, allEntries, loading, refresh } = useFeedEntries();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [pendingSwipe, setPendingSwipe] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isLoggedIn } = useAuth();
  const { challenge: activeChallenge } = useActiveChallenge();

  const processingRef = useRef(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const uid = auth.currentUser?.uid;
  const activeEntries = reviewed ? allEntries : freshEntries;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  useEffect(() => {
    const checkOnboarding = async () => {
      const seen = await AsyncStorage.getItem('hasSeenAppOnboarding');
      if (!seen) {
        setShowOnboarding(true);
      }
    };
    checkOnboarding();
  }, []);

  const handleCloseOnboarding = async () => {
    await AsyncStorage.setItem('hasSeenAppOnboarding', 'true');
    setShowOnboarding(false);
  };

  const castVote = useCallback(async (entryId: string, challengeId: string) => {
    if (!uid) return;
    try {
      await set(ref(db, `votes/${challengeId}/${uid}`), {
        entryId,
        votedAt: Date.now(),
      });

      const entrySnap = await get(ref(db, `entries/${challengeId}/${entryId}`));
      const entryData = entrySnap.val();
      const currentVotes = entryData?.votes || 0;

      await update(ref(db, `entries/${challengeId}/${entryId}`), {
        votes: currentVotes + 1,
      });

      const challengeSnap = await get(ref(db, `challenges/${challengeId}`));
      const currentTotal = challengeSnap.val()?.totalVotes || 0;
      await update(ref(db, `challenges/${challengeId}`), {
        totalVotes: currentTotal + 1,
      });

      const voterSnap = await get(ref(db, `users/${uid}`));
      const voterName = voterSnap.val()?.name || 'Alguém';
      const challengeTitle = challengeSnap.val()?.title || 'um desafio';

      if (entryData?.userId && entryData.userId !== uid) {
        await notifyVoteReceived({
          entryOwnerId: entryData.userId,
          voterName,
          challengeTitle,
          challengeId,
          entryId,
        });
      }
    } catch (e) {
      console.error('Erro ao votar:', e);
    }
  }, [uid]);

  const goNext = useCallback(() => {
    setIndex(prev => prev + 1);
    translateX.value = 0;
    translateY.value = 0;
    setIsVoting(false);
    setIsSkipping(false);
    processingRef.current = false;
  }, [translateX, translateY]);

  const handleSwipeRight = useCallback(() => {
    if (!isLoggedIn) {
      setPendingSwipe(true);
      return;
    }
    const entry = activeEntries[index];
    if (entry && !reviewed) {
      setIsVoting(true);
      castVote(entry.id, entry.challengeId);
    } else {
      setIsVoting(true);
    }
    setTimeout(() => {
      setIsVoting(false);
      setIndex(prev => prev + 1);
      translateX.value = 0;
      translateY.value = 0;
      processingRef.current = false;
    }, 500);
  }, [index, activeEntries, castVote, reviewed, isLoggedIn]);

  const handleSwipeLeft = useCallback(() => {
    setIsSkipping(true);
    setTimeout(goNext, 400);
  }, [goNext]);

  const handleSwipeUp = useCallback(() => {
    goNext();
  }, [goNext]);

  const gesture = Gesture.Pan()
    .onUpdate(e => {
      if (processingRef.current) return;
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(e => {
      if (processingRef.current) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        return;
      }
      if (e.translationX > SWIPE_THRESHOLD) {
        processingRef.current = true;
        translateX.value = withTiming(width * 1.5, { duration: 300 });
        runOnJS(handleSwipeRight)();
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        processingRef.current = true;
        translateX.value = withTiming(-width * 1.5, { duration: 300 });
        runOnJS(handleSwipeLeft)();
      } else if (e.translationY < -SWIPE_THRESHOLD) {
        processingRef.current = true;
        translateY.value = withTiming(-height * 1.5, { duration: 300 });
        runOnJS(handleSwipeUp)();
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const animStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width / 2, 0, width / 2],
      [-8, 0, 8],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      Math.abs(translateX.value),
      [0, width / 2],
      [1, 0.9],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });

  const handleExitReview = useCallback(() => {
    setReviewed(false);
    setIndex(0);
    translateX.value = 0;
    translateY.value = 0;
    processingRef.current = false;
    setIsVoting(false);
    setIsSkipping(false);
    refresh();
  }, [refresh, translateX, translateY]);

  useEffect(() => {
    if (pendingSwipe) {
      setPendingSwipe(false);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      setShowAuthPrompt(true);
    }
  }, [pendingSwipe]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff286a" size="large" />
      </View>
    );
  }

  // ✅ Sem entradas de todo — mensagem agora fala de "participantes", não de "desafio"
  if (allEntries.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        {activeChallenge && (
          <View style={styles.bannerOverlay}>
            <ActiveChallengeBanner challenge={activeChallenge} />
          </View>
        )}
        {isLoggedIn && (
  <View style={styles.snapsWrap}>
    <SnapsCounter />
  </View>
)}
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
          <LinearGradient colors={['#ff286a', '#ff8c5a']} style={styles.reviewBtnGrad}>
            <Text style={styles.reviewBtnText}>🚀 Participar agora</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!reviewed && freshEntries.length === 0 && allEntries.length > 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyEmoji}>✅</Text>
        <Text style={styles.emptyTitle}>Já votaste em tudo!</Text>
        <Text style={styles.emptySub}>
          Já votaste em todas as participações disponíveis.{'\n'}
          Podes rever os conteúdos que já viste.
        </Text>
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() => {
            setReviewed(true);
            setIndex(0);
            translateX.value = 0;
            translateY.value = 0;
            processingRef.current = false;
          }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#1a1a1a', '#2a2a2a']} style={styles.reviewBtnGrad}>
            <Text style={styles.reviewBtnText}>👀 Ver conteúdos</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!reviewed && index >= freshEntries.length && freshEntries.length > 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyEmoji}>✅</Text>
        <Text style={styles.emptyTitle}>Viste tudo por agora!</Text>
        <Text style={styles.emptySub}>
          Já votaste em tudo o que havia.{'\n'}
          Podes rever os conteúdos mas não podes votar novamente.
        </Text>
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() => {
            setReviewed(true);
            setIndex(0);
            translateX.value = 0;
            translateY.value = 0;
            processingRef.current = false;
          }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#1a1a1a', '#2a2a2a']} style={styles.reviewBtnGrad}>
            <Text style={styles.reviewBtnText}>👀 Rever conteúdos</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (reviewed && index >= allEntries.length) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyEmoji}>🎉</Text>
        <Text style={styles.emptyTitle}>Revisão concluída!</Text>
        <Text style={styles.emptySub}>
          Já viste todas as entradas.{'\n'}
          Volta mais tarde para novos conteúdos.
        </Text>
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() => {
            setReviewed(false);
            setIndex(0);
            translateX.value = 0;
            translateY.value = 0;
            refresh();
          }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#ff286a', '#ff8c5a']} style={styles.reviewBtnGrad}>
            <Text style={styles.reviewBtnText}>🔄 Actualizar feed</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!activeEntries[index]) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff286a" size="large" />
      </View>
    );
  }

  const entry = activeEntries[index];
  const nextEntry = activeEntries[index + 1];

  return (
    <View style={styles.container}>
      {nextEntry && (
        <View style={[StyleSheet.absoluteFill, styles.nextCard]}>
          <FeedCard
            entry={nextEntry}
            isVoting={false}
            isSkipping={false}
            reviewed={reviewed}
            isActive={false}
          />
        </View>
      )}

      <GestureDetector gesture={gesture}>
        <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
          <FeedCard
            entry={entry}
            isVoting={isVoting}
            isSkipping={isSkipping}
            reviewed={reviewed}
            isActive={isFocused}
          />
        </Animated.View>
      </GestureDetector>

      {activeChallenge && (
        <View style={styles.bannerOverlay}>
          <ActiveChallengeBanner challenge={activeChallenge} />
        </View>
      )}

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((index + 1) / activeEntries.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {index + 1} / {activeEntries.length}
        </Text>
      </View>

      <AuthPrompt
        visible={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        action="votar"
      />

      {/* ✅ comentário JSX corrigido */}
      <OnboardingModal
        visible={showOnboarding}
        onClose={handleCloseOnboarding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  nextCard: { transform: [{ scale: 0.95 }], opacity: 0.7 },
  center: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: 32,
  },
  snapsWrap: {
  position: 'absolute',
  top: 14,
  right: 14,
  zIndex: 30,
},
  bannerOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptySub: { color: '#888', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  reviewBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, width: '80%' },
  reviewBtnGrad: { paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#333', borderRadius: 14 },
  reviewBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_500Medium' },
  progressContainer: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
  progressBar: { width: '100%', height: 3, backgroundColor: '#222', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#ff286a', borderRadius: 2 },
  progressText: { color: '#888', fontSize: 12, marginTop: 8, fontFamily: 'Inter_400Regular' },
});