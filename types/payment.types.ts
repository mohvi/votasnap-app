export type PaymentStatus = 'idle' | 'loading' | 'paid' | 'pending' | 'error';
export interface PaymentResult {
  txId: string;
  amount: number;
  challengeId: string;
  method: 'mpesa' | 'manual';
}
export interface PaymentCheck { paid: boolean; pending: boolean; }
