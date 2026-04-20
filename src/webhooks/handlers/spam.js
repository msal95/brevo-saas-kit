import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  event: z.string(),
  messageId: z.string().optional(),
  date: z.string().optional(),
  subject: z.string().optional(),
  tag: z.string().optional(),
});

/**
 * Handle a Brevo spam complaint webhook event.
 * The contact should be immediately unsubscribed from all marketing sends.
 * @param {object} payload - Raw webhook payload from Brevo
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function handleSpam(payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `handleSpam validation failed: ${msg}` };
  }

  const { email, messageId, date, subject, tag } = parsed.data;

  return {
    success: true,
    data: {
      type: 'spam',
      email,
      messageId: messageId ?? null,
      subject: subject ?? null,
      tag: tag ?? null,
      reportedAt: date ?? new Date().toISOString(),
    },
  };
}
