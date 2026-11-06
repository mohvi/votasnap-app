import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { onValue, ref, remove, set, serverTimestamp } from 'firebase/database';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { toast } from 'sonner-native';
import { colors, fonts } from '../../constants/theme';
import { auth, db } from '../../services/firebase';

const storageKey = (challengeId: string) => `reminder:${challengeId}`;

// "Avisa-me": agenda uma notificação local para a hora de abertura
// (funciona sem servidor) e regista o pedido em challengeReminders/, para
// a marca saber quantas pessoas estavam à espera do lançamento.
export default function ReminderButton({
  challengeId, title, startsAt, compact, onNeedLogin,
}: {
  challengeId: string;
  title: string;
  startsAt: number;
  compact?: boolean;
  onNeedLogin?: () => void;
}) {
  const uid = auth.currentUser?.uid;
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = !!uid && subscribed;

  useEffect(() => {
    if (!uid) return undefined;
    return onValue(ref(db, `challengeReminders/${challengeId}/${uid}`), snap => setSubscribed(snap.exists()), () => {});
  }, [challengeId, uid]);

  const schedule = async () => {
    if (Platform.OS === 'web') return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) {
        toast('Ativa as notificações para receberes o aviso.');
        return;
      }
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'O desafio abriu!',
        body: `"${title}" já está aberto. Participa agora.`,
        data: { url: `/challenge/${challengeId}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(startsAt), channelId: 'default' },
    });
    await AsyncStorage.setItem(storageKey(challengeId), id);
  };

  const cancel = async () => {
    const id = await AsyncStorage.getItem(storageKey(challengeId));
    if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(storageKey(challengeId));
  };

  const toggle = async () => {
    if (!uid) { onNeedLogin?.(); return; }
    setBusy(true);
    try {
      if (active) {
        await remove(ref(db, `challengeReminders/${challengeId}/${uid}`));
        await cancel().catch(() => {});
        toast('Aviso cancelado.');
      } else {
        await set(ref(db, `challengeReminders/${challengeId}/${uid}`), serverTimestamp());
        await schedule().catch(e => console.warn('Não foi possível agendar o aviso:', e));
        toast.success('Combinado! Avisamos-te quando abrir.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível guardar. Tenta novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={busy}
      activeOpacity={0.85}
      style={[styles.btn, compact && styles.compact, active && styles.active]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? 'Cancelar aviso' : 'Avisa-me quando abrir'}
    >
      {busy ? <ActivityIndicator size="small" color={active ? colors.text : colors.primary} /> : (
        <Ionicons name={active ? 'notifications' : 'notifications-outline'} size={compact ? 14 : 16} color={active ? colors.text : colors.primary} />
      )}
      <Text style={[styles.text, compact && styles.textCompact, active && styles.textActive]}>
        {active ? 'Vais ser avisado' : 'Avisa-me'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.primary,
  },
  compact: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  active: { backgroundColor: colors.primary },
  text: { color: colors.primary, fontSize: 14, fontFamily: fonts.bold },
  textCompact: { fontSize: 12 },
  textActive: { color: colors.text },
});
