import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { get, ref } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticatedRequest } from '../../services/api';
import { useChallengePayment } from '../../hooks/useChallengePayment';
import { auth, db, storage } from '../../services/firebase';

// ============================================================
// TIPOS
// ============================================================
interface ChallengeInfo {
  title: string;
  description: string;
  prize: string;
  prizeType: string;
  sponsor: string;
  endsAt: number;
  totalParticipants: number;
  coverImage?: string;
  allowedMediaType?: 'photo' | 'video' | 'both';
  type?: 'free' | 'paid' | 'sponsored';
  status: string;
  entryFee?: number;
  price?: number;
}

type PaymentScreenState = 'idle' | 'verifying' | 'payment_required' | 'submitting' | 'success' | 'error';

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function SubmitScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  
  // Refs
  const appStateRef = useRef(AppState.currentState);
  
  // Estados do formulário
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [challengeInfo, setChallengeInfo] = useState<ChallengeInfo | null>(null);
  
  // Estados do pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const uid = auth.currentUser?.uid;

  // Mídia aceite pelo desafio
  const allowedMediaType = challengeInfo?.allowedMediaType || 'both';
  const isPaidChallenge = challengeInfo?.type === 'paid';
  const entryFee = challengeInfo?.entryFee || challengeInfo?.price || 1;

  // ============================================================
  // HOOK DE PAGAMENTO CORRETO
  // ============================================================
  const {
    status: paymentStatus,
    loading: paymentLoading,
    error: paymentError,
    result: paymentResult,
    payChallenge,
    checkPaymentStatus,
    reset: resetPaymentState,
    registerManualPayment,
  } = useChallengePayment();

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
          setChallengeInfo({
            ...data,
            type: data.type || 'free',
            entryFee: data.entryFee || data.price || 1,
          });
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
  // VERIFICAR PAGAMENTO - CORRIGIDO
  // ============================================================
  const verifyPayment = useCallback(async (challengeId: string): Promise<boolean> => {
    if (!uid || !challengeId || !isPaidChallenge) {
      setCheckingPayment(false);
      return false;
    }

    try {
      const { paid } = await checkPaymentStatus(challengeId);
      setIsPaid(paid);
      return paid;
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
      setIsPaid(false);
      return false;
    } finally {
      setCheckingPayment(false);
    }
  }, [uid, isPaidChallenge, checkPaymentStatus]);

  // Efeito para verificar pagamento inicial
  useEffect(() => {
    if (uid && id && isPaidChallenge) {
      verifyPayment(id);
    } else {
      setCheckingPayment(false);
    }
  }, [uid, id, isPaidChallenge, verifyPayment]);

  // ============================================================
  // FUNÇÕES DE MÍDIA
  // ============================================================
  const pickPhotoFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para escolher uma foto.');
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
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para escolher um vídeo.');
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
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara para tirar uma foto.');
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
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return false;
    }

    setLoading(true);

    try {
      const fresh = await get(ref(db, 'challenges/' + id));
      const challenge = fresh.val();
      if (!challenge || challenge.status !== 'active' || !Number.isFinite(challenge.endsAt) || challenge.endsAt <= Date.now()) {
        throw new Error('Este desafio já não aceita participações.');
      }
      if (challenge.type === 'paid' && !(await checkPaymentStatus(id)).paid) {
        throw new Error('Aguarda a confirmação do pagamento antes de participar.');
      }
      // Upload da mídia
      const mediaUrl = await uploadFileToStorage(media, id, uid);

      if (!mediaUrl || mediaUrl.length === 0) {
        throw new Error('URL da media não foi gerada');
      }

      await authenticatedRequest('/api/challenges/submit', {
        challengeId: id, mediaUrl, mediaType, caption: caption.trim(),
      });

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
      Alert.alert(
        'Erro ao submeter',
        error.message || 'Falha ao submeter. Tenta novamente.\n\nVerifica a tua ligação à internet.'
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [media, caption, uid, id, mediaType, isPaidChallenge, challengeInfo, uploadFileToStorage, checkPaymentStatus]);

  // ============================================================
  // HANDLE SUBMIT COM VERIFICAÇÃO DE PAGAMENTO
  // ============================================================
  const handleSubmit = useCallback(async () => {
    // Validações básicas
    if (!media) {
      Alert.alert('Atenção', 'Escolhe uma foto ou vídeo');
      return;
    }

    if (mediaType && allowedMediaType !== 'both' && mediaType !== allowedMediaType) {
      Alert.alert(
        'Tipo de mídia não permitido',
        `Este desafio só aceita ${allowedMediaType === 'photo' ? 'fotos' : 'vídeos'}.`
      );
      return;
    }

    if (!caption.trim()) {
      Alert.alert('Atenção', 'Escreve uma legenda');
      return;
    }

    if (!uid) {
      Alert.alert('Erro', 'Sessão expirada. Faz login novamente.');
      return;
    }

    // Verificar pagamento para desafios pagos
    if (isPaidChallenge) {
      const paid = await verifyPayment(id);
      if (!paid) {
        setShowPaymentModal(true);
        return;
      }
    }

    // ✅ Tudo verificado - submeter
    await performSubmission();
  }, [
    media,
    mediaType,
    caption,
    uid,
    id,
    isPaidChallenge,
    allowedMediaType,
    verifyPayment,
    performSubmission,
  ]);

  // ============================================================
  // HANDLE PAGAMENTO - CORRIGIDO
  // ============================================================
  const handlePayment = useCallback(async () => {
    if (!id || !challengeInfo) {
      Alert.alert('Erro', 'Desafio não encontrado.');
      return;
    }

    // Validar número de telefone
    if (!phoneNumber.trim()) {
      setPhoneError('Por favor, insira o seu número de telefone.');
      return;
    }

    // Limpar erro anterior
    setPhoneError(null);

    // Verificar se já pagou (evitar duplicação)
    const alreadyPaid = await verifyPayment(id);
    if (alreadyPaid) {
      setIsPaid(true);
      setShowPaymentModal(false);
      Alert.alert('✅ Já Pago', 'Você já pagou este desafio.');
      return;
    }

    // Processar pagamento
    const result = await payChallenge(id, phoneNumber);

    if (result) {
      // ✅ Pagamento bem sucedido
      setIsPaid(true);
      setShowPaymentModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        '✅ Pagamento Confirmado!',
        'Agora você pode submeter sua entrada.',
        [
          {
            text: 'Continuar',
            onPress: async () => {
              // Submeter automaticamente após pagamento
              await performSubmission();
            }
          }
        ]
      );
    } else {
      // ❌ Pagamento falhou - erro já está no paymentError
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // O erro é exibido no modal via paymentError
    }
  }, [id, challengeInfo, phoneNumber, payChallenge, verifyPayment, performSubmission]);

  // ============================================================
  // REGISTAR PAGAMENTO MANUAL
  // ============================================================
  const handleManualPayment = useCallback(async () => {
    if (!id || !challengeInfo) return;

    Alert.alert(
      'Pagamento Manual',
      'Deseja registrar que já fez o pagamento? Um administrador irá verificar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const success = await registerManualPayment(id, entryFee);
            if (success) {
              setIsPaid(false);
              setShowPaymentModal(false);
              Alert.alert(
                '✅ Pagamento Registado',
                'Sua solicitação foi enviada para verificação. Aguarde a confirmação do administrador.'
              );
            }
          }
        }
      ]
    );
  }, [id, challengeInfo, entryFee, registerManualPayment]);

  // ============================================================
  // LIMPAR ESTADO NO UNMOUNT
  // ============================================================
  useEffect(() => {
    return () => {
      resetPaymentState();
    };
  }, [resetPaymentState]);

  // ============================================================
  // RENDER: CARREGANDO
  // ============================================================
  if (checkingExisting || checkingPayment) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff286a" size="large" />
        <Text style={styles.loadingText}>
          {checkingPayment ? 'Verificando pagamento...' : 'Carregando...'}
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
          <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
            Só podes participar uma vez em cada desafio.{'\n'}
            Partilha o teu link para angariar mais votos!
          </Text>
        </View>
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
              <ActivityIndicator color="#ff286a" size="small" />
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
              colors={['#ff286a', '#ff8c5a']}
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

                {/* Status de pagamento */}
                {isPaidChallenge && (
                  <View style={[
                    styles.paymentStatusBadge,
                    isPaid ? styles.paidBadge : styles.unpaidBadge,
                  ]}>
                    <Ionicons
                      name={isPaid ? 'checkmark-circle' : 'lock-closed'}
                      size={14}
                      color={isPaid ? '#10B981' : '#F59E0B'}
                    />
                    <Text style={[
                      styles.paymentStatusText,
                      isPaid ? styles.paidText : styles.unpaidText,
                    ]}>
                      {isPaid ? '✅ Pago' : `💳 Pagar ${entryFee} MT para participar`}
                    </Text>
                  </View>
                )}

                <View style={styles.mediaTypePill}>
                  <Text style={styles.mediaTypePillText}>
                    {allowedMediaType === 'photo' && '📸 Só fotos'}
                    {allowedMediaType === 'video' && '🎬 Só vídeos'}
                    {allowedMediaType === 'both' && '📸🎬 Foto ou vídeo'}
                  </Text>
                </View>

                {challengeInfo.sponsor && (
                  <View style={styles.sponsorPill}>
                    <Text style={styles.sponsorPillText}>📢 Patrocinado por {challengeInfo.sponsor}</Text>
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
                placeholderTextColor="#555"
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
              {isPaidChallenge && (
                <Text style={[styles.rulesText, { color: '#F59E0B' }]}>
                  💳 Pagamento de {entryFee} MT necessário para participar
                </Text>
              )}
            </View>
          </View>

          {/* Botão submeter */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !media || !caption.trim() || (isPaidChallenge && !isPaid)}
            activeOpacity={0.85}
            style={[
              styles.btnWrap,
              (!media || !caption.trim() || (isPaidChallenge && !isPaid)) && styles.btnDisabled,
            ]}
          >
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.btn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.btnText, { marginLeft: 10 }]}>A publicar...</Text>
                </>
              ) : isPaidChallenge && !isPaid ? (
                <Text style={styles.btnText}>💳 Pagar {entryFee} MT para Publicar</Text>
              ) : (
                <Text style={styles.btnText}>Publicar entrada 🚀</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Mensagem de erro do pagamento */}
          {paymentError && (
            <View style={styles.paymentErrorContainer}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.paymentErrorText}>{paymentError}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ============================================================
          MODAL DE PAGAMENTO - CORRIGIDO
          ============================================================ */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!paymentLoading) {
            setShowPaymentModal(false);
            setPhoneError(null);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              {/* Handle */}
              <View style={styles.modalHandle} />

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>💳 Pagamento do Desafio</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (!paymentLoading) {
                        setShowPaymentModal(false);
                        setPhoneError(null);
                      }
                    }}
                    disabled={paymentLoading}
                    style={styles.modalClose}
                  >
                    <Ionicons name="close" size={24} color="#6B6B85" />
                  </TouchableOpacity>
                </View>

                {/* Informações do desafio */}
                <View style={styles.modalChallengeInfo}>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Desafio</Text>
                    <Text style={styles.modalInfoValue}>{title}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Valor</Text>
                    <Text style={styles.modalInfoAmount}>{entryFee} MT</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Prémio</Text>
                    <Text style={styles.modalInfoValue}>{challengeInfo?.prize}</Text>
                  </View>
                </View>

                {/* Campo de telefone - ADICIONADO */}
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.phoneInputLabel}>📱 Número M-Pesa</Text>
                  <TextInput
                    style={[styles.phoneInput, phoneError && styles.phoneInputError]}
                    placeholder="84 023 7100"
                    placeholderTextColor="#555"
                    value={phoneNumber}
                    onChangeText={(text) => {
                      setPhoneNumber(text);
                      setPhoneError(null);
                    }}
                    keyboardType="phone-pad"
                    editable={!paymentLoading}
                  />
                  {phoneError && (
                    <Text style={styles.phoneInputErrorText}>{phoneError}</Text>
                  )}
                  <Text style={styles.phoneInputHelper}>
                    Insira o número associado à sua conta M-Pesa
                  </Text>
                </View>

                {/* Benefícios */}
                <View style={styles.modalBenefits}>
                  <Text style={styles.modalBenefitsTitle}>Ao pagar, você terá:</Text>
                  <View style={styles.modalBenefitItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.modalBenefitText}>Participação garantida no desafio</Text>
                  </View>
                  <View style={styles.modalBenefitItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.modalBenefitText}>Chance de ganhar o prémio</Text>
                  </View>
                  <View style={styles.modalBenefitItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.modalBenefitText}>Visibilidade na comunidade</Text>
                  </View>
                </View>

                {/* Botão de pagamento */}
                <TouchableOpacity
                  onPress={handlePayment}
                  disabled={paymentLoading || !phoneNumber.trim()}
                  activeOpacity={0.8}
                  style={[
                    styles.modalPayButton,
                    (!phoneNumber.trim() || paymentLoading) && styles.modalPayButtonDisabled
                  ]}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#DB2777']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalPayGradient}
                  >
                    {paymentLoading ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.modalPayText}>Processando...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={20} color="white" />
                        <Text style={styles.modalPayText}>Pagar {entryFee} MT</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Botão de pagamento manual - ADICIONADO */}
                <TouchableOpacity
                  onPress={handleManualPayment}
                  disabled={paymentLoading}
                  style={styles.modalManualButton}
                >
                  <Text style={styles.modalManualText}>Já fiz o pagamento manualmente</Text>
                </TouchableOpacity>

                {/* Mensagem de erro */}
                {paymentError && (
                  <View style={styles.modalError}>
                    <Ionicons name="alert-circle" size={18} color="#EF4444" />
                    <Text style={styles.modalErrorText}>{paymentError}</Text>
                  </View>
                )}

                <Text style={styles.modalTerms}>
                  Ao pagar, você concorda com os Termos de Serviço
                </Text>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 22 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  postBtnTop: { paddingHorizontal: 8, paddingVertical: 4, width: 70, alignItems: 'flex-end' },
  postBtnTopDisabled: { opacity: 0.4 },
  postBtnTopText: { color: '#ff286a', fontSize: 15, fontFamily: 'Inter_700Bold' },
  postBtnTopTextDisabled: { color: '#555' },

  scroll: { paddingBottom: 100 },

  // Card do desafio
  challengeCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 0.5,
    borderColor: '#222',
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
    color: '#aaa',
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
    backgroundColor: '#2a2a2a',
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  paidBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  unpaidBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  paymentStatusText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  paidText: { color: '#10B981' },
  unpaidText: { color: '#F59E0B' },

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
    backgroundColor: 'rgba(255,40,106,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,40,106,0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  sponsorPillText: {
    color: '#ff286a',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },

  // Preview de mídia
  mediaPreviewWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#111',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#1a1a1a',
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
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  uploadEmoji: { fontSize: 28 },
  uploadText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_500Medium' },
  uploadSub: { color: '#555', fontSize: 12.5, fontFamily: 'Inter_400Regular' },

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
    backgroundColor: '#ff286a',
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
  counter: { textAlign: 'right', fontSize: 11, color: '#555', fontFamily: 'Inter_400Regular' },

  // Regras
  rulesBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#111',
    borderWidth: 0.5,
    borderColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  rulesTitle: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rulesList: { gap: 6 },
  rulesText: { color: '#777', fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18 },

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

  // Erro de pagamento
  paymentErrorContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentErrorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
    fontFamily: 'Inter_400Regular',
  },

  // Modal
  modalContainer: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0A0A12',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '55%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
  },
  modalClose: {
    padding: 8,
  },
  modalChallengeInfo: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalInfoLabel: {
    color: '#6B6B85',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  modalInfoValue: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  modalInfoAmount: {
    color: '#7C3AED',
    fontWeight: 'bold',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },

  // Campo de telefone
  phoneInputContainer: {
    marginBottom: 16,
  },
  phoneInputLabel: {
    color: '#A1A1B8',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  phoneInput: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  phoneInputError: {
    borderColor: '#EF4444',
  },
  phoneInputErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  phoneInputHelper: {
    color: '#4A4A62',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },

  modalBenefits: {
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  modalBenefitsTitle: {
    color: '#A1A1B8',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  modalBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  modalBenefitText: {
    color: '#D1D1D8',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  modalPayButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  modalPayButtonDisabled: {
    opacity: 0.5,
  },
  modalPayGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalPayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  modalManualButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalManualText: {
    color: '#6B6B85',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'underline',
  },
  modalError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalErrorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
    fontFamily: 'Inter_400Regular',
  },
  modalTerms: {
    color: '#4A4A62',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  previewCaptionBold: { color: '#fff', fontFamily: 'Inter_700Bold' },
});
