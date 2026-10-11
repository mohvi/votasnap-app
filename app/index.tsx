import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { Animated, Image, StyleSheet, Text } from 'react-native';
import { auth } from '../services/firebase';
import { colors, gradients } from '../constants/theme';
const logo = require('../assets/images/logo.png');

export default function SplashScreenPage() {
  const opacity = new Animated.Value(0);
  const scale = new Animated.Value(0.8);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      // Verifica se tem sessão activa
      const unsubscribe = onAuthStateChanged(auth, user => {
        unsubscribe();
        if (user) {
          // Tem sessão — vai para o feed
          router.replace('/(tabs)');
        } else {
          // Sem sessão — vai para o feed como visitante
          router.replace('/(tabs)');
        }
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={[colors.background, '#1A0A2E', colors.background]}
      style={styles.container}
    >
      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        <LinearGradient
          colors={gradients.primary}
          style={styles.logoBox}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
      <Image
        source={logo}
        style={styles.logoEmoji}
      />
      </LinearGradient>
        <Text style={styles.logoText}>VotaSnap</Text>
        <Text style={styles.logoSub}>Postar | Ganhar | Bazar</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logoWrap: {
    alignItems: 'center',
    gap: 16,
  },
  
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { width: 225, height: 225, resizeMode: 'contain' },
  logoText: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
});