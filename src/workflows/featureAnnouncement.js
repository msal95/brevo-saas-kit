import { z } from 'zod';
import { sendEmail } from '../transactional/sendEmail.js';
import { layout, heading, para, btn } from '../transactional/html.js';

const schema = z.object({
  recipients: z.array(
    z.union([
      z.string().email(),
      z.object({ email: z.string().email(), name: z.string().optional() }),
    ])
  ).min(1),
  featureName: z.string().min(1),
  description: z.string().min(1),
  bulletPoints: z.array(z.string()).optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().url().optional(),
  appName: z.string().optional(),
  sender: z.object({ email: z.string().email(), name: z.string() }).optional(),
});

function buildHtml({ featureName, description, bulletPoints, ctaText, ctaUrl, appName }) {
  const app = appName ?? 'the app';
  const bullets = bulletPoints?.length
    ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:2;color:#374151;">${bulletPoints.map(b => `<li>${b}</li>`).join('')}</ul>`
    : '';

  const body = [
    `<div style="display:inline-block;background:#ede9fe;color:#6d28d9;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:16px;">New in ${app}</div>`,
    heading(`Introducing: ${featureName}`),
    para(description),
    bullets,
    ctaUrl ? btn(ctaText ?? 'See It in Action', ctaUrl) : '',
    para(`As always — reply to this email if you have feedback or questions. We read every reply.`),
  ].join('');

  return layout({
    title: `Introducing ${featureName}`,
    preheader: `New: ${featureName} is now available`,
    body,
  });
}

/**
 * Broadcast a feature announcement email to a list of recipients.
 * For large lists, use bulkSyncContacts + a Brevo campaign instead.
 * @param {object} options
 * @param {Array<string|{email:string,name?:string}>} options.recipients - Recipient list
 * @param {string} options.featureName - Name of the new feature
 * @param {string} options.description - Short description paragraph
 * @param {string[]} [options.bulletPoints] - Feature highlights as bullet points
 * @param {string} [options.ctaText] - Call-to-action button text (default: 'See It in Action')
 * @param {string} [options.ctaUrl] - Call-to-action button URL
 * @param {string} [options.appName] - Your app's display name
 * @param {{email:string,name:string}} [options.sender] - Override default sender
 * @returns {Promise<{success:boolean,data?:{sent:number,failed:number,errors:string[]},error?:string}>}
 */
export async function sendFeatureAnnouncement(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendFeatureAnnouncement validation failed: ${msg}` };
  }

  const { recipients, featureName, description, bulletPoints, ctaText, ctaUrl, appName, sender } = parsed.data;
  const htmlContent = buildHtml({ featureName, description, bulletPoints, ctaText, ctaUrl, appName });

  let sent = 0;
  const errors = [];

  for (const recipient of recipients) {
    const email = typeof recipient === 'string' ? recipient : recipient.email;
    const result = await sendEmail({
      to: email,
      subject: `New: ${featureName} is now available`,
      htmlContent,
      sender,
    });
    if (result.success) {
      sent++;
    } else {
      errors.push(`${email}: ${result.error}`);
    }
  }

  const failed = recipients.length - sent;
  return { success: errors.length === 0, data: { sent, failed, errors } };
}
