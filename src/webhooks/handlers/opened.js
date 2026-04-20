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
 * Handle a Brevo email opened webhook event.
 * @param {object} payload - Raw webhook payload from Brevo
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function handleOpened(payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `handleOpened validation failed: ${msg}` };
  }

  const { email, messageId, date, subject, tag } = parsed.data;

  return {
    success: true,
    data: {
      type: 'opened',
      email,
      messageId: messageId ?? null,
      subject: subject ?? null,
      tag: tag ?? null,
      openedAt: date ?? new Date().toISOString(),
    },
  };
}
