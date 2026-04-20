import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  event: z.string(),
  reason: z.string().optional(),
  messageId: z.string().optional(),
  date: z.string().optional(),
  subject: z.string().optional(),
  tag: z.string().optional(),
});

/**
 * Handle a Brevo hard or soft bounce webhook event.
 * On hard bounces, the contact should be marked as invalid and excluded from future sends.
 * @param {object} payload - Raw webhook payload from Brevo
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function handleBounced(payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `handleBounced validation failed: ${msg}` };
  }

  const { email, event, reason, messageId, date, subject, tag } = parsed.data;
  const isHard = event === 'hard_bounce';

  return {
    success: true,
    data: {
      type: isHard ? 'hard_bounce' : 'soft_bounce',
      email,
      isHardBounce: isHard,
      reason: reason ?? null,
      messageId: messageId ?? null,
      subject: subject ?? null,
      tag: tag ?? null,
      bouncedAt: date ?? new Date().toISOString(),
    },
  };
}
