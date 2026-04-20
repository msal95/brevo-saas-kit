import { z } from 'zod';
import { getCampaignStats } from './campaignStats.js';
import { getContactEngagement } from './contactEngagement.js';

const schema = z.object({
  campaignId: z.union([z.string().min(1), z.number().int().positive()]).optional(),
  email: z.string().email().optional(),
  format: z.enum(['json', 'csv']).default('json'),
}).refine(d => d.campaignId !== undefined || d.email !== undefined, {
  message: 'exportStats: at least one of campaignId or email is required',
});

/**
 * Export campaign or contact stats as JSON or CSV.
 * @param {object} options
 * @param {string|number} [options.campaignId] - Campaign to export stats for
 * @param {string} [options.email] - Contact to export engagement stats for
 * @param {'json'|'csv'} [options.format='json'] - Output format
 * @returns {Promise<{success:boolean,data?:object|string,error?:string}>}
 */
export async function exportStats({ campaignId, email, format = 'json' } = {}) {
  const parsed = schema.safeParse({ campaignId, email, format });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `exportStats: invalid input — ${msg}` };
  }

  const stats = {};

  if (parsed.data.campaignId !== undefined) {
    const result = await getCampaignStats(parsed.data.campaignId);
    if (!result.success) return result;
    stats.campaign = { id: String(parsed.data.campaignId), ...result.data };
  }

  if (parsed.data.email !== undefined) {
    const result = await getContactEngagement(parsed.data.email);
    if (!result.success) return result;
    stats.contact = { email: parsed.data.email, ...result.data };
  }

  if (format === 'json') {
    return { success: true, data: stats };
  }

  return { success: true, data: _toCsv(stats) };
}

function _toCsv(stats) {
  const rows = [];

  if (stats.campaign) {
    rows.push('type,id,sent,opened,clicked,bounced,openRate,clickRate');
    const c = stats.campaign;
    rows.push(`campaign,${c.id},${c.sent},${c.opened},${c.clicked},${c.bounced},${c.openRate},${c.clickRate}`);
    rows.push('');
  }

  if (stats.contact) {
    rows.push('type,email,score,rating,totalOpens,totalClicks,lastOpened');
    const ct = stats.contact;
    rows.push(`contact,${ct.email},${ct.score},${ct.rating},${ct.totalOpens},${ct.totalClicks},${ct.lastOpened ?? ''}`);
  }

  return rows.join('\n');
}
