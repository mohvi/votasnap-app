import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { get, ref, serverTimestamp, set } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticatedRequest, CHALLENGE_GATE_URL } from '../../services/api';
import { useDemographics } from '../../hooks/DemographicsProvider';
import { canAccessChallenge, challengeMinAge } from '../../services/demographics';
import { challengeStartsAt } from '../../hooks/useChallenges';
import { AgeLockedScreen } from '../../components/challenge/AgeNotice';
import { auth, db, storage } from '../../services/firebase';
import { colors, gradients } from '../../constants/theme';
import { toast } from 'sonner-native';

// ============================================================
// TIPOS
// ============================================================
interface ChallengeInfo {
  title: string;
  description: string;
  prize: string;
  prizeType: string;
  sponsor: string;
  sponsorId?: string | null;
  sponsorLogo?: string | null;
  endsAt: number;
  totalParticipants: number;
  coverImage?: string;
  allowedMediaType?: 'photo' | 'video' | 'both';
  type?: 'free' | 'sponsored';
  status: string;
  startsAt?: number | null;
  createdAt?: number;
  minAge?: number | null;
  alcohol?: boolean | null;
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function SubmitScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();

  // Estados do formulário
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [challengeInfo, setChallengeInfo] = useState<ChallengeInfo | null>(null);
  const { age } = useDemographics();
  // Consentimento para a marca do desafio contactar o participante (desmarcado por omissão).
  const [shareContact, setShareContact] = useState(false);

  const uid = auth.currentUser?.uid;

  // Mídia aceite pelo desafio
  const allowedMediaType = challengeInfo?.allowedMediaType || 'both';

  // ============================================================
  // CARREGAR DADOS DO DESAFIO
  // ============================================================
  useEffect(() => {
    const loadChallenge = async () => {
      if (!id) return;
      try {
        const snap = await get(ref(db, `challenges/${id}`));
        if (snap.exists()) {
          const data = snap.val();
          setChallengeInfo({ ...data, type: data.type === 'sponsored' ? 'sponsored' : 'free' });
        }
      } catch (e) {
        console.error('Erro ao carregar desafio:', e);
      }
    };
    loadChallenge();
  }, [id]);

