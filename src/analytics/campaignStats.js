import { z } from 'zod';
import { getTransactionalApi } from '../config/brevoClient.js';

const schema = z.object({
  campaignId: z.union([z.string().min(1), z.number().int().positive()]),
});

/**
 * Fetch email campaign statistics from Brevo.
 * @param {string|number} campaignId - Brevo campaign or message ID
 * @returns {Promise<{success:boolean,data?:{sent:number,opened:number,clicked:number,bounced:number,openRate:number,clickRate:number},error?:string}>}
 */
export async function getCampaignStats(campaignId) {
  const parsed = schema.safeParse({ campaignId });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `getCampaignStats: invalid input — ${msg}` };
  }

  try {
    const api = getTransactionalApi();
    const response = await api.getEmailEventReport({
      messageId: String(parsed.data.campaignId),
      limit: 1000,
    });

    const events = response?.body?.events ?? [];
    return { success: true, data: _aggregateEvents(events) };
  } catch (err) {
    return {
      success: false,
      error: `getCampaignStats: ${err?.response?.body?.message ?? err.message}`,
    };
  }
}

function _aggregateEvents(events) {
  const counts = { sent: 0, opened: 0, clicked: 0, bounced: 0 };

  for (const ev of events) {
    const type = ev.event?.toLowerCase();
    if (type === 'delivered' || type === 'sent') counts.sent++;
    else if (type === 'opened' || type === 'uniqueopened') counts.opened++;
    else if (type === 'clicks' || type === 'clicked') counts.clicked++;
    else if (type === 'hardbounce' || type === 'softbounce' ||
             type === 'hard_bounce' || type === 'soft_bounce') counts.bounced++;
  }

  const openRate  = counts.sent > 0 ? Math.round((counts.opened  / counts.sent) * 10000) / 100 : 0;
  const clickRate = counts.sent > 0 ? Math.round((counts.clicked / counts.sent) * 10000) / 100 : 0;

  return { ...counts, openRate, clickRate };
}
