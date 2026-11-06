import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, gradients, radius, spacing } from '../constants/theme';
import { useDemographics } from '../hooks/DemographicsProvider';
import { ageFrom, INTERESTS, MIN_APP_AGE, saveBirthDate, saveInterests, toBirthDate } from '../services/demographics';
import { auth } from '../services/firebase';

// Data de nascimento (obrigatória, uma vez) e interesses (opcionais, editáveis).
// `next=tabs` → depois de guardar vai para o feed; senão volta atrás.
export default function AboutYouScreen() {
  const { next, reason } = useLocalSearchParams<{ next?: string; reason?: string }>();
  const { birthDate: savedBirthDate, interests: savedInterests, loaded } = useDemographics();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (loaded && !initialised.current) {
      initialised.current = true;
      setSelected(savedInterests);
    }
  }, [loaded, savedInterests]);

  const toggle = (key: string) =>
    setSelected(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const finish = () => {
    if (next === 'tabs' || !router.canGoBack()) router.replace('/(tabs)');
    else router.back();
  };

  const handleSave = async () => {
    setError('');
    let birthDate = savedBirthDate;
    if (!birthDate) {
      birthDate = toBirthDate(day, month, year);
      const age = ageFrom(birthDate);
      if (!birthDate || age === null || Number(year) < 1900) {
        setError('Escreve uma data de nascimento válida (dia, mês e ano).');
        return;
      }
      if (age < MIN_APP_AGE) {
        setError(`A VotaSnap é para maiores de ${MIN_APP_AGE} anos.`);
        await signOut(auth).catch(() => {});
        router.replace('/(tabs)');
        return;
      }
    }
    setSaving(true);
    try {
      if (!savedBirthDate && birthDate) await saveBirthDate(birthDate);
      await saveInterests(selected);
      finish();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível guardar. Tenta novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {router.canGoBack() && next !== 'tabs' && (
            <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Voltar">
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          )}

          <Text style={styles.title}>Sobre ti</Text>
          <Text style={styles.subtitle}>
            {reason === 'age'
              ? 'Este desafio tem idade mínima. Indica a tua data de nascimento para participar.'
              : 'Ajuda-nos a mostrar-te os desafios certos. Só a equipa VotaSnap vê estes dados.'}
          </Text>

          <Text style={styles.section}>Data de nascimento</Text>
          {savedBirthDate ? (
            <View style={styles.savedRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.savedText}>{savedBirthDate.split('-').reverse().join('/')}</Text>
              <Text style={styles.savedHint}>Para corrigir, contacta o suporte.</Text>
            </View>
          ) : (
            <>
              <View style={styles.dateRow}>
                <TextInput
                  style={[styles.dateInput, { flex: 1 }]} placeholder="Dia" placeholderTextColor={colors.textSubtle}
                  keyboardType="number-pad" maxLength={2} value={day}
                  onChangeText={t => { setDay(t.replace(/\D/g, '')); if (t.length === 2) monthRef.current?.focus(); }}
                  accessibilityLabel="Dia de nascimento"
                />
                <TextInput
                  ref={monthRef} style={[styles.dateInput, { flex: 1 }]} placeholder="Mês" placeholderTextColor={colors.textSubtle}
                  keyboardType="number-pad" maxLength={2} value={month}
                  onChangeText={t => { setMonth(t.replace(/\D/g, '')); if (t.length === 2) yearRef.current?.focus(); }}
                  accessibilityLabel="Mês de nascimento"
                />
                <TextInput
                  ref={yearRef} style={[styles.dateInput, { flex: 1.5 }]} placeholder="Ano" placeholderTextColor={colors.textSubtle}
                  keyboardType="number-pad" maxLength={4} value={year}
                  onChangeText={t => setYear(t.replace(/\D/g, ''))}
                  accessibilityLabel="Ano de nascimento"
                />
              </View>
              <Text style={styles.hint}>
                Alguns desafios (por exemplo, de bebidas alcoólicas) são só para maiores de 18. A idade é confirmada com o BI na entrega do prémio.
              </Text>
            </>
          )}

          <Text style={styles.section}>Do que gostas? <Text style={styles.optional}>(opcional)</Text></Text>
          <View style={styles.chips}>
            {INTERESTS.map(item => {
              const active = selected.includes(item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => toggle(item.key)}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                >
                  <Ionicons name={item.icon as any} size={16} color={active ? colors.text : colors.textSecondary} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={styles.btnWrap}>
            <LinearGradient colors={gradients.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {saving ? <ActivityIndicator color={colors.text} /> : <Text style={styles.btnText}>Guardar</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: 48 },
  back: { marginBottom: spacing.md, alignSelf: 'flex-start' },
  title: { color: colors.text, fontSize: 26, fontFamily: fonts.bold, marginBottom: spacing.sm },
  subtitle: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginBottom: spacing.xl },
  section: { color: colors.text, fontSize: 15, fontFamily: fonts.semibold, marginBottom: spacing.md, marginTop: spacing.sm },
  optional: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateInput: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontFamily: fonts.medium, fontSize: 16, paddingVertical: 14, textAlign: 'center',
    minWidth: 0, width: 0,
  },
  hint: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, lineHeight: 17, marginTop: spacing.sm, marginBottom: spacing.xl },
  savedRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
  },
  savedText: { color: colors.text, fontSize: 15, fontFamily: fonts.semibold },
  savedHint: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, width: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.medium },
  chipTextActive: { color: colors.text },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium, marginBottom: spacing.md },
  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btn: { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
});
