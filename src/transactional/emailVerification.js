import { z } from 'zod';
import { sendEmail } from './sendEmail.js';
import { layout, heading, para } from './html.js';
import { EMAIL_DEFAULTS } from '../config/constants.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  otp: z.string().min(4).max(10),
  expiresInMinutes: z.number().int().positive().optional(),
  appName: z.string().optional(),
});

function buildHtml({ name, otp, expiresInMinutes, appName }) {
  const app = appName ?? 'your account';
  const expiry = expiresInMinutes ?? EMAIL_DEFAULTS.OTP_EXPIRY_MINUTES;
  const body = [
    heading('Verify your email address'),
    para(`Hi ${name}, please use the verification code below to confirm your email address for ${app}.`),
    `<div style="margin:24px 0;text-align:center;">
      <div style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:20px 36px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827;">${otp}</span>
      </div>
    </div>`,
    para(`This code expires in <strong>${expiry} minutes</strong>. Do not share it with anyone.`),
    para(`If you didn't request this, you can safely ignore this email.`),
  ].join('');

  return layout({
    title: 'Email Verification',
    preheader: `Your verification code is ${otp}`,
    body,
  });
}

/**
 * Send an email verification OTP to the user.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {string} options.otp - One-time verification code (4–10 chars)
 * @param {number} [options.expiresInMinutes] - Code expiry in minutes (default: 10)
 * @param {string} [options.appName] - Your app's display name
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendVerificationEmail(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendVerificationEmail validation failed: ${msg}` };
  }

  const { email, name, otp, expiresInMinutes, appName } = parsed.data;

  return sendEmail({
    to: email,
    subject: `Your verification code: ${otp}`,
    htmlContent: buildHtml({ name, otp, expiresInMinutes, appName }),
  });
}
