import { z } from 'zod';
import { getContactsApi } from '../config/brevoClient.js';

const schema = z.object({
  email: z.string().email(),
  logger: z.any().optional(),
});

/**
 * Unsubscribe a contact from all lists and add to the email blocklist.
 * This is a two-step operation: remove from all lists, then set emailBlacklisted=true.
 * @param {string} email - Contact email to unsubscribe
 * @param {object} [options]
 * @param {object} [options.logger] - Custom logger with .info() and .error() methods
 * @returns {Promise<{success:boolean,data?:{email:string,unsubscribedAt:string,blacklisted:boolean},error?:string}>}
 */
export async function unsubscribeContact(email, { logger } = {}) {
  const log = logger ?? console;

  const parsed = schema.safeParse({ email, logger });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `unsubscribeContact: invalid input — ${msg}` };
  }

  const addr = parsed.data.email;

  try {
    const api = getContactsApi();

    // Step 1: fetch contact to get current list memberships
    let listIds = [];
    try {
      const info = await api.getContactInfo(addr);
      listIds = info?.body?.listIds ?? [];
    } catch {
      // Contact may not exist — proceed to blacklist anyway
    }

    // Step 2: build update — remove from all lists, blacklist
    const updatePayload = { emailBlacklisted: true };
    if (listIds.length > 0) {
      updatePayload.unlinkListIds = listIds;
    }

    const { UpdateContact } = await import('@getbrevo/brevo');
    const contactUpdate = Object.assign(new UpdateContact(), updatePayload);
    await api.updateContact(addr, contactUpdate);

    const unsubscribedAt = new Date().toISOString();
    log.info?.(`[gdpr] unsubscribeContact: ${addr} unsubscribed and blacklisted at ${unsubscribedAt}`);

    return {
      success: true,
      data: {
        email: addr,
        unsubscribedAt,
        blacklisted: true,
      },
    };
  } catch (err) {
    const message = err?.response?.body?.message ?? err.message;
    log.error?.(`[gdpr] unsubscribeContact: failed for ${addr} — ${message}`);
    return { success: false, error: `unsubscribeContact: ${message}` };
  }
}
