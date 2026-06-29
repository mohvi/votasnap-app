import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
export default function CreateScreen() {
  return (
    <View style={styles.container}>
<TouchableOpacity onPress={() => router.push('/entry/-OvTY_KHBFHJTNEm3qwE/-OvVymMhKB00vp1_d_Kw')}>
  <Text style={{ color: 'white' }}>TESTE ROTA</Text>
</TouchableOpacity>    
</View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontFamily: 'Inter_400Regular', fontSize: 16 },
});