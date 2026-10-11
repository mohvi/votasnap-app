import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { get, ref } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { authenticatedRequest } from '../../services/api';
import provinces from '../../hooks/useProvinces';
import { auth, db, storage } from '../../services/firebase';
import { colors, gradients } from '../../constants/theme';


export default function SetupProfileScreen() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null); // URI local (preview)
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [isOver13, setIsOver13] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | 'invalid' | 'error' | null>(null);
  const [existingUsernames, setExistingUsernames] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [showAgeModal, setShowAgeModal] = useState(false);

  const isValidUsername = (u: string) =>
    /^[a-z0-9_.]{3,20}$/.test(u);

  // Carregar usernames existentes
  useEffect(() => {
    const fetchExistingUsernames = async () => {
      try {
        const usersRef = ref(db, 'publicProfiles');
        const snapshot = await get(usersRef);

        if (snapshot.exists()) {
          const usersData = snapshot.val();
          const usernames = Object.values(usersData)
            .map((user: any) => user.username)
            .filter(Boolean);
          setExistingUsernames(usernames);
        }
      } catch (error) {
        console.error('Error fetching usernames:', error);
      }
    };

    fetchExistingUsernames();
  }, []);

  // Atualizar cidades quando província mudar
  useEffect(() => {
    if (province) {
      const selectedProvince = provinces.find(p => p.code === province);
      setCities(selectedProvince?.cities || []);
      setCity(''); // Reset city when province changes
    }
  }, [province]);

  const normalizeUsername = (u: string) => {
    return u.toLowerCase().trim();
  };

  const checkUsername = async () => {
    const usernameTrimmed = username.trim();

    if (!usernameTrimmed) {
      setUsernameStatus('invalid');
      setError('Username é obrigatório');
      return;
    }

    if (!isValidUsername(usernameTrimmed)) {
      setUsernameStatus('invalid');
      setError('Username: 3-20 caracteres, só letras minúsculas, números, _ e .');
      return;
    }

    setUsernameStatus('checking');
    setError('');

    try {
      const normalizedUsername = normalizeUsername(usernameTrimmed);
      const normalizedExisting = existingUsernames.map(u => normalizeUsername(u));

      const isAvailable = !normalizedExisting.includes(normalizedUsername);

      setUsernameStatus(isAvailable ? 'available' : 'taken');
      if (!isAvailable) {
        setError('Este username já está em uso');
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameStatus('error');
      setError('Erro ao verificar username');
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setAvatar(result.assets[0].uri); // só preview local por enquanto
    }
  };

  // Converte a URI local para Blob via XHR — o fetch().blob() falha em alguns
  // aparelhos Android/Expo Go, XHR é a abordagem que já validámos no VotaSnap.
  const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Falha ao ler o ficheiro da imagem'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  // Sobe o avatar para o Firebase Storage e devolve a URL pública de download.
  const uploadAvatarToStorage = async (uid: string, uri: string): Promise<string> => {
    const blob = await uriToBlob(uri);
    const fileRef = storageRef(storage, `avatars/${uid}.jpg`);
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
    // liberta a memória do blob depois do upload (recomendado em RN)
    // @ts-ignore
    if (typeof blob.close === 'function') blob.close();
    return getDownloadURL(fileRef);
  };

  // ── Anti-fraude: deteção de partilha de aparelho (sem fingerprint) ──
  // O Expo push token é único por instalação do app num aparelho.
  // Se já existir outra conta com o mesmo pushToken, é um forte indício
  // de que duas contas estão a ser usadas no mesmo telemóvel — não bloqueia
  // o registo (pode ser família/casal a partilhar), só sinaliza para revisão.

  const handleSave = async (ageConfirmed = false) => {
    if (!name.trim()) {
      setError('Introduz o teu nome');
      return;
    }

    if (usernameStatus !== 'available') {
      setError('Por favor, verifica se o username está disponível');
      return;
    }

    if (!province) {
      setError('Selecciona uma província');
      return;
    }

    if (!city) {
      setError('Selecciona um distrito/cidade');
      return;
    }

    if (!isOver13 && !ageConfirmed) {
      setShowAgeModal(true);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sessão expirada — faz login novamente');

      // Verificar username novamente antes de salvar
      const normalizedUsername = normalizeUsername(username);
      const normalizedExisting = existingUsernames.map(u => normalizeUsername(u));

      if (normalizedExisting.includes(normalizedUsername)) {
        throw new Error('Este username já foi escolhido por outro utilizador');
      }

      // Sobe o avatar para o Storage (se o utilizador escolheu um) e obtém a URL pública.
      // Só faz upload se for uma URI local — evita re-upload se já for uma URL http(s)
      // (ex: utilizador voltou a este ecrã sem trocar a imagem).
      let avatarUrl: string | null = null;
      if (avatar) {
        if (avatar.startsWith('http')) {
          avatarUrl = avatar;
        } else {
          setUploadingAvatar(true);
          try {
            avatarUrl = await uploadAvatarToStorage(uid, avatar);
          } finally {
            setUploadingAvatar(false);
          }
        }
      }

      await authenticatedRequest('/api/account/profile', {
        name: name.trim(),
        username: normalizedUsername,
        bio: bio.trim(),
        avatar: avatarUrl,
        province: province,
        city: city,
        isOver13: true,
      });

      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Não foi possível guardar o perfil. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getUsernameStatusIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return <ActivityIndicator size="small" color={colors.primary} />;
      case 'available':
        return <Text style={styles.statusAvailable}>✓</Text>;
      case 'taken':
      case 'invalid':
        return <Text style={styles.statusTaken}>✗</Text>;
      default:
        return null;
    }
  };

  const getUsernameStatusText = () => {
    switch (usernameStatus) {
      case 'checking':
        return 'Verificando...';
      case 'available':
        return 'Username disponível';
      case 'taken':
        return 'Username indisponível';
      case 'invalid':
        return 'Formato inválido';
      case 'error':
        return 'Não foi possível verificar. Tenta novamente.';
      default:
        return '';
    }
  };

  const isSaving = loading || uploadingAvatar;

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.step}>Passo 1 de 1</Text>
          <Text style={styles.title}>Configura o teu perfil</Text>
          <Text style={styles.subtitle}>
            Como queres aparecer na comunidade?
          </Text>
        </View>

        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={handlePickAvatar}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={gradients.primary}
              style={styles.avatarPlaceholder}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.avatarIcon}>📷</Text>
            </LinearGradient>
          )}

          {uploadingAvatar ? (
            <View style={styles.avatarUploadingOverlay}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          ) : (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>+</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>
          {uploadingAvatar ? 'A carregar imagem...' : 'Toca para adicionar foto'}
        </Text>

        {/* Formulário */}
        <View style={styles.form}>

          {/* Erro */}
          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Nome */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Nome completo <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Ana Machava"
              placeholderTextColor={colors.textSubtle}
              value={name}
              onChangeText={setName}
              editable={!isSaving}
              maxLength={50}
            />
          </View>

          {/* Username */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Username <Text style={styles.required}>*</Text></Text>
            <View style={styles.usernameWrap}>
              <View style={styles.usernamePrefix}>
                <Text style={styles.usernamePrefixText}>@</Text>
              </View>
              <TextInput
                style={styles.usernameInput}
                placeholder="ana.machava"
                placeholderTextColor={colors.textSubtle}
                value={username}
                onChangeText={t => {
                  const cleaned = t.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                  setUsername(cleaned);
                  setUsernameStatus(null);
                  setError('');
                }}
                onBlur={checkUsername}
                editable={!isSaving}
                maxLength={20}
                autoCapitalize="none"
              />
              {username.length > 0 && (
                <View style={styles.usernameCheck}>
                  {getUsernameStatusIcon()}
                </View>
              )}
            </View>
            {usernameStatus && (
              <Text style={[
                styles.statusText,
                usernameStatus === 'available' && styles.statusTextAvailable,
                usernameStatus === 'taken' && styles.statusTextTaken,
                usernameStatus === 'invalid' && styles.statusTextInvalid,
                usernameStatus === 'checking' && styles.statusTextChecking,
              ]}>
                {getUsernameStatusText()}
              </Text>
            )}
            <Text style={styles.hint}>
              Só letras minúsculas, números, _ e . — 3 a 20 caracteres
            </Text>
          </View>

          {/* Província */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Província <Text style={styles.required}>*</Text></Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={province}
                onValueChange={(itemValue) => setProvince(itemValue)}
                style={styles.picker}
                dropdownIconColor={colors.primary}
                enabled={!isSaving}
              >
                <Picker.Item label="Selecciona uma província..." value="" />
                {provinces.map((prov) => (
                  <Picker.Item key={prov.code} label={prov.name} value={prov.code} />
                ))}
              </Picker>
            </View>
          </View>
          {/* Distrito/Cidade */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Distrito/Cidade <Text style={styles.required}>*</Text></Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={city}
                onValueChange={(itemValue) => setCity(itemValue)}
                style={styles.picker}
                dropdownIconColor={colors.primary}
                enabled={!!province && !isSaving}
              >
                <Picker.Item
                  label={province ? "Selecciona um distrito/cidade..." : "Primeiro selecciona uma província"}
                  value=""
                />
                {cities.map((cityName) => (
                  <Picker.Item key={cityName} label={cityName} value={cityName} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Bio */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Bio <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Conta algo sobre ti..."
              placeholderTextColor={colors.textSubtle}
              value={bio}
              onChangeText={setBio}
              editable={!isSaving}
              maxLength={120}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>{bio.length}/120</Text>
          </View>

          {/* Botão */}
          <TouchableOpacity
            onPress={() => handleSave()}
            disabled={isSaving || !name.trim() || usernameStatus !== 'available' || !province || !city}
            activeOpacity={0.85}
            style={[
              styles.btnWrap,
              (isSaving || !name.trim() || usernameStatus !== 'available' || !province || !city) && styles.btnDisabled,
            ]}
          >
            <LinearGradient
              colors={gradients.primary}
              style={styles.btn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Entrar no VotaSnap 🚀</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Modal de verificação de idade */}
      <Modal
        visible={showAgeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAgeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🔞</Text>
              <Text style={styles.modalTitle}>Verificação de Idade</Text>
            </View>
            <Text style={styles.modalText}>
              Para continuar, confirma que tens mais de 13 anos.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowAgeModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  setIsOver13(true);
                  setShowAgeModal(false);
                  handleSave(true);
                }}
              >
                <Text style={styles.modalButtonTextConfirm}>Confirmo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: 32,
  },
  step: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    lineHeight: 20,
  },

  // Avatar
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 36,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    textAlign: 'center',
    color: colors.textSubtle,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 32,
  },

  // Form
  form: {
    gap: 16,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  required: {
    color: colors.primary,
  },
  optional: {
    color: colors.textSubtle,
    fontFamily: 'Inter_400Regular',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  bioInput: {
    height: 90,
    paddingTop: 14,
  },
  counter: {
    textAlign: 'right',
    fontSize: 11,
    color: colors.textSubtle,
    fontFamily: 'Inter_400Regular',
  },
  hint: {
    fontSize: 11,
    color: colors.textSubtle,
    fontFamily: 'Inter_400Regular',
  },

  // Username
  usernameWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
  },
  usernamePrefix: {
    paddingHorizontal: 14,
    borderRightWidth: 0.5,
    borderRightColor: colors.border,
    paddingVertical: 16,
  },
  usernamePrefixText: {
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  usernameInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  usernameCheck: {
    paddingHorizontal: 14,
  },
  statusAvailable: {
    fontSize: 18,
    color: colors.success,
  },
  statusTaken: {
    fontSize: 18,
    color: colors.danger,
  },
  statusText: {
    fontSize: 12,
    marginTop: 4,
  },
  statusTextAvailable: {
    color: colors.success,
  },
  statusTextTaken: {
    color: colors.danger,
  },
  statusTextInvalid: {
    color: colors.danger,
  },
  statusTextChecking: {
    color: colors.primary,
  },

  // Picker
  pickerWrap: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    backgroundColor: colors.surface,
  },

  // Erro
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 0.5,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },

  // Botão
  btnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btn: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  modalText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.border,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
  },
  modalButtonTextCancel: {
    color: colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
});
