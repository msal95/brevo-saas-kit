import { z } from 'zod';
import { getContactsApi } from '../config/brevoClient.js';

const schema = z.object({
  email: z.string().email(),
  logger: z.any().optional(),
});

/**
 * Erase a contact from Brevo — GDPR right to erasure.
 * Deletes the contact record entirely from Brevo.
 * @param {string} email - Contact email to erase
 * @param {object} [options]
 * @param {object} [options.logger] - Custom logger with .info() and .error() methods
 * @returns {Promise<{success:boolean,data?:{email:string,deletedAt:string,confirmed:boolean},error?:string}>}
 */
export async function eraseContact(email, { logger } = {}) {
  const log = logger ?? console;

  const parsed = schema.safeParse({ email, logger });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `eraseContact: invalid input — ${msg}` };
  }

  try {
    const api = getContactsApi();
    await api.deleteContact(parsed.data.email);

    const deletedAt = new Date().toISOString();
    log.info?.(`[gdpr] eraseContact: deleted ${parsed.data.email} at ${deletedAt}`);

    return {
      success: true,
      data: {
        email: parsed.data.email,
        deletedAt,
        confirmed: true,
      },
    };
  } catch (err) {
    const message = err?.response?.body?.message ?? err.message;
    log.error?.(`[gdpr] eraseContact: failed for ${parsed.data.email} — ${message}`);
    return { success: false, error: `eraseContact: ${message}` };
  }
}
