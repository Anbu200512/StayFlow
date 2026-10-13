import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let transporter: Transporter | undefined;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    return undefined;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return transporter;
}

export async function sendEmail(options: { to: string; subject: string; text: string; html?: string; replyTo?: string }) {
  const mailer = getTransporter();
  if (!mailer) {
    console.info(`[email skipped] ${options.subject} -> ${options.to}`);
    return;
  }
  await mailer.sendMail({ from: env.SMTP_FROM, ...options });
}
