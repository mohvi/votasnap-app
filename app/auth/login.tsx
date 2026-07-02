import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { resendCode, sendCode, verifyCode } from '../../services/auth';
const logo = require('../../assets/images/logo.png');

// ── Anti-fraude: captura de IP público no momento do OTP ──
// Não identifica o aparelho (sem fingerprint), só a rede de origem.
// Usado no backend para detetar várias contas criadas a partir do mesmo IP
// num curto espaço de tempo (signup_logs/{uid}).
const getPublicIp = async (): Promise<string | null> => {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip ?? null;
  } catch {
    return null; // falha de rede não deve bloquear o login
  }
};

export default function LoginScreen() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [signupIp, setSignupIp] = useState<string | null>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => setResendTimer(p => p - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  const formatDisplay = (value: string) => {
    const n = value.replace(/\D/g, '');
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0, 2)} ${n.slice(2)}`;
    if (n.length <= 8) return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
    return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  };

  const isValidPhone = (p: string) => p.replace(/\D/g, '').length >= 9;

  const handleSendCode = async () => {
    if (!isValidPhone(phone) || loading) return;
    setError('');
    setLoading(true);
    try {
      // Captura o IP em paralelo ao envio do código — não atrasa o fluxo
      // se a captura falhar, signupIp fica null e o backend só ignora o sinal.
      const ipPromise = getPublicIp();
      await sendCode(phone.replace(/\D/g, ''));
      setSignupIp(await ipPromise);
      setStep('code');
      setResendTimer(60);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length < 6 || loading) return;
    setError('');
    setLoading(true);
    try {
      // signupIp e phoneVerifiedAt seguem para o backend junto da verificação,
      // para serem gravados em users/{uid}.phoneVerifiedAt e signup_logs/{uid}
      // no mesmo passo que cria/autentica a conta — evita uma segunda chamada
      // e garante que nunca existe conta sem este registo.
      const result = await verifyCode(phone.replace(/\D/g, ''), code, {
        signupIp,
        phoneVerifiedAt: Date.now(),
      });
      if (result.isNewUser) {
        router.replace('/auth/setup-profile');
      } else {
        router.replace(result.profileComplete ? '/(tabs)' : '/auth/setup-profile');
      }
    } catch (e: any) {
      setError(e.message);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const waitTime = await resendCode(phone.replace(/\D/g, ''));
      if (waitTime) setResendTimer(waitTime);
      else setResendTimer(60);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoWrap}>
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.logoBox}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
            >
      <Image
        source={logo}
        style={styles.logoEmoji}
      />       
     </LinearGradient>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.appName}>Votasnap</Text>
          <Text style={styles.appSlogan}>Postar | Ganhar | Bazar</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <LinearGradient
            colors={['#ff286a', '#ff8c5a']}
            style={styles.cardHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.cardHeaderTitle}>
              {step === 'phone' ? 'Entrar ou cadastrar' : 'Confirmar código'}
            </Text>
            {step === 'code' && (
              <Text style={styles.cardHeaderSub}>
                Enviamos para +258 {formatDisplay(phone)}
              </Text>
            )}
          </LinearGradient>

          <View style={styles.cardBody}>

            {/* Erro */}
            {error !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {step === 'phone' ? (
              <>
                <View style={styles.phoneInputWrap}>
                  <View style={styles.phonePrefix}>
                    <Text style={styles.phonePrefixText}>+258</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="84 123 4567"
                    placeholderTextColor="#555"
                    keyboardType="phone-pad"
                    value={formatDisplay(phone)}
                    onChangeText={t => setPhone(t.replace(/\D/g, ''))}
                    editable={!loading}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  onPress={handleSendCode}
                  disabled={loading || !isValidPhone(phone)}
                  activeOpacity={0.85}
                  style={[styles.btnWrap, !isValidPhone(phone) && styles.btnDisabled]}
                >
                  <LinearGradient
                    colors={['#ff286a', '#ff8c5a']}
                    style={styles.btn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnText}>Continuar</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.terms}>
                  Ao continuar, concordas com os nossos{' '}
                  <Text style={styles.termsLink}>Termos</Text>
                  {' '}e{' '}
                  <Text style={styles.termsLink}>Política</Text>
                </Text>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => { setStep('phone'); setCode(''); setError(''); }}
                  style={styles.backBtn}
                  disabled={loading}
                >
                  <Text style={styles.backText}>← Alterar número</Text>
                </TouchableOpacity>

                <View style={styles.dotsRow}>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <View key={i} style={[styles.dot, code.length > i && styles.dotFilled]} />
                  ))}
                </View>

                <TextInput
                  style={styles.codeInput}
                  placeholder="000000"
                  placeholderTextColor="#555"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  textAlign="center"
                  editable={!loading}
                  autoFocus
                />

                <TouchableOpacity
                  onPress={handleVerifyCode}
                  disabled={loading || code.length < 6}
                  activeOpacity={0.85}
                  style={[styles.btnWrap, code.length < 6 && styles.btnDisabled]}
                >
                  <LinearGradient
                    colors={['#ff286a', '#ff8c5a']}
                    style={styles.btn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnText}>Entrar</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                {resendTimer > 0 ? (
                  <Text style={styles.resendTimer}>⏱ Reenviar em {resendTimer}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} disabled={loading}>
                    <Text style={styles.resendLink}>Não recebi o código</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        <Text style={styles.footer}>© 2026 Votasnap • Todos os direitos reservados</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40, alignItems: 'center' },
  logoSection: { alignItems: 'center', marginBottom: 32, gap: 8 },
  logoWrap: { position: 'relative', marginBottom: 8 },
  logoBox: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '3deg' }] },
  logoEmoji: { width: 225, height: 225, resizeMode: 'contain' },
  logoDot: { position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#3b82f6', borderWidth: 2, borderColor: '#000' },
  appName: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: -0.5 },
  appSlogan: { fontSize: 13, color: '#888', fontFamily: 'Inter_400Regular', letterSpacing: 0.5 },
  card: { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: '#2a2a2a' },
  cardHeader: { paddingHorizontal: 24, paddingVertical: 18 },
  cardHeaderTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  cardHeaderSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  cardBody: { padding: 24, gap: 12 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 0.5, borderColor: '#ef4444', borderRadius: 10, padding: 12 },
  errorText: { color: '#ef4444', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  phoneInputWrap: { flexDirection: 'row', backgroundColor: '#2a2a2a', borderRadius: 14, borderWidth: 0.5, borderColor: '#3a3a3a', overflow: 'hidden' },
  phonePrefix: { paddingHorizontal: 16, justifyContent: 'center', borderRightWidth: 0.5, borderRightColor: '#3a3a3a' },
  phonePrefixText: { color: '#888', fontFamily: 'Inter_500Medium', fontSize: 15 },
  phoneInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 18, color: '#fff', fontFamily: 'Inter_400Regular', fontSize: 17 },
  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.4 },
  btn: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  terms: { textAlign: 'center', fontSize: 12, color: '#555', fontFamily: 'Inter_400Regular' },
  termsLink: { color: '#ff286a' },
  backBtn: { marginBottom: 4 },
  backText: { color: '#ff286a', fontFamily: 'Inter_500Medium', fontSize: 14 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#3a3a3a' },
  dotFilled: { backgroundColor: '#ff286a', borderColor: '#ff286a' },
  codeInput: { backgroundColor: '#2a2a2a', borderRadius: 14, borderWidth: 0.5, borderColor: '#3a3a3a', paddingVertical: 20, color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 14 },
  resendTimer: { textAlign: 'center', color: '#555', fontSize: 13, fontFamily: 'Inter_400Regular' },
  resendLink: { textAlign: 'center', color: '#ff286a', fontSize: 14, fontFamily: 'Inter_500Medium' },
  footer: { marginTop: 24, color: '#333', fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});