import { z } from 'zod';
import { sendEmail } from './sendEmail.js';
import { layout, heading, para, btn } from './html.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  dashboardUrl: z.string().url().optional(),
  appName: z.string().optional(),
});

function buildHtml({ name, dashboardUrl, appName }) {
  const app = appName ?? 'our app';
  const body = [
    heading(`Welcome to ${app}, ${name}!`),
    para(`We're thrilled to have you on board. Your account is all set up and ready to go.`),
    para(`Here's what you can do next:`),
    `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:2;color:#374151;">
      <li>Explore your dashboard</li>
      <li>Complete your profile</li>
      <li>Invite teammates</li>
    </ul>`,
    dashboardUrl ? btn('Go to Dashboard', dashboardUrl) : '',
    para(`If you have any questions, just reply to this email — we're happy to help.`),
  ].join('');

  return layout({
    title: `Welcome to ${app}`,
    preheader: `Welcome aboard, ${name}! Your account is ready.`,
    body,
  });
}

/**
 * Send a welcome email to a newly registered user.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {string} [options.dashboardUrl] - URL to the user's dashboard
 * @param {string} [options.appName] - Your app's display name (falls back to sender name)
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendWelcomeEmail(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendWelcomeEmail validation failed: ${msg}` };
  }

  const { email, name, dashboardUrl, appName } = parsed.data;

  return sendEmail({
    to: email,
    subject: `Welcome${appName ? ` to ${appName}` : ''}! 🎉`,
    htmlContent: buildHtml({ name, dashboardUrl, appName }),
  });
}
