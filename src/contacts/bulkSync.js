import { z } from 'zod';
import * as Brevo from '@getbrevo/brevo';
import { getContactsApi } from '../config/brevoClient.js';
import { LIST_ENV_KEYS, BULK_SYNC_CHUNK_SIZE } from '../config/constants.js';

const contactSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  attributes: z.record(z.unknown()).optional(),
});

const schema = z.object({
  contacts: z.array(contactSchema).min(1),
  listId: z.number().int().positive().optional(),
  updateExisting: z.boolean().optional(),
});

function resolveDefaultListId(listId) {
  if (listId) return listId;
  return null;
}

function buildContactsPayload(contacts, defaultListId, updateExisting) {
  return contacts.map(c => {
    const attrs = { ...c.attributes };
    if (c.name) {
      const parts = c.name.trim().split(/\s+/);
      attrs.FIRSTNAME = attrs.FIRSTNAME ?? parts[0];
      if (parts.length > 1) attrs.LASTNAME = attrs.LASTNAME ?? parts.slice(1).join(' ');
    }

    let listId = defaultListId;
    if (!listId && c.plan) {
      const envKey = LIST_ENV_KEYS[c.plan];
      const val = process.env[envKey];
      if (val) listId = parseInt(val, 10) || null;
    }

    const entry = { email: c.email };
    if (Object.keys(attrs).length) entry.attributes = attrs;
    if (listId) entry.listIds = [listId];
    return entry;
  });
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Bulk-sync an array of users from your database into Brevo.
 * Processes in chunks of 150 (Brevo's API limit) with automatic retry-safe chunking.
 * @param {object} options
 * @param {Array<{email:string,name?:string,plan?:string,attributes?:object}>} options.contacts
 * @param {number} [options.listId] - Default list ID for all contacts (overrides plan-based lookup)
 * @param {boolean} [options.updateExisting] - Update attributes if contact already exists (default: true)
 * @returns {Promise<{success:boolean,data?:{synced:number,failed:number,errors:string[]},error?:string}>}
 */
export async function bulkSyncContacts(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `bulkSyncContacts validation failed: ${msg}` };
  }

  const { contacts, listId, updateExisting } = parsed.data;
  const defaultListId = resolveDefaultListId(listId);
  const payload = buildContactsPayload(contacts, defaultListId, updateExisting);
  const chunks = chunk(payload, BULK_SYNC_CHUNK_SIZE);

  let synced = 0;
  const errors = [];

  try {
    const api = getContactsApi();

    for (const batch of chunks) {
      try {
        const body = new Brevo.RequestContactImport();
        body.jsonBody = batch;
        body.emailBlacklist = false;
        body.updateExistingContacts = updateExisting ?? true;
        body.emptyContactsAttributes = false;

        await api.importContacts(body);
        synced += batch.length;
      } catch (err) {
        const msg = err?.response?.body?.message ?? err?.message ?? 'Batch failed';
        errors.push(`Batch of ${batch.length}: ${msg}`);
      }
    }

    const failed = contacts.length - synced;
    return { success: errors.length === 0, data: { synced, failed, errors } };
  } catch (err) {
    const msg = err?.response?.body?.message ?? err?.message ?? 'Unknown Brevo API error';
    return { success: false, error: `bulkSyncContacts failed: ${msg}` };
  }
}
