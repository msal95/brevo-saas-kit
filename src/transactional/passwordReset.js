import { z } from 'zod';
import { sendEmail } from './sendEmail.js';
import { layout, heading, para, btn } from './html.js';
import { EMAIL_DEFAULTS } from '../config/constants.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  resetUrl: z.string().url(),
  expiresInHours: z.number().int().positive().optional(),
  appName: z.string().optional(),
});

function buildHtml({ name, resetUrl, expiresInHours, appName }) {
  const app = appName ?? 'your account';
  const expiry = expiresInHours ?? EMAIL_DEFAULTS.RESET_EXPIRY_HOURS;
  const body = [
    heading('Reset your password'),
    para(`Hi ${name}, we received a request to reset the password for ${app}.`),
    para(`Click the button below to set a new password. This link expires in <strong>${expiry} hour${expiry !== 1 ? 's' : ''}</strong>.`),
    btn('Reset Password', resetUrl),
    para(`If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.`),
    `<p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      Or copy and paste this URL: <a href="${resetUrl}" style="color:#4f46e5;word-break:break-all;">${resetUrl}</a>
    </p>`,
  ].join('');

  return layout({
    title: 'Password Reset',
    preheader: `Reset your password — link expires in ${expiry}h`,
    body,
  });
}

/**
 * Send a password reset link email.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {string} options.resetUrl - Signed URL to the password reset page
 * @param {number} [options.expiresInHours] - Link expiry in hours (default: 1)
 * @param {string} [options.appName] - Your app's display name
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendPasswordResetEmail(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendPasswordResetEmail validation failed: ${msg}` };
  }

  const { email, name, resetUrl, expiresInHours, appName } = parsed.data;

  return sendEmail({
    to: email,
    subject: 'Reset your password',
    htmlContent: buildHtml({ name, resetUrl, expiresInHours, appName }),
  });
}
