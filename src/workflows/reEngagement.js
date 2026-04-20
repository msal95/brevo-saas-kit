import { z } from 'zod';
import { sendEmail } from '../transactional/sendEmail.js';
import { layout, heading, para, btn } from '../transactional/html.js';
import { defineWorkflow, startWorkflow, DELAYS } from './workflowRunner.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  lastActiveAt: z.date(),
  dashboardUrl: z.string().url().optional(),
  unsubscribeUrl: z.string().url().optional(),
  appName: z.string().optional(),
  mode: z.enum(['inline', 'plan']).optional(),
});

function buildMissYouHtml({ name, dashboardUrl, appName }) {
  const app = appName ?? 'us';
  const body = [
    heading(`We miss you, ${name}`),
    para(`It's been a while since we've seen you on ${app}. We wanted to check in and see if there's anything we can help with.`),
    para(`A lot has changed since your last visit — new features, improvements, and more. Come see what's new.`),
    dashboardUrl ? btn('See What\'s New', dashboardUrl) : '',
    para(`If you're no longer interested, that's okay too — you can unsubscribe below and we won't email you again.`),
  ].join('');
  return layout({ title: "We Miss You", preheader: `It's been a while — here's what's new`, body });
}

function buildLastChanceHtml({ name, dashboardUrl, unsubscribeUrl, appName }) {
  const app = appName ?? 'the platform';
  const body = [
    heading('Last chance — is this goodbye?'),
    para(`Hi ${name}, we noticed you haven't returned to ${app} in a while.`),
    para(`We'll stop sending you emails soon. If you'd like to keep your account and stay in the loop, just click below — no action needed after that.`),
    dashboardUrl ? btn('Yes, Keep My Account Active', dashboardUrl) : '',
    unsubscribeUrl
      ? para(`Or <a href="${unsubscribeUrl}" style="color:#4f46e5;">click here to unsubscribe permanently</a> and we'll never email you again.`)
      : '',
  ].join('');
  return layout({ title: 'Last Chance', preheader: `Is this goodbye? One click to stay`, body });
}

function buildWinBackHtml({ name, dashboardUrl, appName }) {
  const app = appName ?? 'your account';
  const body = [
    heading(`We've improved a lot since you left`),
    para(`Hi ${name}, we know we haven't seen you in ${app} for a while.`),
    para(`We've been busy shipping features our users asked for. Here's a quick look at what's new that might change your mind:`),
    `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:2;color:#374151;">
      <li>Faster performance across the board</li>
      <li>New integrations with your favorite tools</li>
      <li>Redesigned dashboard — cleaner and faster</li>
    </ul>`,
    dashboardUrl ? btn('Come Back and See', dashboardUrl) : '',
  ].join('');
  return layout({ title: 'Come Back', preheader: `We've shipped a lot — come see what's new`, body });
}

/**
 * Start a 3-email re-engagement sequence for inactive users.
 * Email 1: immediate "we miss you", Email 2: 7 days later "last chance", Email 3: 14 days later "win-back".
 * Default mode is 'plan' — recommended for long-running sequences.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {Date} options.lastActiveAt - When the user was last active (for context/logging)
 * @param {string} [options.dashboardUrl] - URL to the user's dashboard
 * @param {string} [options.unsubscribeUrl] - One-click unsubscribe URL
 * @param {string} [options.appName] - Your app's display name
 * @param {'inline'|'plan'} [options.mode] - Execution mode (default: 'plan')
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function startReEngagementSequence(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `startReEngagementSequence validation failed: ${msg}` };
  }

  const { email, name, lastActiveAt, dashboardUrl, unsubscribeUrl, appName, mode } = parsed.data;
  const ctx = { email, name, lastActiveAt, dashboardUrl, unsubscribeUrl, appName };

  const workflowDef = defineWorkflow({
    name: 're-engagement',
    steps: [
      {
        name: 'miss-you',
        delayMs: DELAYS.IMMEDIATE,
        send: async c => sendEmail({ to: c.email, subject: `We miss you, ${c.name}`, htmlContent: buildMissYouHtml(c) }),
      },
      {
        name: 'last-chance',
        delayMs: DELAYS.days(7),
        send: async c => sendEmail({ to: c.email, subject: 'Last chance — is this goodbye?', htmlContent: buildLastChanceHtml(c) }),
      },
      {
        name: 'win-back',
        delayMs: DELAYS.days(14),
        send: async c => sendEmail({ to: c.email, subject: `We've improved a lot since you left`, htmlContent: buildWinBackHtml(c) }),
      },
    ],
  });

  if (!workflowDef.success) return workflowDef;
  return startWorkflow(workflowDef.data, ctx, { mode: mode ?? 'plan' });
}
