import { z } from 'zod';
import * as Brevo from '@getbrevo/brevo';
import { getContactsApi } from '../config/brevoClient.js';
import { LIST_ENV_KEYS } from '../config/constants.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  listIds: z.array(z.number().int().positive()).optional(),
  attributes: z.record(z.unknown()).optional(),
  updateIfExists: z.boolean().optional(),
});

function resolveListIds(plan, listIds) {
  if (listIds?.length) return listIds;
  if (!plan) return [];
  const envKey = LIST_ENV_KEYS[plan];
  const val = process.env[envKey];
  if (!val) return [];
  const id = parseInt(val, 10);
  return Number.isFinite(id) ? [id] : [];
}

function buildAttributes(name, attributes) {
  const attrs = { ...attributes };
  if (name) {
    const parts = name.trim().split(/\s+/);
    attrs.FIRSTNAME = attrs.FIRSTNAME ?? parts[0];
    if (parts.length > 1) attrs.LASTNAME = attrs.LASTNAME ?? parts.slice(1).join(' ');
  }
  return attrs;
}

/**
 * Create a new contact in Brevo. Optionally segments into the correct list by plan.
 * @param {object} options
 * @param {string} options.email - Contact email address
 * @param {string} [options.name] - Full name (split into FIRSTNAME/LASTNAME automatically)
 * @param {'free'|'pro'|'enterprise'} [options.plan] - User's plan (auto-assigns to list)
 * @param {number[]} [options.listIds] - Explicit Brevo list IDs to add the contact to
 * @param {Record<string,unknown>} [options.attributes] - Custom Brevo contact attributes
 * @param {boolean} [options.updateIfExists] - Update the contact if email already exists (default: false)
 * @returns {Promise<{success:boolean,data?:{id:number},error?:string}>}
 */
export async function createContact(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `createContact validation failed: ${msg}` };
  }

  const { email, name, plan, listIds, attributes, updateIfExists } = parsed.data;

  try {
    const api = getContactsApi();
    const contact = new Brevo.CreateContact();
    contact.email = email;
    contact.updateEnabled = updateIfExists ?? false;

    const resolvedListIds = resolveListIds(plan, listIds);
    if (resolvedListIds.length) contact.listIds = resolvedListIds;

    const attrs = buildAttributes(name, attributes);
    if (Object.keys(attrs).length) contact.attributes = attrs;

    const response = await api.createContact(contact);
    return { success: true, data: { id: response.body?.id ?? null } };
  } catch (err) {
    const msg = err?.response?.body?.message ?? err?.message ?? 'Unknown Brevo API error';
    return { success: false, error: `createContact failed: ${msg}` };
  }
}
