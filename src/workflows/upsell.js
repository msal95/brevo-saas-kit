import { z } from 'zod';
import { sendEmail } from '../transactional/sendEmail.js';
import { layout, heading, para, btn } from '../transactional/html.js';
import { defineWorkflow, startWorkflow, DELAYS } from './workflowRunner.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  currentPlan: z.enum(['free', 'pro']).optional(),
  upgradeUrl: z.string().url().optional(),
  appName: z.string().optional(),
  proFeatures: z.array(z.string()).optional(),
  mode: z.enum(['inline', 'plan']).optional(),
});

const DEFAULT_PRO_FEATURES = [
  'Unlimited projects',
  'Priority customer support',
  'Advanced analytics and reporting',
  'Team collaboration tools',
  'API access',
];

const DEFAULT_ENTERPRISE_FEATURES = [
  'Custom contracts and SLAs',
  'Dedicated account manager',
  'SSO / SAML authentication',
  'On-premise deployment option',
  'Volume pricing',
];

function buildValueHtml({ name, upgradeUrl, features, appName, targetPlan }) {
  const app = appName ?? 'our platform';
  const planLabel = targetPlan === 'enterprise' ? 'Enterprise' : 'Pro';
  const featureList = features ?? (targetPlan === 'enterprise' ? DEFAULT_ENTERPRISE_FEATURES : DEFAULT_PRO_FEATURES);
  const body = [
    heading(`Unlock more with ${planLabel}`),
    para(`Hi ${name}, you're getting good value from ${app}. Here's what's waiting for you on ${planLabel}:`),
    `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:2;color:#374151;">${featureList.map(f => `<li>${f}</li>`).join('')}</ul>`,
    upgradeUrl ? btn(`Upgrade to ${planLabel}`, upgradeUrl) : '',
    para(`Have questions? Reply to this email and I'll walk you through your options personally.`),
  ].join('');
  return layout({ title: `Upgrade to ${planLabel}`, preheader: `Unlock more with ${planLabel} — here's what you're missing`, body });
}

function buildSocialProofHtml({ name, upgradeUrl, appName, targetPlan }) {
  const app = appName ?? 'our platform';
  const planLabel = targetPlan === 'enterprise' ? 'Enterprise' : 'Pro';
  const body = [
    heading(`You're in good company`),
    para(`Hi ${name}, teams like yours upgrade to ${planLabel} on ${app} when they're ready to move faster.`),
    `<blockquote style="margin:24px 0;padding:20px 24px;background:#f9fafb;border-left:4px solid #4f46e5;border-radius:4px;">
      <p style="margin:0 0 8px;font-size:15px;color:#374151;font-style:italic;">"Upgrading was the best decision we made. The advanced features saved our team hours every week."</p>
      <cite style="font-size:13px;color:#6b7280;font-style:normal;">— A Pro customer</cite>
    </blockquote>`,
    upgradeUrl ? btn(`Start Your ${planLabel} Trial`, upgradeUrl) : '',
    para(`No credit card required to try. Cancel anytime.`),
  ].join('');
  return layout({ title: `Try ${planLabel}`, preheader: `See why teams love ${planLabel}`, body });
}

/**
 * Start a 2-email upsell nudge sequence for free (→ Pro) or Pro (→ Enterprise) users.
 * Email 1: immediate value proposition. Email 2: 3 days later social proof.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {'free'|'pro'} [options.currentPlan] - User's current plan (default: 'free')
 * @param {string} [options.upgradeUrl] - URL to upgrade/pricing page
 * @param {string} [options.appName] - Your app's display name
 * @param {string[]} [options.proFeatures] - Custom feature list to highlight
 * @param {'inline'|'plan'} [options.mode] - Execution mode (default: 'plan')
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function startUpsellSequence(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `startUpsellSequence validation failed: ${msg}` };
  }

  const { email, name, currentPlan, upgradeUrl, appName, proFeatures, mode } = parsed.data;
  const targetPlan = currentPlan === 'pro' ? 'enterprise' : 'pro';
  const ctx = { email, name, upgradeUrl, appName, proFeatures, targetPlan };

  const workflowDef = defineWorkflow({
    name: 'upsell',
    steps: [
      {
        name: 'value-proposition',
        delayMs: DELAYS.IMMEDIATE,
        send: async c => sendEmail({
          to: c.email,
          subject: `Unlock more with ${c.targetPlan === 'enterprise' ? 'Enterprise' : 'Pro'}`,
          htmlContent: buildValueHtml(c),
        }),
      },
      {
        name: 'social-proof',
        delayMs: DELAYS.days(3),
        send: async c => sendEmail({
          to: c.email,
          subject: `Teams like yours already made the switch`,
          htmlContent: buildSocialProofHtml(c),
        }),
      },
    ],
  });

  if (!workflowDef.success) return workflowDef;
  return startWorkflow(workflowDef.data, ctx, { mode: mode ?? 'plan' });
}
