import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useActiveChallenge } from '../../hooks/useActiveChallenge';

function TabIcon({
  icon, label, focused
}: {
  icon: string; label: string; focused: boolean;
}) {
  return (
    <View style={tabStyles.wrap}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconFocused]}>
        {icon}
      </Text>
      {label !== '' && (
        <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>
          {label}
        </Text>
      )}
    </View>
  );
}

function CreateButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={['#ff286a', '#ff8c5a']}
        style={tabStyles.createBtn}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={tabStyles.createIcon}>+</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { challenge } = useActiveChallenge();

  const handleCreatePress = () => {
    if (!challenge) {
      // Sem desafio activo — não há nada para submeter
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
          borderTopColor: '#1a1a1a',
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#555',
        tabBarShowLabel: false,
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" label="" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: () => <CreateButton onPress={handleCreatePress} />,
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
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏆" label="" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" label="" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 3,
  },
  icon: {
    fontSize: 22,
    opacity: 0.4,
  },
  iconFocused: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: '#555',
  },
  labelFocused: {
    color: '#fff',
    fontFamily: 'Inter_500Medium',
  },
  createBtn: {
    width: 48,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIcon: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    lineHeight: 28,
  },
});