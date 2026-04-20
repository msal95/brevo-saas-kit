import { z } from 'zod';
import * as Brevo from '@getbrevo/brevo';
import { getTransactionalApi, getSenderConfig } from '../config/brevoClient.js';

const recipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const schema = z.object({
  to: z.union([z.string().email(), z.array(recipientSchema).min(1)]),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  sender: z
    .object({ email: z.string().email(), name: z.string() })
    .optional(),
  replyTo: z
    .object({ email: z.string().email(), name: z.string().optional() })
    .optional(),
  tags: z.array(z.string()).optional(),
});

function normalizeRecipients(to) {
  if (typeof to === 'string') return [{ email: to }];
  return to;
}

/**
 * Send a transactional email via Brevo.
 * @param {object} options
 * @param {string|Array<{email:string,name?:string}>} options.to - Recipient(s)
 * @param {string} options.subject - Email subject line
 * @param {string} options.htmlContent - HTML body
 * @param {string} [options.textContent] - Plain text fallback
 * @param {{email:string,name:string}} [options.sender] - Override default sender
 * @param {{email:string,name?:string}} [options.replyTo] - Reply-to address
 * @param {string[]} [options.tags] - Brevo email tags for tracking
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendEmail(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendEmail validation failed: ${msg}` };
  }

  const { to, subject, htmlContent, textContent, sender, replyTo, tags } = parsed.data;

  try {
    const api = getTransactionalApi();
    const defaultSender = getSenderConfig();

    const email = new Brevo.SendSmtpEmail();
    email.sender = sender ?? defaultSender;
    email.to = normalizeRecipients(to);
    email.subject = subject;
    email.htmlContent = htmlContent;
    if (textContent) email.textContent = textContent;
    if (replyTo) email.replyTo = replyTo;
    if (tags?.length) email.tags = tags;

    const response = await api.sendTransacEmail(email);
    return { success: true, data: { messageId: response.body?.messageId ?? null } };
  } catch (err) {
    const msg = err?.response?.body?.message ?? err?.message ?? 'Unknown Brevo API error';
    return { success: false, error: `sendEmail failed: ${msg}` };
  }
}
