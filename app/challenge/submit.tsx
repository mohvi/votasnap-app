import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { get, push, ref, update } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db, storage } from '../../services/firebase';

interface ChallengeInfo {
  title: string;
  description: string;
  prize: string;
  prizeType: string;
  sponsor: string;
  endsAt: number;
  totalParticipants: number;
  coverImage?: string;
  allowedMediaType?: 'photo' | 'video' | 'both'; // definido no CreateChallengeForm
}

export default function SubmitScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [challengeInfo, setChallengeInfo] = useState<ChallengeInfo | null>(null);

  const uid = auth.currentUser?.uid;

  // Mídia aceite pelo desafio — se o campo não existir (desafios antigos
  // criados antes desta mudança de schema), assume 'both' para não quebrar.
  const allowedMediaType = challengeInfo?.allowedMediaType || 'both';

  // Carrega os detalhes completos do desafio
  useEffect(() => {
    const loadChallenge = async () => {
      if (!id) return;
      try {
        const snap = await get(ref(db, `challenges/${id}`));
        if (snap.exists()) setChallengeInfo(snap.val());
      } catch (e) {
        console.error('Erro ao carregar desafio:', e);
      }
    };
    loadChallenge();
  }, [id]);

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

  const pickPhotoFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled) {
      setMedia(result.assets[0].uri);
      setMediaType('photo');
    }
  };

  const pickVideoFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      setMedia(result.assets[0].uri);
      setMediaType('video');
    }
  };

  // A câmara agora grava foto ou vídeo consoante o que o desafio aceita.
  // Em desafios 'both' usa-se foto por omissão (comportamento anterior).
  const captureFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    if (allowedMediaType === 'video') {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
      });
      if (!result.canceled) {
        setMedia(result.assets[0].uri);
        setMediaType('video');
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
    }
  };

  const handlePickMedia = async () => {
    // Monta as opções do Alert dinamicamente consoante allowedMediaType,
    // em vez de oferecer sempre Foto + Vídeo + Câmara.
    const options: { text: string; onPress?: () => void; style?: 'cancel' }[] = [];

    if (allowedMediaType === 'photo' || allowedMediaType === 'both') {
      options.push({ text: 'Foto', onPress: pickPhotoFromGallery });
    }
    if (allowedMediaType === 'video' || allowedMediaType === 'both') {
      options.push({ text: 'Vídeo', onPress: pickVideoFromGallery });
    }
    options.push({ text: 'Câmara', onPress: captureFromCamera });
    options.push({ text: 'Cancelar', style: 'cancel' });

    const mediaLabel =
      allowedMediaType === 'photo' ? 'uma foto' :
      allowedMediaType === 'video' ? 'um vídeo' :
      'uma foto ou vídeo';

    Alert.alert('Escolher media', `Este desafio aceita ${mediaLabel}`, options);
  };

  const uploadFileToStorage = async (localUri: string, challengeId: string, userId: string): Promise<string> => {
    try {
      const fileExtension = mediaType === 'photo' ? 'jpg' : 'mp4';
      const mimeType = mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';
      const fileName = `${challengeId}/${userId}/${Date.now()}.${fileExtension}`;
      const storageReference = storageRef(storage, `entries/${fileName}`);

      const blob: Blob = await new Promise((resolve, reject) => {
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

      const snapshot = await uploadBytes(storageReference, blob, {
        contentType: mimeType,
      });

      // @ts-ignore
      blob.close && blob.close();

      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (error: any) {
      console.error('Erro detalhado no upload:', error);
      throw new Error(`Falha ao fazer upload: ${error.message}`);
    }
  };

  const handleSubmit = async () => {
    if (!media) {
      Alert.alert('Atenção', 'Escolhe uma foto ou vídeo');
      return;
    }
    // Segunda barreira, depois da seleção: garante que ninguém chega aqui
    // com um mediaType incompatível (ex: app desatualizada, estado antigo).
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

    setLoading(true);

    try {
      const mediaUrl = await uploadFileToStorage(media, id, uid);

      if (!mediaUrl || mediaUrl.length === 0) {
        throw new Error('URL da media não foi gerada');
      }

      const entryRef = push(ref(db, `entries/${id}`));
      await update(entryRef, {
        userId: uid,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        caption: caption.trim(),
        votes: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const challengeRef = ref(db, `challenges/${id}`);
      const snap = await get(challengeRef);
      const current = snap.val()?.totalParticipants || 0;
      await update(challengeRef, { totalParticipants: current + 1 });

      Alert.alert(
        'Submetido com sucesso! 🎉',
        'A tua entrada foi publicada. Partilha o link para angariar votos!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      console.error('Erro no submit:', e);
      Alert.alert(
        'Erro ao submeter',
        e.message || 'Falha ao submeter. Tenta novamente.\n\nVerifica a tua ligação à internet.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getTimeLeft = () => {
    if (!challengeInfo?.endsAt) return null;
    const diff = challengeInfo.endsAt - Date.now();
    if (diff <= 0) return 'Encerrado';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d restantes`;
    return `${hours}h restantes`;
  };

  if (checkingExisting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff286a" size="large" />
      </View>
    );
  }

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

  return (
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

        {/* Card do desafio — estilo destaque, como um "story" do que vais responder */}
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
                  <Text style={styles.challengeMetaText}>{getTimeLeft()}</Text>
                </View>
                <View style={styles.challengeMetaDivider} />
                <View style={styles.challengeMetaItem}>
                  <Text style={styles.challengeMetaIcon}>👥</Text>
                  <Text style={styles.challengeMetaText}>
                    {challengeInfo.totalParticipants || 0} a participar
                  </Text>
                </View>
              </View>

              {/* Indica claramente que tipo de mídia este desafio aceita */}
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

        {/* Preview grande da media — estilo post Instagram */}
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

        {/* Legenda — estilo Instagram, com avatar à esquerda */}
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

        {/* Regras — mais discretas, estilo "termos" */}
        <View style={styles.rulesBox}>
          <Text style={styles.rulesTitle}>Antes de publicares</Text>
          <View style={styles.rulesList}>
            <Text style={styles.rulesText}>✓ 1 publicação por pessoa neste desafio</Text>
            <Text style={styles.rulesText}>✓ O conteúdo deve respeitar o tema do desafio</Text>
            <Text style={styles.rulesText}>✓ Partilha o teu link depois de publicares para angariar votos</Text>
            <Text style={styles.rulesText}>✓ Quem tiver mais votos no fim, ganha o prémio</Text>
          </View>
        </View>

        {/* Botão submeter — grande, no fim */}
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
            ) : (
              <Text style={styles.btnText}>Publicar entrada 🚀</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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

  // Preview de media estilo Instagram
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

  // Botão final
  btnWrap: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.4 },
  btn: {
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },

  // Reaproveitado no estado "já participaste"
  previewCaptionBold: { color: '#fff', fontFamily: 'Inter_700Bold' },
});