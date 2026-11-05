import { router } from 'expo-router';
import { get, ref } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { colors, fonts, radius } from '../constants/theme';
import { useProfiles } from '../hooks/useScopedData';
import { auth, db } from '../services/firebase';
import {
  inviteByPhone, inviteMessage, normalizeMzPhone, useActiveInviteCampaign, useInviteRanking, useMyInviteProgress,
} from '../services/invites';

const maskPhone = (key: string) => `+${key.slice(0, 3)} ${key.slice(3, 5)} ••• ${key.slice(-3)}`;

export default function InviteFriendsScreen() {
  const { campaign, loading } = useActiveInviteCampaign();
  const uid = auth.currentUser?.uid;
  const { count, sent } = useMyInviteProgress(campaign?.id);
  const ranking = useInviteRanking(campaign?.id, 50);
  const profiles = useProfiles(useMemo(() => ranking.map(r => r.uid), [ranking]));
  const [username, setUsername] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!uid) return;
    get(ref(db, `publicProfiles/${uid}/username`)).then(s => setUsername(s.val() || null)).catch(() => undefined);
  }, [uid]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!campaign) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />
        <View style={styles.center}><Text style={styles.muted}>Não há nenhum desafio de convites a decorrer.</Text></View>
      </SafeAreaView>
    );
  }

  const myPosition = uid ? ranking.findIndex(r => r.uid === uid) + 1 : 0;
  const daysLeft = Math.max(0, Math.ceil((campaign.endsAt - Date.now()) / 86400000));
  const progress = Math.min(1, count / Math.max(campaign.goal, 1));

  const sendInvite = async () => {
    const key = normalizeMzPhone(phone);
    if (!key) {
      toast.error('Número inválido', { description: 'Usa um número moçambicano, por exemplo 84 123 4567.' });
      return;
    }
    if (!username) return;
    setSending(true);
    try {
      await inviteByPhone(campaign, key, username);
      setPhone('');
      toast.success('Convite registado', { description: 'Quando o teu amigo criar conta, conta para ti automaticamente.' });
    } catch (e: any) {
      toast.error('Não foi possível convidar', { description: e.message });
    } finally {
      setSending(false);
    }
  };

  const shareLink = async () => {
    if (!username) return;
    await Share.share({ message: inviteMessage(campaign, username) }).catch(() => undefined);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{campaign.title}</Text>
            <Text style={styles.heroPrize}>🎁 {campaign.prize}</Text>
            <Text style={styles.muted}>Termina em {daysLeft} dia{daysLeft === 1 ? '' : 's'}</Text>
          </View>

          {!uid ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.primaryBtnText}>Entrar para participar</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>O teu progresso</Text>
                  <Text style={styles.big}>{count}/{campaign.goal}</Text>
                </View>
                <View style={styles.bar}><View style={[styles.barFill, { width: `${progress * 100}%` }]} /></View>
                <Text style={styles.muted}>
                  {myPosition ? `Estás em ${myPosition}.º lugar.` : 'Convida o primeiro amigo para entrares no ranking.'}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Convidar pelo número</Text>
                <Text style={styles.muted}>
                  Abre o WhatsApp do teu amigo com o convite. Quando ele criar conta com este número, conta para ti.
                </Text>
                <View style={styles.inputRow}>
                  <Text style={styles.prefix}>+258</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="84 123 4567"
                    placeholderTextColor={colors.textSubtle}
                    keyboardType="phone-pad"
                    maxLength={16}
                  />
                </View>
                <TouchableOpacity style={[styles.primaryBtn, (sending || !username) && styles.disabled]} disabled={sending || !username} onPress={sendInvite}>
                  <Text style={styles.primaryBtnText}>{sending ? 'A registar…' : 'Convidar pelo WhatsApp'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} disabled={!username} onPress={shareLink}>
                  <Text style={styles.secondaryBtnText}>Partilhar o meu link</Text>
                </TouchableOpacity>
                {sent.length > 0 && (
                  <Text style={styles.muted}>
                    Convidaste {sent.length} número{sent.length === 1 ? '' : 's'}: {sent.slice(-3).map(maskPhone).join(', ')}
                    {sent.length > 3 ? '…' : ''}
                  </Text>
                )}
              </View>
            </>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ranking</Text>
            {ranking.length === 0 && <Text style={styles.muted}>Ainda ninguém convidou amigos.</Text>}
            {ranking.map((row, i) => {
              const p = profiles[row.uid];
              const me = row.uid === uid;
              return (
                <View key={row.uid} style={[styles.rankRow, me && styles.rankMe]}>
                  <Text style={styles.rankPos}>{i + 1}</Text>
                  {p?.avatar
                    ? <Image source={{ uri: p.avatar }} style={styles.avatar} />
                    : <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarLetter}>{(p?.username || '?').charAt(0).toUpperCase()}</Text></View>}
                  <Text style={styles.rankName} numberOfLines={1}>@{p?.username || '…'}{me ? ' (tu)' : ''}</Text>
                  <Text style={styles.rankCount}>{row.count}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Regras</Text>
            {[
              `Ganha quem chegar primeiro a ${campaign.goal} amigos válidos. Se ninguém chegar até ao fim do prazo, ganha quem tiver mais, com um mínimo de ${campaign.minimum}.`,
              'Um amigo é válido quando cria uma conta nova durante o desafio, confirma o número por SMS e completa o perfil.',
              'Cada número só conta uma vez. Se mais do que uma pessoa convidar o mesmo número, conta para quem convidou primeiro.',
              'Contas falsas ou repetidas são anuladas e podem levar à desqualificação. O vencedor é confirmado pela VotaSnap antes de receber o prémio.',
              'O número do teu amigo é usado só para atribuir o convite e nunca é mostrado a outras pessoas.',
            ].map(rule => <Text key={rule} style={styles.rule}>• {rule}</Text>)}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={12}>
        <Text style={styles.back}>‹ Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Convidar amigos</Text>
      <View style={{ width: 60 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back: { color: colors.primary, fontFamily: fonts.medium, fontSize: 15, width: 60 },
  headerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  heroTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 22, textAlign: 'center' },
  heroPrize: { color: colors.primaryEnd, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cardTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  big: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  muted: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  prefix: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 15, paddingLeft: 14 },
  input: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingHorizontal: 10, paddingVertical: 12 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  secondaryBtn: { borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.borderStrong },
  secondaryBtnText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  disabled: { opacity: 0.5 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: radius.sm },
  rankMe: { backgroundColor: 'rgba(255,40,106,0.12)' },
  rankPos: { color: colors.textSecondary, fontFamily: fonts.semibold, width: 24, textAlign: 'right' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarEmpty: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.text, fontFamily: fonts.bold },
  rankName: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  rankCount: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  rule: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
});
