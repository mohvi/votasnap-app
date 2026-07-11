import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { deleteUser, signOut } from 'firebase/auth';
import { get, onValue, ref, remove, runTransaction } from 'firebase/database';
import { deleteObject, ref as storageRef } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedCard from '../../components/feed/FeedCard';
import { useAuth } from '../../hooks/useAuth';
import { FeedEntry } from '../../hooks/useFeedEntries';
import { useSnaps } from '../../hooks/useSnaps';
import { auth, db, storage } from '../../services/firebase';

const { width, height } = Dimensions.get('window');
const DELETE_CONFIRM_WORD = 'ELIMINAR';

interface UserProfile {
  uid: string;
  name: string;
  username: string;
  bio: string;
  avatar: string | null;
  phone: string;
  createdAt: number;
}

interface UserEntry extends FeedEntry {
  isWinner?: boolean;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [totalVotesGiven, setTotalVotesGiven] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState('');

  const { isLoggedIn } = useAuth();
  const uid = auth.currentUser?.uid;
  const insets = useSafeAreaInsets();

  const { snaps } = useSnaps();

  // Carregar perfil
  useEffect(() => {
    if (!uid) return;
    const unsub = onValue(ref(db, `users/${uid}`), snap => {
      if (snap.exists()) setProfile(snap.val());
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  // Carregar entradas do utilizador
  useEffect(() => {
    if (!uid) return;
    const loadEntries = async () => {
      const challengesSnap = await get(ref(db, 'challenges'));
      if (!challengesSnap.exists()) return;
      const challenges = challengesSnap.val();
      const userEntries: UserEntry[] = [];

      const userSnap = await get(ref(db, `users/${uid}`));
      const userData = userSnap.val() || {};
      const userName = userData?.username || userData?.name || 'Utilizador';
      const userAvatar = userData?.avatar || null;

      await Promise.all(
        Object.entries(challenges).map(async ([challengeId, challenge]: [string, any]) => {
          const entriesSnap = await get(ref(db, `entries/${challengeId}`));
          if (!entriesSnap.exists()) return;
          const allChallengeEntries = entriesSnap.val();

          const isFinished = challenge?.status !== 'active';
          let maxVotes = -1;
          if (isFinished) {
            for (const e of Object.values<any>(allChallengeEntries)) {
              if ((e.votes || 0) > maxVotes) maxVotes = e.votes || 0;
            }
          }

          Object.entries(allChallengeEntries).forEach(([entryId, entry]: [string, any]) => {
            if (entry.userId !== uid) return;
            const votes = entry.votes || 0;
            userEntries.push({
              id: entryId,
              challengeId,
              challengeTitle: challenge.title ?? '',
              challengePrize: challenge.prize ?? '',
              challengePrizeType: challenge.prizeType ?? '',
              userId: uid,
              userName,
              userAvatar,
              mediaUrl: entry.mediaUrl,
              mediaType: entry.mediaType || 'photo',
              caption: entry.caption ?? '',
              votes,
              createdAt: entry.createdAt || Date.now(),
              isWinner: isFinished && votes === maxVotes && maxVotes > 0,
            });
          });
        })
      );

      userEntries.sort((a, b) => b.votes - a.votes);
      setEntries(userEntries);
    };
    loadEntries();
  }, [uid]);

  // Contar votos dados
  useEffect(() => {
    if (!uid) return;
    const loadVotes = async () => {
      const challengesSnap = await get(ref(db, 'challenges'));
      if (!challengesSnap.exists()) return;
      let count = 0;
      await Promise.all(
        Object.keys(challengesSnap.val()).map(async challengeId => {
          const voteSnap = await get(ref(db, `votes/${challengeId}/${uid}`));
          if (voteSnap.exists()) count++;
        })
      );
      setTotalVotesGiven(count);
    };
    loadVotes();
  }, [uid]);

  const handleLogout = () => {
    Alert.alert(
      'Terminar sessão',
      'Tens a certeza que queres sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  // ── Eliminação de conta ──
  // Apaga, por esta ordem: ficheiros no Storage (avatar + media das entries),
  // votos dados (com decremento correcto dos contadores), entries e perfil na
  // Realtime Database, e por fim a conta de autenticação.
  const handleDeleteAccount = async () => {
    if (!uid || deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD) return;

    setDeleting(true);

    try {
      // 1. Apagar votos dados por este utilizador (com decremento dos contadores)
      setDeleteStep('A remover votos...');
      const challengesSnap = await get(ref(db, 'challenges'));
      if (challengesSnap.exists()) {
        const challengeIds = Object.keys(challengesSnap.val());
        await Promise.all(
          challengeIds.map(async challengeId => {
            const voteSnap = await get(ref(db, `votes/${challengeId}/${uid}`));
            if (!voteSnap.exists()) return;
            const votedEntryId = voteSnap.val()?.entryId;

            await remove(ref(db, `votes/${challengeId}/${uid}`));

            if (votedEntryId) {
              await runTransaction(
                ref(db, `entries/${challengeId}/${votedEntryId}/votes`),
                current => Math.max((current || 0) - 1, 0)
              );
              await runTransaction(
                ref(db, `challenges/${challengeId}/totalVotes`),
                current => Math.max((current || 0) - 1, 0)
              );
            }
          })
        );
      }

      // 2. Apagar as próprias entries (ficheiros no Storage + nó na Database)
      setDeleteStep('A remover as tuas participações...');
      for (const entry of entries) {
        try {
          const mediaRef = storageRef(storage, entry.mediaUrl);
          await deleteObject(mediaRef);
        } catch (e) {
          // ficheiro pode já não existir — não bloqueia o resto da eliminação
          console.warn('Não foi possível apagar ficheiro de media:', e);
        }
        await remove(ref(db, `entries/${entry.challengeId}/${entry.id}`));
      }

      // 3. Apagar avatar no Storage (se existir)
      if (profile?.avatar) {
        try {
          const avatarRef = storageRef(storage, profile.avatar);
          await deleteObject(avatarRef);
        } catch (e) {
          console.warn('Não foi possível apagar avatar:', e);
        }
      }

      // 4. Apagar o nó de perfil
      setDeleteStep('A remover o teu perfil...');
      await remove(ref(db, `users/${uid}`));

      // 5. Apagar a conta de autenticação por último
      setDeleteStep('A finalizar...');
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }

      router.replace('/auth/login');
    } catch (e: any) {
      console.error('Erro ao eliminar conta:', e);

      if (e?.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Sessão expirada',
          'Por segurança, precisas de sair e entrar novamente antes de eliminar a conta. Os teus dados de participações e votos já foram removidos — falta apenas a conta de acesso.',
          [
            {
              text: 'Sair agora',
              onPress: async () => {
                await signOut(auth);
                router.replace('/auth/login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Erro', 'Não foi possível concluir a eliminação. Tenta novamente ou contacta o suporte em geral@votasnap.com.');
      }
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      setDeleteStep('');
    }
  };

  const totalVotesReceived = entries.reduce((sum, e) => sum + e.votes, 0);

  const openViewer = (index: number) => setViewerIndex(index);
  const closeViewer = () => setViewerIndex(null);

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>👤</Text>
          <Text style={styles.emptyTitle}>A tua conta</Text>
          <Text style={styles.emptySub}>
            Entra ou cria uma conta para ver o teu perfil,{'\n'}
            histórico de desafios e prémios ganhos.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/login')}
            style={styles.loginWrap}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.loginBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.loginBtnText}>Entrar ou criar conta</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff286a" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Perfil não encontrado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Perfil</Text>
          <View style={styles.headerActions}>
            <View style={styles.snapsBadge}>
              <Text style={styles.snapsIcon}>🪙</Text>
              <Text style={styles.snapsText}>{snaps}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar + info */}
        <View style={styles.profileTop}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={['#ff286a', '#ff8c5a']}
              style={styles.avatarPlaceholder}
            >
              <Text style={styles.avatarText}>
                {profile.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </LinearGradient>
          )}
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/auth/setup-profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.editBtnText}>✏️ Editar perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{snaps}</Text>
            <Text style={styles.statLabel}>Snaps</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{entries.length}</Text>
            <Text style={styles.statLabel}>Desafios</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{totalVotesReceived}</Text>
            <Text style={styles.statLabel}>Votos recebidos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{totalVotesGiven}</Text>
            <Text style={styles.statLabel}>Votos dados</Text>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badgesRow}>
            {entries.length >= 1 && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>🎯</Text>
                <Text style={styles.badgeLabel}>Participante</Text>
              </View>
            )}
            {totalVotesReceived >= 10 && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>⭐</Text>
                <Text style={styles.badgeLabel}>Popular</Text>
              </View>
            )}
            {totalVotesReceived >= 100 && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>🔥</Text>
                <Text style={styles.badgeLabel}>Em chamas</Text>
              </View>
            )}
            {totalVotesGiven >= 10 && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>🗳️</Text>
                <Text style={styles.badgeLabel}>Votante activo</Text>
              </View>
            )}
            {entries.length === 0 && totalVotesGiven === 0 && (
              <Text style={styles.noBadges}>
                Participa em desafios para ganhar badges!
              </Text>
            )}
          </View>
        </View>

        {/* Entradas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            As minhas entradas ({entries.length})
          </Text>

          {entries.length === 0 ? (
            <View style={styles.emptyEntries}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyText}>
                Ainda não participaste em nenhum desafio
              </Text>
            </View>
          ) : (
            entries.map((entry, i) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.entryCard}
                onPress={() => openViewer(i)}
                activeOpacity={0.8}
              >
                {entry.mediaType === 'video' ? (
                  <View style={[styles.entryThumb, styles.entryThumbVideo]}>
                    <Text style={styles.entryThumbVideoIcon}>▶️</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: entry.mediaUrl }}
                    style={styles.entryThumb}
                    resizeMode="cover"
                  />
                )}

                <View style={styles.entryInfo}>
                  <Text style={styles.entryChallenge} numberOfLines={1}>
                    {entry.challengeTitle}
                  </Text>
                  <Text style={styles.entryCaption} numberOfLines={1}>
                    {entry.caption}
                  </Text>
                  <View style={styles.entryMeta}>
                    <Text style={styles.entryVotes}>🗳️ {entry.votes} votos</Text>
                    {entry.isWinner ? (
                      <View style={styles.topBadge}>
                        <Text style={styles.topBadgeText}>🏆 Vencedor</Text>
                      </View>
                    ) : (
                      i === 0 && entries.length > 1 && (
                        <View style={styles.topBadge}>
                          <Text style={styles.topBadgeText}>🥇 Melhor entrada</Text>
                        </View>
                      )
                    )}
                  </View>
                </View>

                <Text style={styles.entryArrow}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Zona de risco */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zona de risco</Text>
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteAccountBtnText}>🗑️ Eliminar a minha conta</Text>
          </TouchableOpacity>
          <Text style={styles.deleteAccountHint}>
            Remove permanentemente o teu perfil, participações, votos e avatar. Esta ação não pode ser revertida.
          </Text>
        </View>
      </ScrollView>

      {/* Viewer em tela cheia */}
      {viewerIndex !== null && (
        <View style={styles.viewerOverlay}>
          <FlatList
            data={entries}
            keyExtractor={item => item.id}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={height}
            snapToAlignment="start"
            renderItem={({ item }) => (
              <View style={{ width, height }}>
                <FeedCard
                  entry={item}
                  isActive={true}
                  hasVoted={false}
                  isOwnEntry={true}
                  canLike={false}
                  isLiking={false}
                  onLike={() => {}}
                />
              </View>
            )}
          />

          <TouchableOpacity
            style={[styles.closeBtn, { top: insets.top + 10 }]}
            onPress={closeViewer}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de confirmação de eliminação de conta */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {deleting ? (
              <View style={styles.deletingWrap}>
                <ActivityIndicator color="#ff286a" size="large" />
                <Text style={styles.deletingText}>{deleteStep || 'A eliminar...'}</Text>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalIcon}>⚠️</Text>
                  <Text style={styles.modalTitle}>Eliminar conta</Text>
                </View>
                <Text style={styles.modalText}>
                  Isto vai apagar permanentemente o teu perfil, participações, votos e avatar.
                  Não é possível recuperar depois. Para confirmar, escreve{' '}
                  <Text style={{ color: '#ff286a', fontFamily: 'Inter_700Bold' }}>{DELETE_CONFIRM_WORD}</Text> abaixo.
                </Text>

                <TextInput
                  style={styles.confirmInput}
                  placeholder={DELETE_CONFIRM_WORD}
                  placeholderTextColor="#444"
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => {
                      setShowDeleteModal(false);
                      setDeleteConfirmText('');
                    }}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonDelete,
                      deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD && styles.modalButtonDisabled,
                    ]}
                    onPress={handleDeleteAccount}
                    disabled={deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD}
                  >
                    <Text style={styles.modalButtonTextDelete}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', fontSize: 16, fontFamily: 'Inter_500Medium' },
  scroll: { paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  snapsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,215,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  snapsIcon: { fontSize: 13 },
  snapsText: { color: '#FFD700', fontSize: 13, fontFamily: 'Inter_700Bold' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  logoutBtn: {
    backgroundColor: '#e41e1e',
    borderWidth: 0.5,
    borderColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  logoutText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_400Regular' },

  profileTop: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#ff286a',
    marginBottom: 4,
  },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { color: '#fff', fontSize: 36, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff' },
  username: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#888' },
  bio: {
    fontSize: 14, fontFamily: 'Inter_400Regular', color: '#aaa',
    textAlign: 'center', lineHeight: 20, paddingHorizontal: 32,
  },
  editBtn: {
    marginTop: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 0.5,
    borderColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#1a1a1a',
    marginBottom: 8,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNum: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#555', marginTop: 2 },
  statDivider: { width: 0.5, backgroundColor: '#1a1a1a', marginVertical: 12 },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: {
    fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 12,
  },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  badge: {
    backgroundColor: '#111',
    borderWidth: 0.5,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  badgeEmoji: { fontSize: 22 },
  badgeLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#888' },
  noBadges: { color: '#555', fontSize: 13, fontFamily: 'Inter_400Regular' },

  emptyEntries: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: {
    color: '#555', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center',
  },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#1a1a1a',
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  entryThumb: {
    width: 60, height: 60, borderRadius: 10, backgroundColor: '#1a1a1a',
  },
  entryThumbVideo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryThumbVideoIcon: { fontSize: 18, opacity: 0.7 },
  entryInfo: { flex: 1, gap: 4 },
  entryChallenge: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  entryCaption: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#666' },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryVotes: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#ff286a' },
  topBadge: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 0.5,
    borderColor: '#FFD700',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFD700' },
  entryArrow: { color: '#555', fontSize: 20 },

  emptyTitle: {
    color: '#fff', fontSize: 20,
    fontFamily: 'Inter_700Bold', textAlign: 'center',
  },
  emptySub: {
    color: '#888', fontSize: 14,
    fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22,
  },
  loginWrap: { borderRadius: 14, overflow: 'hidden', width: '85%', marginTop: 8 },
  loginBtn: { paddingVertical: 16, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  // Zona de risco
  deleteAccountBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteAccountBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  deleteAccountHint: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },

  viewerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
    zIndex: 100,
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 110,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 0.5,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  modalText: {
    fontSize: 13.5,
    fontFamily: 'Inter_400Regular',
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  confirmInput: {
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 18,
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
    backgroundColor: '#2a2a2a',
  },
  modalButtonDelete: {
    backgroundColor: '#ef4444',
  },
  modalButtonDisabled: {
    opacity: 0.35,
  },
  modalButtonTextCancel: {
    color: '#aaa',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  modalButtonTextDelete: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  deletingWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  deletingText: {
    color: '#aaa',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});