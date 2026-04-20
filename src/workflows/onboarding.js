import { z } from 'zod';
import { sendEmail } from '../transactional/sendEmail.js';
import { layout, heading, para, btn } from '../transactional/html.js';
import { defineWorkflow, startWorkflow, DELAYS } from './workflowRunner.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  dashboardUrl: z.string().url().optional(),
  appName: z.string().optional(),
  mode: z.enum(['inline', 'plan']).optional(),
});

function buildDay1Html({ name, dashboardUrl, appName }) {
  const app = appName ?? 'the app';
  const body = [
    heading(`How's it going, ${name}?`),
    para(`You signed up for ${app} yesterday. Here's the one feature that most new users find most valuable:`),
    para(`<strong>Quick setup tip:</strong> Most teams get their first result within 10 minutes of signing up. Want to see how?`),
    dashboardUrl ? btn('Explore Key Features', dashboardUrl) : '',
    para(`Reply to this email if you have any questions — I read every reply.`),
  ].join('');
  return layout({ title: 'Day 1 Check-in', preheader: `One quick tip to get started, ${name}`, body });
}

function buildDay3Html({ name, dashboardUrl, appName }) {
  const app = appName ?? 'the platform';
  const body = [
    heading('Three things power users do differently'),
    para(`Hi ${name}, you've been using ${app} for a few days now. Here are three things that separate casual users from power users:`),
    `<ol style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:2;color:#374151;">
      <li>They complete their profile in full</li>
      <li>They connect their existing tools via integrations</li>
      <li>They invite at least one teammate</li>
    </ol>`,
    dashboardUrl ? btn('Go to Dashboard', dashboardUrl) : '',
  ].join('');
  return layout({ title: 'Day 3 Tips', preheader: `3 things power users do differently`, body });
}

function buildDay7Html({ name, appName }) {
  const app = appName ?? 'things';
  const body = [
    heading(`How are ${app} going so far?`),
    para(`Hi ${name}, it's been a week! I wanted to check in personally and see how you're getting on.`),
    para(`Is there anything that's been confusing or not working the way you expected? Just reply to this email — your feedback helps us improve.`),
    para(`If everything is going well, great! We'd love a quick review or shoutout if you're finding value.`),
  ].join('');
  return layout({ title: 'Week 1 Check-in', preheader: `A quick check-in from the team`, body });
}

function buildDay14Html({ name, plan, dashboardUrl, appName }) {
  const app = appName ?? 'the app';
  const isFree = plan === 'free' || !plan;
  const body = [
    heading(`Two weeks in — here's what's waiting for you`),
    para(`Hi ${name}, you've been with ${app} for two weeks now. `),
    isFree
      ? para(`You're on the <strong>free plan</strong>. Here's what you're missing out on with Pro: unlimited projects, priority support, and advanced analytics.`)
      : para(`You're making great use of your current plan. Here's a quick look at your impact so far.`),
    dashboardUrl ? btn(isFree ? 'Upgrade to Pro' : 'View Your Dashboard', dashboardUrl) : '',
    para(`As always — reply to this email anytime. We read everything.`),
  ].join('');
  return layout({ title: 'Two Week Update', preheader: `Two weeks in — here's what's next`, body });
}

/**
 * Start a 5-email onboarding drip sequence (Day 0, 1, 3, 7, 14).
 * In 'plan' mode, returns the schedule without sending — wire into your job queue.
 * In 'inline' mode, sends Day 0 immediately and uses setTimeout for the rest.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {'free'|'pro'|'enterprise'} [options.plan] - User's plan (affects Day 14 content)
 * @param {string} [options.dashboardUrl] - URL to user's dashboard
 * @param {string} [options.appName] - Your app's display name
 * @param {'inline'|'plan'} [options.mode] - Execution mode (default: 'inline')
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function startOnboardingSequence(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `startOnboardingSequence validation failed: ${msg}` };
  }

  const { email, name, plan, dashboardUrl, appName, mode } = parsed.data;
  const ctx = { email, name, plan, dashboardUrl, appName };

  const workflowDef = defineWorkflow({
    name: 'onboarding',
    steps: [
      {
        name: 'day-0-welcome',
        delayMs: DELAYS.IMMEDIATE,
        send: async c => sendEmail({
          to: c.email,
          subject: `Welcome${c.appName ? ` to ${c.appName}` : ''}! Here's how to get started`,
          htmlContent: layout({
            title: 'Welcome',
            preheader: `You're in! Here's how to get started`,
            body: [
              heading(`Welcome aboard, ${c.name}!`),
              para(`Your account is ready. Here's the quickest way to get your first result:`),
              `<ol style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:2;color:#374151;">
                <li>Complete your profile</li>
                <li>Create your first project</li>
                <li>Invite your team</li>
              </ol>`,
              c.dashboardUrl ? btn('Get Started Now', c.dashboardUrl) : '',
            ].join(''),
          }),
        }),
      },
      {
        name: 'day-1-tip',
        delayMs: DELAYS.days(1),
        send: async c => sendEmail({ to: c.email, subject: 'One tip to get the most out of your account', htmlContent: buildDay1Html(c) }),
      },
      {
        name: 'day-3-tips',
        delayMs: DELAYS.days(3),
        send: async c => sendEmail({ to: c.email, subject: '3 things power users do differently', htmlContent: buildDay3Html(c) }),
      },
      {
        name: 'day-7-checkin',
        delayMs: DELAYS.days(7),
        send: async c => sendEmail({ to: c.email, subject: 'A quick check-in from the team', htmlContent: buildDay7Html(c) }),
      },
      {
        name: 'day-14-nudge',
        delayMs: DELAYS.days(14),
        send: async c => sendEmail({ to: c.email, subject: `Two weeks in — here's what's waiting for you`, htmlContent: buildDay14Html(c) }),
      },
    ],
  });

  if (!workflowDef.success) return workflowDef;
  return startWorkflow(workflowDef.data, ctx, { mode: mode ?? 'inline' });
}
