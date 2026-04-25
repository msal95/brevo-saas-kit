# brevo-saas-kit

Production-grade Brevo (formerly Sendinblue) email automation library for SaaS developers.

Not just an API wrapper — real workflow patterns, webhook handling, drip sequences, GDPR compliance, and framework integrations used in actual SaaS products.

[![npm version](https://img.shields.io/npm/v/brevo-saas-kit.svg)](https://www.npmjs.com/package/brevo-saas-kit)
[![npm downloads](https://img.shields.io/npm/dm/brevo-saas-kit.svg)](https://www.npmjs.com/package/brevo-saas-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node >=18](https://img.shields.io/node/v/brevo-saas-kit.svg)](https://www.npmjs.com/package/brevo-saas-kit)

---

## Features

- 📧 **Transactional emails** — welcome, verification, invoice, password reset, role change
- 👥 **Contact management** — create, update, tag, segment, bulk sync
- 🔁 **Automation workflows** — onboarding drip, trial expiry, re-engagement, upsell
- 🪝 **Webhook handling** — HMAC-SHA256 signature verification + typed event routing
- ⚡ **Framework integrations** — Next.js server actions + App Router webhook handler, Express middleware
- 📊 **Analytics** — campaign stats, contact engagement scoring, CSV/JSON export
- 🔄 **Queue system** — immediate sends by default, optional BullMQ async queue
- 🔒 **Security** — in-memory rate limiter, HTML sanitizer, API key validator
- 🛡️ **GDPR** — right to erasure, signed consent logging, unsubscribe handler

---

## Installation

```bash
npm install brevo-saas-kit
yarn add brevo-saas-kit
pnpm add brevo-saas-kit
bun add brevo-saas-kit
```

For async email queuing (optional):

```bash
npm install brevo-saas-kit bullmq
# or: yarn add brevo-saas-kit bullmq
```

---

## Quick Start

```js
import { initBrevo, sendWelcomeEmail, createContact } from 'brevo-saas-kit';

initBrevo({
  apiKey: process.env.BREVO_API_KEY,
  sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
});

// On user signup
await createContact({ email: 'user@example.com', name: 'Muhammad', plan: 'free' });
await sendWelcomeEmail({ email: 'user@example.com', name: 'Muhammad', dashboardUrl: 'https://yourapp.com/dashboard' });
```

Or rely on env vars — no explicit `initBrevo()` required:

```env
BREVO_API_KEY=xkeysib-your-key
BREVO_SENDER_EMAIL=no-reply@yourapp.com
BREVO_SENDER_NAME=YourApp
```

---

## Environment Variables

```env
BREVO_API_KEY=xkeysib-your-api-key
BREVO_SENDER_EMAIL=no-reply@yourdomain.com
BREVO_SENDER_NAME=YourApp
BREVO_WEBHOOK_SECRET=your-webhook-secret

# Contact list IDs (Brevo dashboard → Contacts → Lists)
BREVO_LIST_FREE=1
BREVO_LIST_PRO=2
BREVO_LIST_ENTERPRISE=3

# Only needed for queue module (optional)
REDIS_URL=redis://localhost:6379
```

---

## Transactional Emails

```js
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInvoiceEmail,
  sendAccountDeletionEmail,
  sendRoleChangeEmail,
} from 'brevo-saas-kit';

await sendVerificationEmail({ email: 'u@e.com', name: 'Muhammad', otp: '847291' });
await sendPasswordResetEmail({ email: 'u@e.com', name: 'Muhammad', resetUrl: 'https://yourapp.com/reset?token=...' });
await sendInvoiceEmail({
  email: 'u@e.com', name: 'Muhammad', invoiceNumber: 'INV-001', invoiceDate: 'April 20, 2026',
  lineItems: [{ description: 'Pro Plan', quantity: 1, unitPrice: 29, total: 29 }],
  totalAmount: 29,
});
```

All functions return `{ success: true, data: { messageId } }` or `{ success: false, error: '...' }`. Never throw.

---

## Contact Management

```js
import { createContact, updateContact, tagContact, segmentContact, bulkSyncContacts } from 'brevo-saas-kit';

await createContact({ email: 'u@e.com', name: 'Muhammad Saleem', plan: 'free', updateIfExists: true });
await tagContact({ email: 'u@e.com', tags: ['upgraded', 'pro'], action: 'add' });
await segmentContact({ email: 'u@e.com', plan: 'pro', removeFromOtherPlans: true });

const result = await bulkSyncContacts({ contacts: users.map(u => ({ email: u.email, name: u.name, plan: u.plan })) });
console.log(`Synced: ${result.data.synced}, Failed: ${result.data.failed}`);
```

---

## Automation Workflows

```js
import { startOnboardingSequence, scheduleTrialReminders, startReEngagementSequence } from 'brevo-saas-kit';

// 5-step drip: Day 0, 1, 3, 7, 14
await startOnboardingSequence({ email: 'u@e.com', name: 'Muhammad', mode: 'inline' });

// plan mode returns a schedule array — dispatch steps with your own job scheduler
const { data } = await startOnboardingSequence({ email: 'u@e.com', name: 'Muhammad', mode: 'plan' });
// data.schedule = [{ stepIndex: 0, delayMs: 0, name: '...' }, ...]

// Trial reminders: 7d, 3d, 1d before expiry, then expired
await scheduleTrialReminders({ email: 'u@e.com', name: 'Muhammad', trialEndsAt: new Date('2026-05-01') });
```

---

## Webhooks

### Next.js App Router

```js
// app/api/brevo/webhook/route.js
import { createNextjsWebhookHandler } from 'brevo-saas-kit/integrations/nextjs/webhook';

export const POST = createNextjsWebhookHandler({
  secret: process.env.BREVO_WEBHOOK_SECRET,
  onBounced: async ({ email, isHardBounce }) => {
    if (isHardBounce) await db.users.update({ emailBounced: true }, { where: { email } });
  },
  onUnsubscribed: async ({ email }) => {
    await db.users.update({ unsubscribed: true }, { where: { email } });
  },
  onError: async (err) => console.error('[webhook]', err.message),
});
```

### Express

```js
import express from 'express';
import { createExpressWebhookRouter } from 'brevo-saas-kit/integrations/express';

app.post('/webhooks/brevo',
  express.raw({ type: '*/*' }),
  createExpressWebhookRouter({
    secret: process.env.BREVO_WEBHOOK_SECRET,
    onBounced: async ({ email, isHardBounce }) => { /* ... */ },
    onSpamComplaint: async ({ email }) => { /* ... */ },
  })
);
```

---

## Next.js Server Actions

```js
// app/signup/page.js
import { sendWelcomeEmail, createContact, startOnboardingSequence } from 'brevo-saas-kit/integrations/nextjs/actions';

// All 17 functions are pre-wrapped with 'use server'
await createContact({ email, name, plan: 'free' });
await sendWelcomeEmail({ email, name });
```

---

## Express Middleware

```js
import { brevoMiddleware } from 'brevo-saas-kit/integrations/express';

app.use(brevoMiddleware({
  apiKey: process.env.BREVO_API_KEY,
  sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
}));

// In any route:
app.post('/signup', async (req, res) => {
  await req.brevo.createContact({ email: req.body.email, name: req.body.name });
  await req.brevo.sendWelcomeEmail({ email: req.body.email, name: req.body.name });
  res.json({ success: true });
});
```

---

## Queue

```js
import { initQueue, queueEmail } from 'brevo-saas-kit/queue';

// Simple mode (default) — sends immediately, no Redis needed
await queueEmail({ type: 'welcome', payload: { email: 'u@e.com', name: 'Muhammad' } });

// Queue mode — async BullMQ processing (requires bullmq + Redis)
await initQueue({ redisUrl: process.env.REDIS_URL });
await queueEmail({ type: 'invoice', payload: { ... }, priority: 1 });
```

---

## Analytics

```js
import { getCampaignStats, getContactEngagement, exportStats } from 'brevo-saas-kit/analytics';

const stats = await getCampaignStats('msg-abc123');
// { sent: 1200, opened: 480, clicked: 96, bounced: 12, openRate: 40, clickRate: 8 }

const engagement = await getContactEngagement('user@example.com');
// { score: 68, rating: 'active', lastOpened: '2026-04-19T...', totalClicks: 5, totalOpens: 12 }

const csv = await exportStats({ campaignId: 'msg-abc123', format: 'csv' });
```

---

## Security

```js
import { createRateLimiter, sanitizeHtml, validateApiKey } from 'brevo-saas-kit/security';

// Rate limiter — 100 req / 15 min per IP, zero deps
const limiter = createRateLimiter({ maxRequests: 100, windowMs: 15 * 60 * 1000 });
app.use('/api/email', limiter);

// HTML sanitizer — strips XSS vectors, no deps
const safe = sanitizeHtml('<p>Hello</p><script>bad()</script>');

// API key health check
const { data } = await validateApiKey({ apiKey: process.env.BREVO_API_KEY });
// { valid: true, accountName: 'ITivs', plan: 'free', email: 'admin@itivs.com' }
```

---

## GDPR

```js
import { eraseContact, logConsent, unsubscribeContact } from 'brevo-saas-kit/gdpr';

// Right to erasure
await eraseContact('user@example.com');

// Signed consent logging
const { data } = await logConsent({ email: 'u@e.com', type: 'marketing', ip: req.ip });
// Store data.record + data.signature — verify integrity later

// One-click unsubscribe — removes from all lists + blacklists
await unsubscribeContact('user@example.com');
```

---

## Sub-path Exports

```js
import { sendWelcomeEmail } from 'brevo-saas-kit';                           // full bundle
import { sendWelcomeEmail } from 'brevo-saas-kit/transactional';             // transactional only
import { createContact } from 'brevo-saas-kit/contacts';
import { routeWebhookEvent } from 'brevo-saas-kit/webhooks';
import { startOnboardingSequence } from 'brevo-saas-kit/workflows';
import { initQueue, queueEmail } from 'brevo-saas-kit/queue';
import { getCampaignStats } from 'brevo-saas-kit/analytics';
import { createRateLimiter } from 'brevo-saas-kit/security';
import { eraseContact } from 'brevo-saas-kit/gdpr';
```

---

## What's Built

| Module | Status |
|--------|--------|
| Transactional emails (6 types) | ✅ |
| Contact management (6 operations) | ✅ |
| Automation workflows (5 sequences) | ✅ |
| Webhook handling (HMAC + event routing) | ✅ |
| Next.js integration (server actions + webhook) | ✅ |
| Express integration (middleware + webhook router) | ✅ |
| Queue system (simple + BullMQ modes) | ✅ |
| Analytics (campaign + contact + export) | ✅ |
| Security (rate limiter + sanitizer + key validator) | ✅ |
| GDPR (erasure + consent + unsubscribe) | ✅ |

---

## Requirements

- Node.js >= 18.0.0
- `@getbrevo/brevo` (included as dependency)
- `bullmq` + Redis (optional — queue mode only)

---

## License

MIT © [msal95](https://github.com/msal95)