  // ============================================================
  // VERIFICAR ENTRADA EXISTENTE
  // ============================================================
  useEffect(() => {
    const checkExisting = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || !id) {
        setCheckingExisting(false);
        return;
      }
      try {
        const entriesSnap = await get(ref(db, `entries/${id}`));
        if (entriesSnap.exists()) {
          const entries = Object.values(entriesSnap.val()) as any[];
          const hasEntry = entries.some(e => e.userId === uid);
          setAlreadySubmitted(hasEntry);
        }
      } catch (e) {
        console.error('Erro ao verificar entrada existente:', e);
      } finally {
        setCheckingExisting(false);
      }
    };
    checkExisting();
  }, [id]);

  // ============================================================
  // FUNÇÕES DE MÍDIA
  // ============================================================
  const pickPhotoFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.warning('Permissão necessária', { description: 'Precisamos de acesso à galeria para escolher uma foto.' });
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: false,
    });
    
    if (!result.canceled) {
      setMedia(result.assets[0].uri);
      setMediaType('photo');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickVideoFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.warning('Permissão necessária', { description: 'Precisamos de acesso à galeria para escolher um vídeo.' });
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 60,
    });
    
    if (!result.canceled) {
      setMedia(result.assets[0].uri);
      setMediaType('video');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const captureFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.warning('Permissão necessária', { description: 'Precisamos de acesso à câmara para tirar uma foto.' });
      return;
    }

    if (allowedMediaType === 'video') {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
      });
      if (!result.canceled) {
        setMedia(result.assets[0].uri);
        setMediaType('video');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setMedia(result.assets[0].uri);
      setMediaType('photo');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePickMedia = async () => {
    const options: { text: string; onPress?: () => void; style?: 'cancel' }[] = [];

    if (allowedMediaType === 'photo' || allowedMediaType === 'both') {
      options.push({ text: '📸 Foto da Galeria', onPress: pickPhotoFromGallery });
    }
    if (allowedMediaType === 'video' || allowedMediaType === 'both') {
      options.push({ text: '🎬 Vídeo da Galeria', onPress: pickVideoFromGallery });
    }
    options.push({ text: '📷 Câmara', onPress: captureFromCamera });
    options.push({ text: 'Cancelar', style: 'cancel' });

    const mediaLabel =
      allowedMediaType === 'photo' ? 'uma foto' :
      allowedMediaType === 'video' ? 'um vídeo' :
      'uma foto ou vídeo';

    Alert.alert('Escolher mídia', `Este desafio aceita ${mediaLabel}`, options);
  };

  // ============================================================
  // FUNÇÃO DE UPLOAD
  // ============================================================
  const uploadFileToStorage = useCallback(async (
    localUri: string,
    challengeId: string,
    userId: string
  ): Promise<string> => {
    try {
      const fileExtension = mediaType === 'photo' ? 'jpg' : 'mp4';
      const mimeType = mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';
      const fileName = `${challengeId}/${userId}/${Date.now()}.${fileExtension}`;
      const storageReference = storageRef(storage, `entries/${fileName}`);

      // Criar blob a partir do URI
      const blob: Blob & { close?: () => void } = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
          resolve(xhr.response);
        };
        xhr.onerror = function () {
          reject(new TypeError('Falha ao ler o ficheiro local'));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', localUri, true);
        xhr.send(null);
      });

      const maxBytes = mediaType === 'photo' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
      if (blob.size <= 0 || blob.size > maxBytes) {
        blob.close?.();
        throw new Error(mediaType === 'photo' ? 'A fotografia deve ter até 10 MB.' : 'O vídeo deve ter até 50 MB.');
      }
      const snapshot = await uploadBytes(storageReference, blob, {
        contentType: mimeType,
      });

      // Limpar blob
      if (blob.close) {
        blob.close();
      }

      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (error: any) {
      console.error('Erro detalhado no upload:', error);
      throw new Error(`Falha ao fazer upload: ${error.message}`);
    }
  }, [mediaType]);

  // ============================================================
  // FUNÇÃO DE SUBMISSÃO REAL
  // ============================================================
  const performSubmission = useCallback(async (): Promise<boolean> => {
    if (!media || !caption.trim() || !uid || !id) {
      toast.warning('Preencha todos os campos.');
      return false;
    }

    setLoading(true);

    try {
      const fresh = await get(ref(db, 'challenges/' + id));
      const challenge = fresh.val();
      if (!challenge || challenge.status !== 'active' || !Number.isFinite(challenge.endsAt) || challenge.endsAt <= Date.now()) {
        throw new Error('Este desafio já não aceita participações.');
      }
      // Upload da mídia
      const mediaUrl = await uploadFileToStorage(media, id, uid);

      if (!mediaUrl || mediaUrl.length === 0) {
        throw new Error('URL da media não foi gerada');
      }

      await authenticatedRequest('?action=submit', {
        challengeId: id, mediaUrl, mediaType, caption: caption.trim(),
      }, CHALLENGE_GATE_URL);

      // A publicação já foi aceite; o consentimento é gravado à parte e uma
      // falha aqui não deve anular a participação.
      if (shareContact && challenge.sponsorId && uid) {
        await set(ref(db, `sponsorConsents/${id}/${uid}`), {
          sponsorId: challenge.sponsorId, at: serverTimestamp(), version: 1,
        }).catch(e => console.warn('[CONSENT] não gravado:', e));
      }

      // Sucesso
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '🎉 Submetido com sucesso!',
        'A tua entrada foi publicada. Partilha o link para angariar votos!',
        [{ 
          text: 'OK', 
          onPress: () => {
            setMedia(null);
            setCaption('');
            router.back();
          } 
        }]
      );
      
      return true;
    } catch (error: any) {
      console.error('Erro no submit:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error('Erro ao submeter', { description: error.message || 'Falha ao submeter. Tenta novamente.\n\nVerifica a tua ligação à internet.' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [media, caption, uid, id, mediaType, uploadFileToStorage, shareContact]);

  // ============================================================
  // HANDLE SUBMIT
  // ============================================================
  const handleSubmit = useCallback(async () => {
    // Validações básicas
    if (!media) {
      toast.warning('Escolhe uma foto ou vídeo');
      return;
    }

    if (mediaType && allowedMediaType !== 'both' && mediaType !== allowedMediaType) {
      toast.warning('Tipo de mídia não permitido', {
        description: `Este desafio só aceita ${allowedMediaType === 'photo' ? 'fotos' : 'vídeos'}.`,
      });
      return;
    }

    if (!caption.trim()) {
      toast.warning('Escreve uma legenda');
      return;
    }

    if (!uid) {
      toast.error('Sessão expirada. Faz login novamente.');
      return;
    }

    // ✅ Tudo verificado - submeter
    await performSubmission();
  }, [
    media,
    mediaType,
    caption,
    uid,
    allowedMediaType,
    performSubmission,
  ]);

  // ============================================================
  // RENDER: CARREGANDO
  // ============================================================
  if (checkingExisting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>
          Carregando...
        </Text>
      </View>
    );
  }

  // ============================================================
  // RENDER: JÁ PARTICIPOU
  // ============================================================
  if (alreadySubmitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Já participaste</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>✓</Text>
          <Text style={[styles.previewCaptionBold, { textAlign: 'center', marginBottom: 8, fontSize: 18 }]}>
            Já submeteste a tua entrada
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
            Só podes participar uma vez em cada desafio.{'\n'}
            Partilha o teu link para angariar mais votos!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Idade mínima e desafios agendados: não se participa antes de abrir nem sem idade.
  if (challengeInfo && !canAccessChallenge(challengeInfo, age)) {
    return <AgeLockedScreen minAge={challengeMinAge(challengeInfo)} />;
  }
  if (challengeInfo && challengeStartsAt(challengeInfo) > Date.now()) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 8 }}>Este desafio ainda não abriu</Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
          Abre a {new Date(challengeStartsAt(challengeInfo)).toLocaleString('pt-MZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.
        </Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.primary }}>Voltar</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ============================================================
  // RENDER: PRINCIPAL
  // ============================================================
  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova publicação</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !media || !caption.trim()}
            style={[styles.postBtnTop, (!media || !caption.trim()) && styles.postBtnTopDisabled]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[styles.postBtnTopText, (!media || !caption.trim()) && styles.postBtnTopTextDisabled]}>
                Publicar
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card do desafio */}
          <View style={styles.challengeCard}>
            <LinearGradient
              colors={gradients.primary}
              style={styles.challengeCardHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.challengeBadgeLabel}>🏆 ESTÁS A PARTICIPAR EM</Text>
              <Text style={styles.challengeCardTitle}>{title}</Text>
            </LinearGradient>

            {challengeInfo && (
              <View style={styles.challengeCardBody}>
                {challengeInfo.description && (
                  <Text style={styles.challengeDescription}>
                    {challengeInfo.description}
                  </Text>
                )}

                <View style={styles.challengeMetaRow}>
                  <View style={styles.challengeMetaItem}>
                    <Text style={styles.challengeMetaIcon}>
                      {challengeInfo.prizeType === 'cash' ? '💰' : '🎁'}
                    </Text>
                    <Text style={styles.challengeMetaText}>{challengeInfo.prize}</Text>
                  </View>
                  <View style={styles.challengeMetaDivider} />
                  <View style={styles.challengeMetaItem}>
                    <Text style={styles.challengeMetaIcon}>⏱</Text>
                    <Text style={styles.challengeMetaText}>{getTimeLeft(challengeInfo.endsAt)}</Text>
                  </View>
                  <View style={styles.challengeMetaDivider} />
                  <View style={styles.challengeMetaItem}>
                    <Text style={styles.challengeMetaIcon}>👥</Text>
                    <Text style={styles.challengeMetaText}>
                      {challengeInfo.totalParticipants || 0} a participar
                    </Text>
                  </View>
                </View>


                <View style={styles.mediaTypePill}>
                  <Text style={styles.mediaTypePillText}>
                    {allowedMediaType === 'photo' && '📸 Só fotos'}
                    {allowedMediaType === 'video' && '🎬 Só vídeos'}
                    {allowedMediaType === 'both' && '📸🎬 Foto ou vídeo'}
                  </Text>
                </View>

                {challengeInfo.type === 'sponsored' && !!challengeInfo.sponsor && (
                  <View style={styles.sponsorPill}>
                    {challengeInfo.sponsorLogo ? (
                      <Image source={{ uri: challengeInfo.sponsorLogo }} style={styles.sponsorLogo} />
                    ) : null}
                    <Text style={styles.sponsorPillText}>Patrocinado por {challengeInfo.sponsor}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Preview da mídia */}
          <TouchableOpacity
            style={styles.mediaPreviewWrap}
            onPress={handlePickMedia}
            activeOpacity={0.9}
            disabled={loading}
          >
            {media ? (
              <>
                <Image source={{ uri: media }} style={styles.mediaPreview} />
                <View style={styles.mediaChangeBadge}>
                  <Text style={styles.mediaChangeText}>✏️ Alterar</Text>
                </View>
                {mediaType === 'video' && (
                  <View style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>▶ Vídeo</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.uploadEmpty}>
                <View style={styles.uploadIconCircle}>
                  <Text style={styles.uploadEmoji}>
                    {allowedMediaType === 'video' ? '🎬' : '📷'}
                  </Text>
                </View>
                <Text style={styles.uploadText}>
                  {allowedMediaType === 'photo' && 'Adiciona uma foto'}
                  {allowedMediaType === 'video' && 'Adiciona um vídeo'}
                  {allowedMediaType === 'both' && 'Adiciona uma foto ou vídeo'}
                </Text>
                <Text style={styles.uploadSub}>Toca para escolher da galeria ou câmara</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Legenda */}
          <View style={styles.captionSection}>
            <View style={styles.captionRow}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>
                  {auth.currentUser?.email?.charAt(0).toUpperCase() || '🗳️'}
                </Text>
              </View>
              <TextInput
                style={styles.captionInput}
                placeholder="Escreve uma legenda para o teu post..."
                placeholderTextColor={colors.textSubtle}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={200}
                editable={!loading}
              />
            </View>
            <Text style={styles.counter}>{caption.length}/200</Text>
          </View>

          {/* Regras */}
          <View style={styles.rulesBox}>
            <Text style={styles.rulesTitle}>Antes de publicares</Text>
            <View style={styles.rulesList}>
              <Text style={styles.rulesText}>✓ 1 publicação por pessoa neste desafio</Text>
              <Text style={styles.rulesText}>✓ O conteúdo deve respeitar o tema do desafio</Text>
              <Text style={styles.rulesText}>✓ Partilha o teu link depois de publicares para angariar votos</Text>
              <Text style={styles.rulesText}>✓ Quem tiver mais votos no fim, ganha o prémio</Text>
            </View>
          </View>

          {/* Consentimento para a marca (só em desafios patrocinados) */}
          {challengeInfo?.type === 'sponsored' && !!challengeInfo.sponsorId && (
            <TouchableOpacity
              onPress={() => setShareContact(v => !v)}
              activeOpacity={0.8}
              style={styles.consentBox}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: shareContact }}
            >
              <View style={[styles.consentCheck, shareContact && styles.consentCheckOn]}>
                {shareContact && <Text style={styles.consentTick}>✓</Text>}
              </View>
              <Text style={styles.consentText}>
                Aceito que <Text style={styles.consentBrand}>{challengeInfo.sponsor || 'a marca'}</Text> me contacte
                com ofertas e novidades. Partilha o meu nome, telefone e cidade só com esta marca. Opcional: podes
                participar sem aceitar.
              </Text>
            </TouchableOpacity>
          )}

          {/* Botão submeter */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !media || !caption.trim()}
            activeOpacity={0.85}
            style={[
              styles.btnWrap,
              (!media || !caption.trim()) && styles.btnDisabled,
            ]}
          >
            <LinearGradient
              colors={gradients.primary}
              style={styles.btn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.btnText, { marginLeft: 10 }]}>A publicar...</Text>
                </>
              ) : (
                <Text style={styles.btnText}>Publicar entrada 🚀</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// ============================================================
// FUNÇÃO AUXILIAR
// ============================================================
function getTimeLeft(endsAt: number): string {
  if (!endsAt) return 'N/A';
  const diff = endsAt - Date.now();
  if (diff <= 0) return 'Encerrado';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d restantes`;
  return `${hours}h restantes`;
}

// ============================================================
// ESTILOS
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surface,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 22 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  postBtnTop: { paddingHorizontal: 8, paddingVertical: 4, width: 70, alignItems: 'flex-end' },
  postBtnTopDisabled: { opacity: 0.4 },
  postBtnTopText: { color: colors.primary, fontSize: 15, fontFamily: 'Inter_700Bold' },
  postBtnTopTextDisabled: { color: colors.textSubtle },

  scroll: { paddingBottom: 100 },

  // Card do desafio
  challengeCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
    borderWidth: 0.5,
    borderColor: colors.surfaceRaised,
  },
  challengeCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  challengeBadgeLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  challengeCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  challengeCardBody: {
    padding: 16,
    gap: 12,
  },
  challengeDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  challengeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  challengeMetaIcon: { fontSize: 13 },
  challengeMetaText: {
    color: '#fff',
    fontSize: 11.5,
    fontFamily: 'Inter_500Medium',
  },
  challengeMetaDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },
  mediaTypePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  mediaTypePillText: {
    color: '#ccc',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  sponsorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,40,106,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,40,106,0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  sponsorLogo: { width: 16, height: 16, borderRadius: 4, backgroundColor: '#fff' },
  sponsorPillText: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },

  // Preview de mídia
  mediaPreviewWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceSunken,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: colors.surface,
    position: 'relative',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaChangeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mediaChangeText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_500Medium' },
  videoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  videoBadgeText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_500Medium' },

  uploadEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  uploadIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadEmoji: { fontSize: 28 },
  uploadText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_500Medium' },
  uploadSub: { color: colors.textSubtle, fontSize: 12.5, fontFamily: 'Inter_400Regular' },

  // Legenda
  captionSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  captionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  avatarSmall: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  avatarSmallText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  captionInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    minHeight: 40,
    paddingTop: 6,
  },
  counter: { textAlign: 'right', fontSize: 11, color: colors.textSubtle, fontFamily: 'Inter_400Regular' },

  // Regras
  rulesBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 0.5,
    borderColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  rulesTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rulesList: { gap: 6 },
  rulesText: { color: '#777', fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  // Consentimento para a marca
  consentBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceSunken,
  },
  consentCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.textSubtle,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  consentCheckOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentTick: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold', lineHeight: 16 },
  consentText: { flex: 1, color: '#aaa', fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  consentBrand: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  // Botão
  btnWrap: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.4 },
  btn: {
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  previewCaptionBold: { color: '#fff', fontFamily: 'Inter_700Bold' },
});
