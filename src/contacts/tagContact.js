import { z } from 'zod';
import * as Brevo from '@getbrevo/brevo';
import { getContactsApi } from '../config/brevoClient.js';

const schema = z.object({
  email: z.string().email(),
  tags: z.array(z.string().min(1)).min(1),
  action: z.enum(['add', 'remove', 'set']).optional(),
});

async function getCurrentTags(api, email) {
  try {
    const info = await api.getContactInfo(email);
    const raw = info?.body?.attributes?.TAGS ?? '';
    return raw ? String(raw).split(',').map(t => t.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function mergeTags(existing, incoming, action) {
  const action_ = action ?? 'add';
  if (action_ === 'set') return [...new Set(incoming)];
  if (action_ === 'remove') return existing.filter(t => !incoming.includes(t));
  return [...new Set([...existing, ...incoming])];
}

/**
 * Add, remove, or replace tags on a Brevo contact.
 * Tags are stored as a comma-separated TAGS attribute on the contact.
 * @param {object} options
 * @param {string} options.email - Contact email address
 * @param {string[]} options.tags - Tags to apply
 * @param {'add'|'remove'|'set'} [options.action] - 'add' merges, 'remove' removes, 'set' replaces (default: 'add')
 * @returns {Promise<{success:boolean,data?:{email:string,tags:string[]},error?:string}>}
 */
export async function tagContact(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `tagContact validation failed: ${msg}` };
  }

  const { email, tags, action } = parsed.data;

  try {
    const api = getContactsApi();
    const existing = await getCurrentTags(api, email);
    const merged = mergeTags(existing, tags, action);

    const update = new Brevo.UpdateContact();
    update.attributes = { TAGS: merged.join(',') };
    await api.updateContact(email, update);

    return { success: true, data: { email, tags: merged } };
  } catch (err) {
    const msg = err?.response?.body?.message ?? err?.message ?? 'Unknown Brevo API error';
    return { success: false, error: `tagContact failed: ${msg}` };
  }
}
