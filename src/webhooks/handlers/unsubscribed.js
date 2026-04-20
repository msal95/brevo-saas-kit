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
 * Handle a Brevo unsubscribe webhook event.
 * The contact has opted out and must not receive future marketing emails.
 * @param {object} payload - Raw webhook payload from Brevo
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function handleUnsubscribed(payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `handleUnsubscribed validation failed: ${msg}` };
  }

  const { email, messageId, date, subject, tag } = parsed.data;

  return {
    success: true,
    data: {
      type: 'unsubscribed',
      email,
      messageId: messageId ?? null,
      subject: subject ?? null,
      tag: tag ?? null,
      unsubscribedAt: date ?? new Date().toISOString(),
    },
  };
}
