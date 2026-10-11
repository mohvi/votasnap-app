import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSnaps } from '../../hooks/useSnaps';
import { colors } from '../../constants/theme';

export default function SnapsCounter() {
  const { snaps, justEarned } = useSnaps();
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (justEarned) {
      // Bounce no contador
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.spring(bounceAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();

      // Texto "+X" flutua para cima e desaparece
      floatAnim.setValue(0);
      floatOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(floatAnim, { toValue: -40, duration: 1200, useNativeDriver: true }),
        Animated.timing(floatOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]).start();
    }
  }, [justEarned]);

  return (
    <View style={styles.wrap}>
      {justEarned && (
        <Animated.View
          style={[
            styles.floatBadge,
            {
              opacity: floatOpacity,
              transform: [{ translateY: floatAnim }],
            },
          ]}
        >
          <Text style={styles.floatText}>+{justEarned} 🪙</Text>
        </Animated.View>
      )}

      <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
        <LinearGradient
          colors={[colors.gold, colors.warning]}
          style={styles.badge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.icon}>🪙</Text>
          <Text style={styles.count}>{snaps}</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  icon: { fontSize: 13 },
  count: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  floatBadge: {
    position: 'absolute',
    top: -8,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 50,
  },
  floatText: {
    color: colors.gold,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
});