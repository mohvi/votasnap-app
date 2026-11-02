import { Image, StyleSheet, Text, TextStyle, View } from 'react-native';

// Nome da marca patrocinadora, com o logótipo quando o painel o definiu.
export function SponsorName({ name, logo, textStyle }: { name: string; logo?: string | null; textStyle?: TextStyle }) {
  return (
    <View style={styles.row}>
      {logo ? <Image source={{ uri: logo }} style={styles.logo} /> : <Text style={textStyle}>📢</Text>}
      <Text style={textStyle} numberOfLines={1}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logo: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#fff' },
});
