import { z } from 'zod';
import { sendEmail } from '../transactional/sendEmail.js';
import { layout, heading, para, btn } from '../transactional/html.js';
import { defineWorkflow, startWorkflow, DELAYS } from './workflowRunner.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  trialEndsAt: z.date(),
  upgradeUrl: z.string().url().optional(),
  appName: z.string().optional(),
  mode: z.enum(['inline', 'plan']).optional(),
});

function urgencyBadge(text, color) {
  return `<div style="display:inline-block;background:${color};color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:16px;">${text}</div>`;
}

function buildReminderHtml({ name, daysLeft, upgradeUrl, appName, label, color }) {
  const app = appName ?? 'your trial';
  const body = [
    urgencyBadge(label, color),
    heading(`Your trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`),
    para(`Hi ${name}, just a heads-up — ${app} expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.`),
    para(`Don't lose your work and progress. Upgrade now to keep everything and unlock the full product.`),
    upgradeUrl ? btn('Upgrade Now — Keep Everything', upgradeUrl) : '',
    para(`Questions about pricing? Just reply to this email.`),
  ].join('');
  return layout({ title: `Trial Expiry Reminder`, preheader: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left on your trial`, body });
}

function buildExpiredHtml({ name, upgradeUrl, appName }) {
  const app = appName ?? 'your trial';
  const body = [
    urgencyBadge('Trial Ended', '#dc2626'),
    heading('Your trial has ended'),
    para(`Hi ${name}, ${app} has expired. Your account is now on the free plan with limited access.`),
    para(`Upgrade to restore full access. Your data and settings are safe — nothing has been deleted.`),
    upgradeUrl ? btn('Restore Full Access', upgradeUrl) : '',
    para(`Still deciding? Reply to this email — we're happy to answer any questions or extend your trial.`),
  ].join('');
  return layout({ title: 'Trial Expired', preheader: `Your trial has ended — restore access now`, body });
}

function computeDelays(trialEndsAt) {
  const now = Date.now();
  const endsAt = trialEndsAt.getTime();
  const delay7d = Math.max(0, endsAt - DELAYS.days(7) - now);
  const delay3d = Math.max(0, endsAt - DELAYS.days(3) - now);
  const delay1d = Math.max(0, endsAt - DELAYS.days(1) - now);
  const delayExpiry = Math.max(0, endsAt - now);
  return { delay7d, delay3d, delay1d, delayExpiry };
}

/**
 * Schedule trial expiry reminder emails (7 days, 3 days, 1 day before, and on expiry).
 * Steps are skipped automatically if the trial ends sooner than a reminder's target.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {Date} options.trialEndsAt - When the trial expires
 * @param {string} [options.upgradeUrl] - URL to the upgrade/pricing page
 * @param {string} [options.appName] - Your app's display name
 * @param {'inline'|'plan'} [options.mode] - Execution mode (default: 'plan')
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function scheduleTrialReminders(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `scheduleTrialReminders validation failed: ${msg}` };
  }

  const { email, name, trialEndsAt, upgradeUrl, appName, mode } = parsed.data;

  if (trialEndsAt.getTime() <= Date.now()) {
    return { success: false, error: 'scheduleTrialReminders: trial has already expired' };
  }

  const ctx = { email, name, upgradeUrl, appName };
  const { delay7d, delay3d, delay1d, delayExpiry } = computeDelays(trialEndsAt);

  const allSteps = [
    { name: '7-day-warning', delayMs: delay7d, daysLeft: 7, label: '7 Days Left', color: '#d97706' },
    { name: '3-day-warning', delayMs: delay3d, daysLeft: 3, label: '3 Days Left', color: '#ea580c' },
    { name: '1-day-warning', delayMs: delay1d, daysLeft: 1, label: '1 Day Left', color: '#dc2626' },
    { name: 'expired', delayMs: delayExpiry, daysLeft: 0, label: 'Expired', color: '#dc2626' },
  ];

  const steps = allSteps
    .filter(s => s.daysLeft === 0 || s.delayMs > 0)
    .map(s => ({
      name: s.name,
      delayMs: s.delayMs,
      send: s.daysLeft === 0
        ? async c => sendEmail({ to: c.email, subject: 'Your trial has ended', htmlContent: buildExpiredHtml(c) })
        : async c => sendEmail({
            to: c.email,
            subject: `${s.daysLeft} day${s.daysLeft !== 1 ? 's' : ''} left on your trial`,
            htmlContent: buildReminderHtml({ ...c, daysLeft: s.daysLeft, label: s.label, color: s.color }),
          }),
    }));

  const workflowDef = defineWorkflow({ name: 'trial-expiry', steps });
  if (!workflowDef.success) return workflowDef;
  return startWorkflow(workflowDef.data, ctx, { mode: mode ?? 'plan' });
}
