import { useCallback, useRef, useState } from 'react';
import { authenticatedRequest } from '../services/api';
import type { PaymentCheck, PaymentResult, PaymentStatus } from '../types/payment.types';
export type { PaymentResult, PaymentStatus } from '../types/payment.types';

export function useChallengePayment() {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const inFlight = useRef(false);

  const checkPaymentStatus = useCallback(async (challengeId: string): Promise<PaymentCheck> => {
    const data = await authenticatedRequest<PaymentCheck>('/api/payments/check/' + encodeURIComponent(challengeId));
    if (typeof data.paid !== 'boolean' || typeof data.pending !== 'boolean') {
      throw new Error('Resposta de pagamento inválida.');
    }
    return data;
  }, []);

  const payChallenge = useCallback(async (challengeId: string, phoneNumber: string): Promise<PaymentResult | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setStatus('loading'); setError(null); setResult(null);
    try {
      const phone = phoneNumber.replace(/\D/g, '');
      const normalized = phone.startsWith('258') ? phone : '258' + phone;
      if (!/^258[87]\d{8}$/.test(normalized)) throw new Error('Número de telefone inválido.');
      const data = await authenticatedRequest<PaymentResult & { success: boolean }>('/api/payments/process', {
        challengeId, phoneNumber: normalized,
      });
      if (data.success !== true || !data.txId || data.challengeId !== challengeId ||
          !Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Pagamento não confirmado. Verifica o estado antes de tentar novamente.');
      }
      const payment: PaymentResult = { txId: data.txId, amount: data.amount, challengeId, method: 'mpesa' };
      setResult(payment); setStatus('paid');
      return payment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar o pagamento.');
      setStatus('error');
      return null;
    } finally { inFlight.current = false; }
  }, []);

  const registerManualPayment = useCallback(async (challengeId: string, _amount: number): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true; setError(null);
    try {
      await authenticatedRequest('/api/payments/manual-request', { challengeId });
      setStatus('pending');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registar o pedido.');
      setStatus('error');
      return false;
    } finally { inFlight.current = false; }
  }, []);

  const reset = useCallback(() => {
    if (inFlight.current) return;
    setStatus('idle'); setError(null); setResult(null);
  }, []);
  return { status, error, result, loading: status === 'loading', isPaid: status === 'paid',
    isPending: status === 'pending', payChallenge, registerManualPayment, checkPaymentStatus, reset };
}
