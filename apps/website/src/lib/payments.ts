import { publicApi } from './api';

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: RazorpayResponse | RazorpayFailure) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('razorpay-checkout') as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.id = 'razorpay-checkout';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay checkout could not be loaded'));
    if (!existing) document.head.appendChild(script);
  });
}

export async function completeRazorpayPayment(input: { reservationId: string; paymentId: string; order: { id: string; amount?: number; currency?: string }; email?: string; phone?: string }) {
  await loadRazorpay();
  if (!window.Razorpay) throw new Error('Razorpay checkout is not available');
  return new Promise<void>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: import.meta.env.VITE_RAZORPAY_KEY,
      amount: input.order.amount,
      currency: input.order.currency ?? 'INR',
      order_id: input.order.id,
      prefill: { email: input.email, contact: input.phone },
      handler: async (response: RazorpayResponse) => {
        try {
          await publicApi.confirmPayment({ reservationId: input.reservationId, paymentId: input.paymentId, orderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      modal: { ondismiss: () => reject(new Error('Payment was cancelled')) },
    });
    checkout.on('payment.failed', (response) => { const failure = response as RazorpayFailure; reject(new Error(failure.error?.description ?? 'Payment failed')); });
    checkout.open();
  });
}
