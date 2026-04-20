import { z } from 'zod';
import * as Brevo from '@getbrevo/brevo';
import { getContactsApi } from '../config/brevoClient.js';
import { LIST_ENV_KEYS, CONTACT_PLANS } from '../config/constants.js';

const validPlans = Object.values(CONTACT_PLANS);

const schema = z.object({
  email: z.string().email(),
  plan: z.enum(['free', 'pro', 'enterprise']),
  listId: z.number().int().positive().optional(),
  removeFromOtherPlans: z.boolean().optional(),
});

function resolveListId(plan, override) {
  if (override) return override;
  const envKey = LIST_ENV_KEYS[plan];
  const val = process.env[envKey];
  if (!val) {
    throw new Error(
      `[brevo-saas-automation] segmentContact: ${envKey} env var is not set. ` +
        `Either set it or pass listId in options.`
    );
  }
  const id = parseInt(val, 10);
  if (!Number.isFinite(id)) {
    throw new Error(`[brevo-saas-automation] segmentContact: ${envKey} must be a valid integer, got "${val}"`);
  }
  return id;
}

function getOtherPlanListIds(currentPlan) {
  return validPlans
    .filter(p => p !== currentPlan)
    .map(p => {
      const val = process.env[LIST_ENV_KEYS[p]];
      return val ? parseInt(val, 10) : null;
    })
    .filter(id => Number.isFinite(id));
}

/**
 * Move a contact into their plan's Brevo list. Optionally removes from other plan lists.
 * Reads list IDs from BREVO_LIST_FREE/PRO/ENTERPRISE env vars, or accepts an override.
 * @param {object} options
 * @param {string} options.email - Contact email address
 * @param {'free'|'pro'|'enterprise'} options.plan - The user's current plan
 * @param {number} [options.listId] - Override the env var list ID for this call
 * @param {boolean} [options.removeFromOtherPlans] - Remove from other plan lists (default: false)
 * @returns {Promise<{success:boolean,data?:{email:string,plan:string,listId:number},error?:string}>}
 */
export async function segmentContact(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `segmentContact validation failed: ${msg}` };
  }

  const { email, plan, listId, removeFromOtherPlans } = parsed.data;

  try {
    const targetListId = resolveListId(plan, listId);
    const api = getContactsApi();

    const update = new Brevo.UpdateContact();
    update.listIds = [targetListId];

    if (removeFromOtherPlans) {
      const others = getOtherPlanListIds(plan);
      if (others.length) update.unlinkListIds = others;
    }

    await api.updateContact(email, update);
    return { success: true, data: { email, plan, listId: targetListId } };
  } catch (err) {
    const msg = err?.response?.body?.message ?? err?.message ?? 'Unknown Brevo API error';
    return { success: false, error: `segmentContact failed: ${msg}` };
  }
}
