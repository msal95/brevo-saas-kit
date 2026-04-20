import { z } from 'zod';
import * as Brevo from '@getbrevo/brevo';
import { getTransactionalApi, getSenderConfig } from '../config/brevoClient.js';

const schema = z.object({
  to: z.union([
    z.string().email(),
    z.array(z.object({ email: z.string().email(), name: z.string().optional() })).min(1),
  ]),
  templateId: z.number().int().positive(),
  params: z.record(z.unknown()).optional(),
  sender: z.object({ email: z.string().email(), name: z.string() }).optional(),
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
 * Send an email using a Brevo template ID. Template variables are passed via params.
 * Template IDs are found in your Brevo dashboard under Email → Templates.
 * @param {object} options
 * @param {string|Array<{email:string,name?:string}>} options.to - Recipient(s)
 * @param {number} options.templateId - Brevo template ID (integer)
 * @param {Record<string,unknown>} [options.params] - Template variable substitutions
 * @param {{email:string,name:string}} [options.sender] - Override default sender
 * @param {{email:string,name?:string}} [options.replyTo] - Reply-to address
 * @param {string[]} [options.tags] - Brevo email tags for tracking
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendTemplateEmail(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendTemplateEmail validation failed: ${msg}` };
  }

  const { to, templateId, params, sender, replyTo, tags } = parsed.data;

  try {
    const api = getTransactionalApi();
    const defaultSender = getSenderConfig();

    const email = new Brevo.SendSmtpEmail();
    email.sender = sender ?? defaultSender;
    email.to = normalizeRecipients(to);
    email.templateId = templateId;
    if (params) email.params = params;
    if (replyTo) email.replyTo = replyTo;
    if (tags?.length) email.tags = tags;

    const response = await api.sendTransacEmail(email);
    return { success: true, data: { messageId: response.body?.messageId ?? null } };
  } catch (err) {
    const msg = err?.response?.body?.message ?? err?.message ?? 'Unknown Brevo API error';
    return { success: false, error: `sendTemplateEmail failed: ${msg}` };
  }
}
