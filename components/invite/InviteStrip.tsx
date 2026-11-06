import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../../constants/theme';
import { InviteCampaign, useMyInviteProgress } from '../../services/invites';
import { auth } from '../../services/firebase';

const daysLeft = (endsAt: number) => Math.max(0, Math.ceil((endsAt - Date.now()) / 86400000));

// Faixa no topo do feed enquanto há um desafio de convites activo.
// `compact` mostra só uma pílula pequena, para quando o banner está minimizado.
export default function InviteStrip({ campaign, compact }: { campaign: InviteCampaign; compact?: boolean }) {
  const { count } = useMyInviteProgress(campaign.id);
  const loggedIn = !!auth.currentUser;
  const progress = Math.min(1, count / Math.max(campaign.goal, 1));
  const open = () => router.push('/invite-friends');

  if (compact) {
    return (
      <TouchableOpacity style={styles.pill} activeOpacity={0.85} onPress={open} accessibilityRole="button" accessibilityLabel={`${campaign.title}: convidar amigos`}>
        <Ionicons name="people" size={13} color={colors.primary} />
        <Text style={styles.pillText} numberOfLines={1}>
          {loggedIn ? `${count}/${campaign.goal}` : 'Convidar'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.wrap} activeOpacity={0.85} onPress={open} accessibilityRole="button">
      <View style={styles.iconWrap}>
        <Ionicons name="people" size={16} color={colors.primary} />
      </View>
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
      <Text style={styles.cta}>Convidar</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ marginLeft: -6 }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,40,106,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 13, fontFamily: fonts.semibold },
  sub: { color: colors.textSecondary, fontSize: 11, fontFamily: fonts.regular, marginTop: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  count: { color: colors.text, fontSize: 11, fontFamily: fonts.semibold },
  cta: { color: colors.primary, fontSize: 12, fontFamily: fonts.bold },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillText: { color: colors.text, fontSize: 12, fontFamily: fonts.semibold },
});
