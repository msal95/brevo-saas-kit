import { z } from 'zod';
import * as Brevo from '@getbrevo/brevo';
import { getContactsApi } from '../config/brevoClient.js';

const schema = z.object({
  email: z.string().email(),
  attributes: z.record(z.unknown()).optional(),
  listIds: z.array(z.number().int().positive()).optional(),
  unlinkListIds: z.array(z.number().int().positive()).optional(),
  emailBlacklisted: z.boolean().optional(),
  smsBlacklisted: z.boolean().optional(),
});

/**
 * Update an existing Brevo contact's attributes or list memberships.
 * @param {object} options
 * @param {string} options.email - Contact email address (identifier)
 * @param {Record<string,unknown>} [options.attributes] - Attributes to update
 * @param {number[]} [options.listIds] - List IDs to add the contact to
 * @param {number[]} [options.unlinkListIds] - List IDs to remove the contact from
 * @param {boolean} [options.emailBlacklisted] - Set email marketing blacklist status
 * @param {boolean} [options.smsBlacklisted] - Set SMS marketing blacklist status
 * @returns {Promise<{success:boolean,data?:{email:string},error?:string}>}
 */
export async function updateContact(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `updateContact validation failed: ${msg}` };
  }

  const { email, attributes, listIds, unlinkListIds, emailBlacklisted, smsBlacklisted } = parsed.data;

  try {
    const api = getContactsApi();
    const update = new Brevo.UpdateContact();

    if (attributes && Object.keys(attributes).length) update.attributes = attributes;
    if (listIds?.length) update.listIds = listIds;
    if (unlinkListIds?.length) update.unlinkListIds = unlinkListIds;
    if (emailBlacklisted !== undefined) update.emailBlacklisted = emailBlacklisted;
    if (smsBlacklisted !== undefined) update.smsBlacklisted = smsBlacklisted;

    await api.updateContact(email, update);
    return { success: true, data: { email } };
  } catch (err) {
    const msg = err?.response?.body?.message ?? err?.message ?? 'Unknown Brevo API error';
    return { success: false, error: `updateContact failed: ${msg}` };
  }
}
