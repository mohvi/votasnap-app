// components/ChallengePaymentModal.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { JSX, useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { useChallengePayment } from '../../hooks/useChallengePayment';
import { PaymentResult } from '../../types/payment.types';
import { Challenge } from '../../hooks/useChallenges';
import { colors, gradients } from '../../constants/theme';



interface ChallengePaymentModalProps {
  visible: boolean;
  challenge: Challenge | null;
  onClose: () => void;
  onSuccess: (data: PaymentResult) => void;
}

export function ChallengePaymentModal({
  visible,
  challenge,
  onClose,
  onSuccess,
}: ChallengePaymentModalProps): JSX.Element {
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [showPhoneInput, setShowPhoneInput] = useState<boolean>(true);

  const {
    loading, error, isPaid: success, result: paymentData,
    payChallenge, reset: resetPaymentState,
  } = useChallengePayment();

  useEffect(() => {
    if (visible) { resetPaymentState(); setPhoneInput(''); setShowPhoneInput(true); }
  }, [visible, resetPaymentState]);

  const handleSubmit = useCallback(async () => {
    if (loading || !challenge) return;
    const result = await payChallenge(challenge.id, phoneInput);
    if (result) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess(result);
    }
  }, [loading, challenge, phoneInput, payChallenge, onSuccess]);

  // Estados de carregamento
  if (loading) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Processando Pagamento</Text>
            <Text style={styles.loadingSubtitle}>
              Aguarde enquanto processamos seu pagamento...
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Estado de sucesso
  if (success) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Pagamento Confirmado!</Text>
            <Text style={styles.successSubtitle}>
              Desafio pago com sucesso. Você pode participar agora!
            </Text>
            {paymentData && (
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentInfoText}>
                  Referência: <Text style={styles.paymentInfoValue}>{paymentData.txId}</Text>
                </Text>
                <Text style={styles.paymentInfoText}>
                  Valor: <Text style={styles.paymentInfoAmount}>{paymentData.amount} MT</Text>
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => {
                resetPaymentState();
                onClose();
              }}
              style={styles.continueButton}
            >
              <Text style={styles.continueButtonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Formulário de pagamento
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.handleBar} />

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Pagamento do Desafio</Text>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={loading}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textSubtle} />
                </TouchableOpacity>
              </View>

              {/* Informações do desafio */}
              <View style={styles.challengeInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Desafio</Text>
                  <Text style={styles.infoValue}>{challenge?.title}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Valor</Text>
                  <Text style={styles.infoAmount}>
                    {challenge?.entryFee ?? 0} MT
                  </Text>
                </View>
                {challenge?.type === 'paid' && (
                  <View style={styles.paidBadge}>
                    <Ionicons name="alert-circle" size={14} color={colors.warning} />
                    <Text style={styles.paidBadgeText}>
                      Pagamento único por desafio
                    </Text>
                  </View>
                )}
              </View>

              {/* Input de telefone */}
              {showPhoneInput && (
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.phoneInputLabel}>
                    Número de Telefone (M-Pesa)
                  </Text>
                  <View style={styles.phoneInputWrapper}>
                    <View style={styles.phonePrefix}>
                      <Text style={styles.phonePrefixText}>+258</Text>
                    </View>
                    <TextInput
                      value={phoneInput}
                      onChangeText={setPhoneInput}
                      placeholder="840000000"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="phone-pad"
                      style={styles.phoneInput}
                    />
                  </View>
                  <Text style={styles.phoneInputHint}>
                    Insira o número registrado no M-Pesa
                  </Text>
                </View>
              )}

              {!showPhoneInput && (
                <TouchableOpacity
                  onPress={() => setShowPhoneInput(true)}
                  style={styles.changePhoneButton}
                >
                  <Text style={styles.changePhoneText}>
                    Usar outro número de telefone
                  </Text>
                </TouchableOpacity>
              )}

              {/* Botão de pagamento */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.payButton}
                >
                  <View style={styles.payButtonContent}>
                    <Ionicons name="card-outline" size={20} color="white" />
                    <Text style={styles.payButtonText}>
                      Pagar {challenge?.entryFee ?? 0} MT
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Mensagem de erro */}
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Termos */}
              <Text style={styles.termsText}>
                Ao pagar, você concorda com os Termos de Serviço e Política de Privacidade
              </Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Estilos
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSubtitle: {
    color: colors.textSubtle,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  successContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  successSubtitle: {
    color: colors.textSubtle,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  paymentInfo: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  paymentInfoText: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  paymentInfoValue: {
    color: colors.primary,
  },
  paymentInfoAmount: {
    color: colors.success,
  },
  continueButton: {
    marginTop: 24,
    width: '100%',
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '60%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderStrong,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  challengeInfo: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    color: colors.textSubtle,
    fontSize: 14,
  },
  infoValue: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  infoAmount: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 8,
  },
  paidBadgeText: {
    color: 'rgba(245, 158, 11, 0.7)',
    fontSize: 12,
  },
  phoneInputContainer: {
    marginBottom: 16,
  },
  phoneInputLabel: {
    color: colors.textSubtle,
    fontSize: 14,
    marginBottom: 8,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  phonePrefix: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  phonePrefixText: {
    color: colors.textSubtle,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  phoneInputHint: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 4,
  },
  changePhoneButton: {
    marginBottom: 16,
  },
  changePhoneText: {
    color: colors.primary,
    fontSize: 14,
  },
  payButton: {
    paddingVertical: 14,
    borderRadius: 12,
  },
  payButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  errorContainer: {
    marginTop: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    flex: 1,
  },
  termsText: {
    color: colors.textSubtle,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});