import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  event: z.string(),
  link: z.string().optional(),
  messageId: z.string().optional(),
  date: z.string().optional(),
  subject: z.string().optional(),
  tag: z.string().optional(),
});

/**
 * Handle a Brevo link clicked webhook event.
 * @param {object} payload - Raw webhook payload from Brevo
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function handleClicked(payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `handleClicked validation failed: ${msg}` };
  }

  const { email, link, messageId, date, subject, tag } = parsed.data;

  return {
    success: true,
    data: {
      type: 'clicked',
      email,
      link: link ?? null,
      messageId: messageId ?? null,
      subject: subject ?? null,
      tag: tag ?? null,
      clickedAt: date ?? new Date().toISOString(),
    },
  };
}
