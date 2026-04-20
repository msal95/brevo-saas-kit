import { z } from 'zod';
import { getContactsApi } from '../config/brevoClient.js';

const schema = z.object({
  email: z.string().email(),
});

/**
 * Permanently delete a contact from Brevo (GDPR right to erasure).
 * This removes the contact and all associated data from Brevo.
 * @param {object} options
 * @param {string} options.email - Email address of the contact to delete
 * @returns {Promise<{success:boolean,data?:{email:string},error?:string}>}
 */
export async function deleteContact(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `deleteContact validation failed: ${msg}` };
  }

  const { email } = parsed.data;

  try {
    const api = getContactsApi();
    await api.deleteContact(email);
    return { success: true, data: { email } };
  } catch (err) {
    const msg = err?.response?.body?.message ?? err?.message ?? 'Unknown Brevo API error';
    return { success: false, error: `deleteContact failed: ${msg}` };
  }
}
