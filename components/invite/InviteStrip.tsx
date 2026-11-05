import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/theme';
import { InviteCampaign, useMyInviteProgress } from '../../services/invites';
import { auth } from '../../services/firebase';

const daysLeft = (endsAt: number) => Math.max(0, Math.ceil((endsAt - Date.now()) / 86400000));

// Faixa compacta no topo do feed enquanto há um desafio de convites activo.
export default function InviteStrip({ campaign }: { campaign: InviteCampaign }) {
  const { count } = useMyInviteProgress(campaign.id);
  const loggedIn = !!auth.currentUser;
  const progress = Math.min(1, count / Math.max(campaign.goal, 1));

  return (
    <TouchableOpacity style={styles.wrap} activeOpacity={0.85} onPress={() => router.push('/invite-friends')}>
      <Text style={styles.icon}>🤝</Text>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {campaign.title} · {daysLeft(campaign.endsAt)}d
        </Text>
        {loggedIn ? (
          <View style={styles.barRow}>
            <View style={styles.bar}><View style={[styles.barFill, { width: `${progress * 100}%` }]} /></View>
            <Text style={styles.count}>{count}/{campaign.goal}</Text>
          </View>
        ) : (
          <Text style={styles.sub} numberOfLines={1}>Prémio: {campaign.prize}</Text>
        )}
      </View>
      <Text style={styles.cta}>Convidar ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  icon: { fontSize: 18 },
  body: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  sub: { color: colors.textSecondary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  count: { color: colors.text, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cta: { color: colors.primary, fontSize: 12, fontFamily: 'Inter_700Bold' },
});
