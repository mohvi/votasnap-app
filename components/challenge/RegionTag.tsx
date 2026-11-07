import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { regionLabel } from '../../services/demographics';

// "Só em Sofala" nos desafios regionais. Nada nos nacionais.
export function RegionTag({ challenge, style }: { challenge: Parameters<typeof regionLabel>[0]; style?: any }) {
  const label = regionLabel(challenge);
  if (!label) return null;
  return (
    <View style={[styles.row, style]}>
      <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
      <Text style={styles.text} numberOfLines={1}>Só em {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  text: { color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium', flexShrink: 1 },
});
