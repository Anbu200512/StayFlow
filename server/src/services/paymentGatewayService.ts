import Razorpay from 'razorpay';
import { env } from '../config/env.js';

let client: Razorpay | undefined;

function getClient(): Razorpay | undefined {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return undefined;
  client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}

export async function createRazorpayOrder(input: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }) {
  const razorpay = getClient();
  if (!razorpay) return null;
  return razorpay.orders.create({ amount: Math.round(input.amount * 100), currency: input.currency, receipt: input.receipt, notes: input.notes });
}

export async function verifyRazorpaySignature(input: { orderId: string; paymentId: string; signature: string }): Promise<boolean> {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const crypto = await import('node:crypto');
  const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${input.orderId}|${input.paymentId}`).digest('hex');
  return expected === input.signature;
}
