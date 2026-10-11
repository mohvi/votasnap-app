import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, router } from 'expo-router';
import { ColorValue, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { useActiveChallenge } from '../../hooks/useActiveChallenge';
import { colors, fonts, gradients } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  );
}

function CreateButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Participar no desafio"
      accessibilityState={{ disabled }}
      style={disabled && tabStyles.createDisabled}
    >
      <LinearGradient
        colors={gradients.primary}
        style={tabStyles.createBtn}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { challenge } = useActiveChallenge();
  const insets = useSafeAreaInsets();

  const handleCreatePress = () => {
    if (!challenge) {
      toast('Não há nenhum desafio activo neste momento', {
        description: 'Volta mais tarde para participar no próximo.',
      });
      return;
    }
    router.push({
      pathname: '/challenge/submit',
      params: { id: challenge.id, title: challenge.title },
    });
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopWidth: 0.5,
          borderTopColor: colors.surface,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.medium },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Participar',
          tabBarShowLabel: false,
          tabBarAccessibilityLabel: 'Participar no desafio',
          tabBarIcon: () => <CreateButton onPress={handleCreatePress} disabled={!challenge} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault(); // impede a navegação normal da tab
            handleCreatePress();
          },
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{ title: 'Ranking', tabBarIcon: tabIcon('trophy', 'trophy-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  createBtn: {
    width: 52,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  createDisabled: {
    opacity: 0.45,
  },
});
