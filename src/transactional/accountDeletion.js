import { z } from 'zod';
import { sendEmail } from './sendEmail.js';
import { layout, heading, para } from './html.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  deletedAt: z.string().optional(),
  appName: z.string().optional(),
  feedbackUrl: z.string().url().optional(),
});

function buildHtml({ name, deletedAt, appName, feedbackUrl }) {
  const app = appName ?? 'our service';
  const dateStr = deletedAt ?? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const body = [
    heading('Your account has been deleted'),
    para(`Hi ${name}, we're confirming that your ${app} account and all associated data have been permanently deleted on ${dateStr}.`),
    `<div style="background:#fff7ed;border-left:4px solid #f97316;padding:16px 20px;border-radius:4px;margin:24px 0;">
      <p style="margin:0;font-size:14px;color:#92400e;">
        <strong>This action is irreversible.</strong> All your data, including settings, history, and files, has been removed from our systems.
      </p>
    </div>`,
    para(`We're sorry to see you go. If this was a mistake or you'd like to return, you're always welcome to create a new account.`),
    feedbackUrl
      ? para(`We'd appreciate your feedback on why you left: <a href="${feedbackUrl}" style="color:#4f46e5;">Share feedback</a>`)
      : '',
    para(`Thank you for being a customer.`),
  ].join('');

  return layout({
    title: 'Account Deleted',
    preheader: `Your ${app} account has been permanently deleted.`,
    body,
    footerText: 'This is an automated confirmation of your account deletion request.',
  });
}

/**
 * Send an account deletion confirmation email.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {string} [options.deletedAt] - Human-readable deletion date (defaults to today)
 * @param {string} [options.appName] - Your app's display name
 * @param {string} [options.feedbackUrl] - URL to a feedback/survey form
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendAccountDeletionEmail(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendAccountDeletionEmail validation failed: ${msg}` };
  }

  const { email, name, deletedAt, appName, feedbackUrl } = parsed.data;

  return sendEmail({
    to: email,
    subject: 'Your account has been deleted',
    htmlContent: buildHtml({ name, deletedAt, appName, feedbackUrl }),
  });
}
