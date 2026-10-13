import { Hotel, Invoice, InvoiceItem, Payment, type InvoiceDocument } from '../models/index.js';
import { InvoiceStatus, PaymentMethod, PaymentStatus } from '../types/enums.js';
import { AppError } from '../utils/error.js';
import { roundMoney } from '../utils/common.js';
import type { PricingSnapshot, SelectedService } from '../types/domain.js';

export async function createInvoiceForReservation(input: {
  hotelId: string;
  reservationId: any;
  guestId: any;
  roomId: any;
  pricing: PricingSnapshot;
  services: SelectedService[];
  checkIn: Date;
  checkOut: Date;
  invoiceNumber: string;
  session?: any;
}): Promise<InvoiceDocument> {
  const [invoice] = await Invoice.create([{
    hotelId: input.hotelId,
    invoiceNumber: input.invoiceNumber,
    reservationId: input.reservationId,
    guestId: input.guestId,
    roomSubtotal: input.pricing.roomSubtotal,
    servicesSubtotal: input.pricing.servicesSubtotal,
    subtotal: input.pricing.subtotal,
    tax: input.pricing.tax,
    discount: input.pricing.discount,
    total: input.pricing.total,
    amountPaid: 0,
    balance: input.pricing.total,
    currency: input.pricing.currency,
    status: InvoiceStatus.ISSUED,
    issuedAt: new Date(),
  }], { session: input.session });
  const roomItem = await InvoiceItem.create([{
    hotelId: input.hotelId,
    invoiceId: invoice._id,
    reservationId: input.reservationId,
    type: 'room',
    description: `Room charge for ${input.checkIn.toISOString().slice(0, 10)} to ${input.checkOut.toISOString().slice(0, 10)}`,
    quantity: Math.max(1, Math.round((input.checkOut.getTime() - input.checkIn.getTime()) / 86400000)),
    unitPrice: roundMoney(input.pricing.roomSubtotal / Math.max(1, Math.round((input.checkOut.getTime() - input.checkIn.getTime()) / 86400000))),
    amount: input.pricing.roomSubtotal,
    taxAmount: 0,
  }], { session: input.session });
  for (const service of input.services) {
    await InvoiceItem.create([{
      hotelId: input.hotelId,
      invoiceId: invoice._id,
      reservationId: input.reservationId,
      type: 'service',
      description: service.name,
      quantity: service.quantity,
      unitPrice: service.unitPrice,
      amount: service.total,
      taxAmount: 0,
    }], { session: input.session });
  }
  invoice.items = (await InvoiceItem.find({ invoiceId: invoice._id }).session(input.session ?? null).select('_id')).map((item) => item._id);
  void roomItem;
  await invoice.save({ session: input.session });
  return invoice;
}

async function resolveCurrency(hotelId: string, invoiceId?: any): Promise<string> {
  if (invoiceId) {
    const invoice = await Invoice.findById(invoiceId).select('currency').lean();
    if (invoice?.currency) return invoice.currency;
  }
  const hotel = await Hotel.findById(hotelId).select('currency').lean();
  return hotel?.currency ?? 'INR';
}

export async function recordPayment(input: {
  hotelId: string;
  reservationId?: any;
  stayId?: any;
  guestId?: any;
  invoiceId?: any;
  amount: number;
  method: PaymentMethod;
  status?: PaymentStatus;
  providerPaymentId?: string;
  providerOrderId?: string;
  recordedBy?: any;
  notes?: string;
  session?: any;
}) {
  if (input.amount <= 0) throw new AppError('Payment amount must be greater than zero', 400, 'INVALID_PAYMENT_AMOUNT');
  const currency = await resolveCurrency(input.hotelId, input.invoiceId);
  const [payment] = await Payment.create([{
    hotelId: input.hotelId,
    reservationId: input.reservationId,
    stayId: input.stayId,
    guestId: input.guestId,
    invoiceId: input.invoiceId,
    amount: roundMoney(input.amount),
    method: input.method,
    status: input.status ?? PaymentStatus.PAID,
    currency,
    providerPaymentId: input.providerPaymentId,
    providerOrderId: input.providerOrderId,
    paidAt: input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIALLY_PAID ? new Date() : undefined,
    recordedBy: input.recordedBy,
    notes: input.notes,
  }], { session: input.session });
  if (input.invoiceId && (input.status === PaymentStatus.PAID || input.status === undefined || input.status === PaymentStatus.PARTIALLY_PAID)) {
    try {
      await updateInvoicePayment(input.invoiceId, payment.amount, input.session);
    } catch (error) {
      if (!input.session) await Payment.deleteOne({ _id: payment._id });
      throw error;
    }
  }
  return payment;
}

export async function updateInvoicePayment(invoiceId: any, amount: number, session?: any) {
  if (amount <= 0) throw new AppError('Payment amount must be greater than zero', 400, 'INVALID_PAYMENT_AMOUNT');
  const paidExpression = { $add: [{ $ifNull: ['$amountPaid', 0] }, amount] };
  const balanceExpression = { $subtract: [{ $ifNull: ['$total', 0] }, paidExpression] };
  const invoice = await Invoice.findOneAndUpdate(
    { _id: invoiceId, balance: { $gte: amount } },
    [{
      $set: {
        amountPaid: paidExpression,
        balance: { $max: [0, balanceExpression] },
        status: { $cond: [{ $lte: [balanceExpression, 0] }, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] },
      },
    }],
    { new: true, session },
  );
  if (!invoice) {
    const exists = await Invoice.exists({ _id: invoiceId }).session(session ?? null);
    if (!exists) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    throw new AppError('Payment exceeds the outstanding invoice balance', 400, 'PAYMENT_EXCEEDS_BALANCE');
  }
  return invoice;
}
