import { z } from 'zod';
import { getTransactionalApi } from '../config/brevoClient.js';

const schema = z.object({
  email: z.string().email(),
  limit: z.number().int().min(1).max(500).optional().default(100),
});

const RATING_THRESHOLDS = [
  { min: 80, rating: 'champion' },
  { min: 60, rating: 'active' },
  { min: 40, rating: 'engaged' },
  { min: 20, rating: 'dormant' },
  { min: 0,  rating: 'inactive' },
];

/**
 * Calculate engagement score for a contact based on their email activity.
 * Score is 0–100. Rating: champion / active / engaged / dormant / inactive.
 * @param {string} email - Contact email address
 * @param {object} [options]
 * @param {number} [options.limit=100] - Max events to fetch from Brevo
 * @returns {Promise<{success:boolean,data?:{score:number,rating:string,lastOpened:string|null,totalClicks:number,totalOpens:number},error?:string}>}
 */
export async function getContactEngagement(email, { limit = 100 } = {}) {
  const parsed = schema.safeParse({ email, limit });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `getContactEngagement: invalid input — ${msg}` };
  }

  try {
    const api = getTransactionalApi();
    const response = await api.getEmailEventReport({
      email: parsed.data.email,
      limit: parsed.data.limit,
    });

    const events = response?.body?.events ?? [];
    const data = _scoreContact(events);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `getContactEngagement: ${err?.response?.body?.message ?? err.message}`,
    };
  }
}

function _scoreContact(events) {
  let totalOpens = 0;
  let totalClicks = 0;
  let lastOpened = null;

  for (const ev of events) {
    const type = ev.event?.toLowerCase();
    const date = ev.date ?? null;

    if (type === 'opened' || type === 'uniqueopened') {
      totalOpens++;
      if (date && (!lastOpened || new Date(date) > new Date(lastOpened))) {
        lastOpened = date;
      }
    }
    if (type === 'clicks' || type === 'clicked') {
      totalClicks++;
    }
  }

  // Score weights: opens 60%, clicks 40%, capped at 100
  const openScore  = Math.min(totalOpens  * 5, 60);
  const clickScore = Math.min(totalClicks * 8, 40);
  const score = Math.min(openScore + clickScore, 100);

  const rating = RATING_THRESHOLDS.find(t => score >= t.min)?.rating ?? 'inactive';

  return { score, rating, lastOpened, totalClicks, totalOpens };
}
