# USAGE.md — brevo-saas-automation

Copy-paste examples for every exported function — Next.js and Express.

---

## Installation & Setup

```bash
npm install brevo-saas-automation
```

### Environment Variables

```env
BREVO_API_KEY=xkeysib-your-api-key
BREVO_SENDER_EMAIL=no-reply@yourdomain.com
BREVO_SENDER_NAME=YourApp
BREVO_WEBHOOK_SECRET=your-webhook-secret
BREVO_LIST_FREE=1
BREVO_LIST_PRO=2
BREVO_LIST_ENTERPRISE=3
```

---

## Initialization

### Next.js (`lib/brevo.js`)

```js
import { initBrevo } from 'brevo-saas-automation';

// Call once at startup — or lazily in a lib file
initBrevo({
  apiKey: process.env.BREVO_API_KEY,
  sender: {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME,
  },
});
```

Import this file in your app entry point or in each API route that needs it.

### Express (`app.js`)

```js
import express from 'express';
import { initBrevo } from 'brevo-saas-automation';

const app = express();

initBrevo({
  apiKey: process.env.BREVO_API_KEY,
  sender: {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME,
  },
});
```

### Auto-init via env vars (no explicit call needed)

If you don't call `initBrevo()`, every function automatically reads from env vars:
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`

---

## Transactional Emails

### `sendEmail` — Core send function

```js
import { sendEmail } from 'brevo-saas-automation';

// Single recipient
const result = await sendEmail({
  to: 'user@example.com',
  subject: 'Hello!',
  htmlContent: '<p>Hello <strong>World</strong></p>',
});

// Multiple recipients
const result = await sendEmail({
  to: [
    { email: 'alice@example.com', name: 'Alice' },
    { email: 'bob@example.com', name: 'Bob' },
  ],
  subject: 'Team announcement',
  htmlContent: '<p>Important update...</p>',
  textContent: 'Important update...',  // plain text fallback
  replyTo: { email: 'support@yourapp.com', name: 'Support' },
  tags: ['announcement'],
});

// Result shape
// { success: true, data: { messageId: '<msg123@smtp-relay.brevo.com>' } }
// { success: false, error: 'sendEmail failed: ...' }
```

---

### `sendTemplateEmail` — Brevo dashboard template

```js
import { sendTemplateEmail } from 'brevo-saas-automation';

const result = await sendTemplateEmail({
  to: 'user@example.com',
  templateId: 5,                   // integer ID from Brevo dashboard
  params: {                        // variables used in your template
    FIRSTNAME: 'Muhammad',
    DASHBOARD_URL: 'https://yourapp.com/dashboard',
  },
  tags: ['welcome'],
});
```

---

### `sendWelcomeEmail`

```js
import { sendWelcomeEmail } from 'brevo-saas-automation';

// Next.js API route (app router)
// app/api/auth/signup/route.js
export async function POST(request) {
  const { email, name } = await request.json();

  await sendWelcomeEmail({
    email,
    name,
    dashboardUrl: `https://yourapp.com/dashboard`,
    appName: 'YourApp',
  });

  return Response.json({ success: true });
}

// Express
app.post('/auth/signup', async (req, res) => {
  const { email, name } = req.body;

  const result = await sendWelcomeEmail({
    email,
    name,
    dashboardUrl: 'https://yourapp.com/dashboard',
    appName: 'YourApp',
  });

  if (!result.success) {
    console.error('Welcome email failed:', result.error);
    // Non-blocking — don't fail signup if email fails
  }

  res.json({ success: true });
});
```

---

### `sendVerificationEmail`

```js
import { sendVerificationEmail } from 'brevo-saas-automation';

// Generate OTP wherever you prefer (e.g. crypto.randomInt)
import { randomInt } from 'crypto';
const otp = String(randomInt(100000, 999999));

const result = await sendVerificationEmail({
  email: 'user@example.com',
  name: 'Muhammad',
  otp,
  expiresInMinutes: 10,   // default: 10
  appName: 'YourApp',
});
```

---

### `sendPasswordResetEmail`

```js
import { sendPasswordResetEmail } from 'brevo-saas-automation';

// After generating a signed reset token in your auth system
const result = await sendPasswordResetEmail({
  email: 'user@example.com',
  name: 'Muhammad',
  resetUrl: `https://yourapp.com/reset-password?token=${signedToken}`,
  expiresInHours: 1,      // default: 1
  appName: 'YourApp',
});
```

---

### `sendInvoiceEmail`

```js
import { sendInvoiceEmail } from 'brevo-saas-automation';

const result = await sendInvoiceEmail({
  email: 'customer@example.com',
  name: 'Muhammad',
  invoiceNumber: 'INV-2026-001',
  invoiceDate: 'April 20, 2026',
  lineItems: [
    { description: 'Pro Plan — Monthly', quantity: 1, unitPrice: 29.00, total: 29.00 },
    { description: 'Extra Seats (3)', quantity: 3, unitPrice: 5.00, total: 15.00 },
  ],
  totalAmount: 44.00,
  currency: 'USD',                                  // default: USD
  paymentUrl: 'https://yourapp.com/billing/pay',   // optional: add Pay Now button
  appName: 'YourApp',
});
```

---

### `sendAccountDeletionEmail`

```js
import { sendAccountDeletionEmail } from 'brevo-saas-automation';

const result = await sendAccountDeletionEmail({
  email: 'user@example.com',
  name: 'Muhammad',
  deletedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  appName: 'YourApp',
  feedbackUrl: 'https://yourapp.com/feedback',   // optional
});
```

---

### `sendRoleChangeEmail`

```js
import { sendRoleChangeEmail } from 'brevo-saas-automation';

const result = await sendRoleChangeEmail({
  email: 'user@example.com',
  name: 'Muhammad',
  previousRole: 'member',
  newRole: 'admin',
  changedBy: 'Sarah (Owner)',                      // optional
  dashboardUrl: 'https://yourapp.com/dashboard',   // optional
  appName: 'YourApp',
});
```

---

## Contact Management

### `createContact`

```js
import { createContact } from 'brevo-saas-automation';

// On user signup
const result = await createContact({
  email: 'user@example.com',
  name: 'Muhammad Saleem',       // auto-split into FIRSTNAME/LASTNAME
  plan: 'free',                  // auto-assigns to BREVO_LIST_FREE list
  tags: ['signup', 'web'],       // stored as TAGS attribute
  attributes: {
    COMPANY: 'ITivs',
    ROLE: 'admin',
    PLAN: 'free',
  },
  updateIfExists: true,          // update if email already exists (default: false)
});

// result.data.id — Brevo contact ID
```

---

### `updateContact`

```js
import { updateContact } from 'brevo-saas-automation';

// After plan upgrade
const result = await updateContact({
  email: 'user@example.com',
  attributes: {
    PLAN: 'pro',
    UPGRADED_AT: new Date().toISOString(),
  },
  listIds: [2],          // add to new list
  unlinkListIds: [1],    // remove from old list
});

// Mark as bounced (stop marketing sends)
await updateContact({
  email: 'bounced@example.com',
  emailBlacklisted: true,
});
```

---

### `deleteContact`

```js
import { deleteContact } from 'brevo-saas-automation';

// GDPR right to erasure — removes from Brevo completely
const result = await deleteContact({ email: 'user@example.com' });
```

---

### `tagContact`

```js
import { tagContact } from 'brevo-saas-automation';

// Add tags (merges with existing)
await tagContact({ email: 'user@example.com', tags: ['upgraded', 'pro-user'] });

// Remove specific tags
await tagContact({
  email: 'user@example.com',
  tags: ['trial-user'],
  action: 'remove',
});

// Replace all tags
await tagContact({
  email: 'user@example.com',
  tags: ['churned'],
  action: 'set',
});
```

---

### `segmentContact`

```js
import { segmentContact } from 'brevo-saas-automation';

// Move to pro list using env var BREVO_LIST_PRO
await segmentContact({
  email: 'user@example.com',
  plan: 'pro',
  removeFromOtherPlans: true,   // removes from free/enterprise lists
});

// Override with explicit list ID
await segmentContact({
  email: 'user@example.com',
  plan: 'enterprise',
  listId: 42,                   // overrides BREVO_LIST_ENTERPRISE env var
});
```

---

### `bulkSyncContacts`

```js
import { bulkSyncContacts } from 'brevo-saas-automation';

// Sync all users from your database to Brevo
const users = await db.users.findAll({ where: { syncedToBrevo: false } });

const result = await bulkSyncContacts({
  contacts: users.map(u => ({
    email: u.email,
    name: u.name,
    plan: u.plan,               // auto-assigns to correct list
    attributes: {
      COMPANY: u.company,
      ROLE: u.role,
    },
  })),
  updateExisting: true,         // update if contact already exists (default: true)
});

console.log(`Synced: ${result.data.synced}, Failed: ${result.data.failed}`);
if (result.data.errors.length) {
  console.error('Batch errors:', result.data.errors);
}
```

---

## Webhook Handling

### Next.js App Router — using `createNextjsWebhookHandler` (recommended)

```js
// app/api/brevo/webhook/route.js
import { createNextjsWebhookHandler } from 'brevo-saas-automation/integrations/nextjs/webhook';

export const POST = createNextjsWebhookHandler({
  secret: process.env.BREVO_WEBHOOK_SECRET,

  onOpened: async ({ email, subject }) => {
    await db.emailEvents.create({ email, event: 'opened', subject });
  },

  onClicked: async ({ email, link }) => {
    await db.emailEvents.create({ email, event: 'clicked', link });
  },

  onBounced: async ({ email, isHardBounce }) => {
    if (isHardBounce) {
      await db.users.update({ emailBounced: true }, { where: { email } });
    }
  },

  onSpamComplaint: async ({ email }) => {
    await db.users.update({ markedSpam: true }, { where: { email } });
  },

  onUnsubscribed: async ({ email }) => {
    await db.users.update({ unsubscribed: true }, { where: { email } });
  },

  onError: async (err, request) => {
    console.error('[brevo webhook]', err.message);
  },
});
```

`createNextjsWebhookHandler` reads raw bytes via `request.arrayBuffer()` before any JSON parsing — HMAC verification always runs on the original unmodified body.

---

### Next.js App Router — using `routeWebhookEvent` directly

```js
// app/api/brevo/webhook/route.js
import { verifyWebhookSignatureFromEnv, routeWebhookEvent } from 'brevo-saas-automation';

export async function POST(request) {
  // Read raw bytes FIRST — before JSON.parse — for correct HMAC verification
  const arrayBuffer = await request.arrayBuffer();
  const rawBody = Buffer.from(arrayBuffer);
  const signature = request.headers.get('x-brevo-signature') ?? '';

  const verification = verifyWebhookSignatureFromEnv({ rawBody, signature });
  if (!verification.success) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString('utf8'));
  const result = await routeWebhookEvent(payload, {
    onBounced: async ({ email, isHardBounce }) => {
      if (isHardBounce) await db.users.update({ emailBounced: true }, { where: { email } });
    },
    onUnsubscribed: async ({ email }) => {
      await db.users.update({ unsubscribed: true }, { where: { email } });
    },
  });

  if (!result.success) {
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }

  return Response.json({ received: true });
}
```

---

### Express — using `createExpressWebhookRouter` (recommended)

```js
// routes/webhook.js
import express from 'express';
import { createExpressWebhookRouter } from 'brevo-saas-automation/integrations/express';

const router = express.Router();

// express.raw() is required — it gives req.body as a Buffer for HMAC verification
router.post(
  '/brevo',
  express.raw({ type: '*/*' }),
  createExpressWebhookRouter({
    secret: process.env.BREVO_WEBHOOK_SECRET,  // or set BREVO_WEBHOOK_SECRET env var

    onOpened: async ({ email }) => {
      await db.emailEvents.create({ email, event: 'opened' });
    },

    onBounced: async ({ email, isHardBounce }) => {
      if (isHardBounce) {
        await db.users.update({ emailBounced: true }, { where: { email } });
      }
    },

    onUnsubscribed: async ({ email }) => {
      await db.users.update({ unsubscribed: true }, { where: { email } });
    },

    onSpamComplaint: async ({ email }) => {
      await db.users.update({ markedSpam: true }, { where: { email } });
    },

    onError: async (err, req, res) => {
      console.error('[brevo webhook]', err.message);
    },
  })
);

export default router;
```

In `app.js`:
```js
import webhookRouter from './routes/webhook.js';
app.use('/webhooks', webhookRouter);
// Webhook endpoint: POST /webhooks/brevo
```

If you set `BREVO_WEBHOOK_SECRET` in your environment, you can omit `secret` from the options entirely.

---

### Express — using `routeWebhookEvent` directly

```js
import { verifyWebhookSignatureFromEnv, routeWebhookEvent } from 'brevo-saas-automation';

router.post('/brevo', express.raw({ type: '*/*' }), async (req, res) => {
  const rawBody = req.body;   // Buffer from express.raw()
  const signature = req.headers['x-brevo-signature'] ?? '';

  const verification = verifyWebhookSignatureFromEnv({ rawBody, signature });
  if (!verification.success) return res.status(401).json({ error: 'Unauthorized' });

  const payload = JSON.parse(rawBody.toString('utf8'));
  const result = await routeWebhookEvent(payload, {
    onBounced: async ({ email, isHardBounce }) => {
      if (isHardBounce) await db.users.update({ emailBounced: true }, { where: { email } });
    },
    onUnsubscribed: async ({ email }) => {
      await db.users.update({ unsubscribed: true }, { where: { email } });
    },
  });

  if (!result.success) return res.status(500).json({ error: 'Processing failed' });
  res.json({ received: true });
});
```

---

### Manual signature verification

```js
import { verifyWebhookSignature } from 'brevo-saas-automation';

const result = verifyWebhookSignature({
  rawBody: rawBodyStringOrBuffer,
  signature: req.headers['x-brevo-signature'],
  secret: 'your-explicit-secret',   // instead of env var
});

if (!result.success) {
  // result.error describes what failed
}
```

---

## Env Validation

### Validate at startup (fail fast)

```js
import { requireEnv } from 'brevo-saas-automation';

// Throws with a clear message if any required var is missing/invalid
// Call once in your app startup before doing anything else
requireEnv();
```

### Validate without throwing

```js
import { validateEnv } from 'brevo-saas-automation';

const result = validateEnv();
if (!result.success) {
  console.error(result.error);
  process.exit(1);
}
const env = result.data;
// env.BREVO_API_KEY, env.BREVO_LIST_FREE (as number), etc.
```

---

## Return Shape

Every async function returns the same consistent shape — never throws:

```js
// Success
{ success: true, data: { ... } }

// Failure
{ success: false, error: 'descriptive error message with context' }
```

Pattern for handling results:

```js
const result = await sendWelcomeEmail({ email, name });

if (!result.success) {
  // Log and handle gracefully — don't crash
  console.error('[email]', result.error);
  return;
}

console.log('Sent:', result.data.messageId);
```

---

## Framework Integrations

### Next.js Server Actions

Import pre-built server actions directly into your Server Components and form actions. Every function has `'use server'` baked in.

```js
// app/auth/signup/page.js (Server Component)
import {
  sendWelcomeEmail,
  createContact,
  startOnboardingSequence,
} from 'brevo-saas-automation/integrations/nextjs/actions';

export async function signupAction(formData) {
  'use server';
  const email = formData.get('email');
  const name  = formData.get('name');

  // Create contact in Brevo
  await createContact({ email, name, plan: 'free' });

  // Send welcome email
  await sendWelcomeEmail({ email, name, dashboardUrl: 'https://yourapp.com/dashboard' });

  // Kick off onboarding drip (plan mode — use your job scheduler to dispatch steps)
  const sequence = await startOnboardingSequence({ email, name, mode: 'plan' });
  await jobQueue.add('onboarding', sequence.data);
}
```

Available server actions (all mirror the core functions 1-to-1):

| Action | Module |
|--------|--------|
| `sendWelcomeEmail` | transactional |
| `sendVerificationEmail` | transactional |
| `sendPasswordResetEmail` | transactional |
| `sendInvoiceEmail` | transactional |
| `sendAccountDeletionEmail` | transactional |
| `sendRoleChangeEmail` | transactional |
| `createContact` | contacts |
| `updateContact` | contacts |
| `deleteContact` | contacts |
| `tagContact` | contacts |
| `segmentContact` | contacts |
| `bulkSyncContacts` | contacts |
| `startOnboardingSequence` | workflows |
| `scheduleTrialReminders` | workflows |
| `startReEngagementSequence` | workflows |
| `sendFeatureAnnouncement` | workflows |
| `startUpsellSequence` | workflows |

---

### Express Middleware

Attach all Brevo helpers to `req.brevo` so any route handler can use them without importing.

```js
// app.js
import express from 'express';
import { brevoMiddleware } from 'brevo-saas-automation/integrations/express';

const app = express();

// Option 1: pass credentials directly (calls initBrevo internally)
app.use(brevoMiddleware({
  apiKey: process.env.BREVO_API_KEY,
  sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
}));

// Option 2: rely on env vars (initBrevo was already called, or env vars are set)
app.use(brevoMiddleware());
```

In any route handler:

```js
app.post('/auth/signup', async (req, res) => {
  const { email, name } = req.body;

  await req.brevo.createContact({ email, name, plan: 'free' });
  await req.brevo.sendWelcomeEmail({ email, name });
  await req.brevo.startOnboardingSequence({ email, name, mode: 'plan' });

  res.json({ success: true });
});
```

`req.brevo` exposes: `sendWelcomeEmail`, `sendVerificationEmail`, `sendPasswordResetEmail`, `sendInvoiceEmail`, `sendAccountDeletionEmail`, `sendRoleChangeEmail`, `createContact`, `updateContact`, `deleteContact`, `tagContact`, `segmentContact`, `bulkSyncContacts`, `startOnboardingSequence`, `scheduleTrialReminders`, `startReEngagementSequence`, `sendFeatureAnnouncement`, `startUpsellSequence`.

---

## Queue

### Simple mode (default — no Redis, no config)

Simple mode is the default. `queueEmail()` sends immediately in the same process. Zero setup required.

```js
import { queueEmail } from 'brevo-saas-automation/queue';

// Fires the welcome email right now (simple mode)
const result = await queueEmail({
  type: 'welcome',
  payload: { email: 'user@example.com', name: 'Muhammad' },
});
// { success: true, data: { messageId: '...' } }
```

Supported types: `welcome`, `verification`, `password-reset`, `invoice`, `account-delete`, `role-change`.

---

### Queue mode (opt-in — requires BullMQ + Redis)

```bash
npm install bullmq
```

```js
// app.js — call once at startup
import { initQueue } from 'brevo-saas-automation/queue';

await initQueue({ redisUrl: process.env.REDIS_URL });

// Now queueEmail() adds jobs to BullMQ instead of sending inline
import { queueEmail } from 'brevo-saas-automation/queue';

await queueEmail({
  type: 'invoice',
  payload: {
    email: 'customer@example.com',
    name: 'Muhammad',
    invoiceNumber: 'INV-001',
    invoiceDate: 'April 20, 2026',
    lineItems: [{ description: 'Pro Plan', quantity: 1, unitPrice: 29, total: 29 }],
    totalAmount: 29,
  },
  priority: 1,   // 1 = highest priority
});
// { success: true, data: { mode: 'queue', jobId: '42', type: 'invoice' } }
```

---

### Retry strategy

```js
import { withRetry, getBackoffDelay, buildQueueRetryOptions } from 'brevo-saas-automation/queue';

// Retry any async function — 1s → 5s → 30s backoff
const result = await withRetry({
  fn: async () => sendEmail({ to: 'u@e.com', subject: 'Hi', htmlContent: '<p>Hi</p>' }),
  maxAttempts: 3,
  onRetry: (attempt, err, delayMs) => {
    console.warn(`Retry attempt ${attempt} after ${delayMs}ms — ${err.message}`);
  },
});

// Get delay for a specific attempt number (for custom schedulers)
getBackoffDelay(1); // 1000
getBackoffDelay(2); // 5000
getBackoffDelay(3); // 30000

// Build BullMQ job retry options
const retryOpts = buildQueueRetryOptions({ attempts: 5, initialDelay: 2000 });
// { attempts: 5, backoff: { type: 'exponential', delay: 2000 } }
```

---

### Queue health monitoring

```js
import { getQueueHealth, pingQueue } from 'brevo-saas-automation/queue';

// Check pending/active/failed/completed counts
const health = await getQueueHealth();
// Simple mode: { success: true, data: { mode: 'simple', pending: 0, active: 0, failed: 0, completed: 0 } }
// Queue mode:  { success: true, data: { mode: 'queue', pending: 3, active: 1, failed: 0, completed: 147 } }

// Ping the queue connection
const ping = await pingQueue();
// { success: true, data: { alive: true, mode: 'queue' } }
```

---

## Analytics

```js
import { getCampaignStats, getContactEngagement, exportStats } from 'brevo-saas-automation/analytics';

// Campaign stats — pass your Brevo message ID or campaign ID
const stats = await getCampaignStats('msg-abc123');
// {
//   success: true,
//   data: { sent: 1200, opened: 480, clicked: 96, bounced: 12, openRate: 40, clickRate: 8 }
// }

// Contact engagement score
const engagement = await getContactEngagement('user@example.com');
// {
//   success: true,
//   data: { score: 68, rating: 'active', lastOpened: '2026-04-19T10:00:00Z', totalClicks: 5, totalOpens: 12 }
// }
// Ratings: champion (80+), active (60+), engaged (40+), dormant (20+), inactive (0+)

// Export as JSON (both campaign and contact)
const json = await exportStats({ campaignId: 'msg-abc123', email: 'user@example.com', format: 'json' });

// Export as CSV string
const csv = await exportStats({ campaignId: 'msg-abc123', format: 'csv' });
console.log(csv.data);
// type,id,sent,opened,clicked,bounced,openRate,clickRate
// campaign,msg-abc123,1200,480,96,12,40,8
```

---

## Security

### Rate limiter

```js
import { createRateLimiter } from 'brevo-saas-automation/security';

// Express middleware — 100 requests per 15 minutes per IP
const limiter = createRateLimiter({
  maxRequests: 100,
  windowMs: 15 * 60 * 1000,
  keyFn: (req) => req.user?.id ?? req.ip,   // optional: rate-limit per user ID
  onLimitReached: (key, req) => {
    console.warn(`Rate limit hit for ${key}`);
  },
});

app.use('/api/send-email', limiter);

// Standalone check (without Express)
const result = limiter.check('user-id-123');
// { allowed: true, remaining: 99, resetAt: 1713600000000 }

limiter.reset('user-id-123');  // clear limit for a specific key
limiter.clear();               // clear all limits
```

---

### Input sanitizer

```js
import {
  sanitizeSubject,
  sanitizeName,
  sanitizeHtml,
  sanitizeEmailOptions,
} from 'brevo-saas-automation/security';

// Sanitize email subject
const s = sanitizeSubject('  Hello\nWorld  ');
// { success: true, data: 'Hello World' }

// Sanitize display name
const n = sanitizeName('<script>alert(1)</script>Muhammad');
// { success: true, data: 'Muhammad' }

// Sanitize raw HTML — strips script, iframe, event handlers, javascript: hrefs
const h = sanitizeHtml('<p>Hello</p><script>bad()</script><a onclick="steal()">Click</a>');
// { success: true, data: '<p>Hello</p><a>Click</a>' }

// Sanitize a full email options object before passing to sendEmail()
const opts = sanitizeEmailOptions({
  subject: '  Invoice\x00Ready  ',
  htmlContent: '<p>Your invoice</p><iframe src="evil.com"></iframe>',
  to: 'user@example.com',
});
// opts.data.subject = 'Invoice Ready'
// opts.data.htmlContent = '<p>Your invoice</p>'
```

---

### API key validator

```js
import { validateApiKey } from 'brevo-saas-automation/security';

// Validate using env var
const result = await validateApiKey();
// Or pass explicitly:
const result = await validateApiKey({ apiKey: 'xkeysib-...' });

// { success: true, data: { valid: true, accountName: 'ITivs', plan: 'free', email: 'admin@itivs.com' } }
// { success: true, data: { valid: false, ... } }   ← invalid key
// { success: false, error: '...' }                 ← network error
```

---

## GDPR

### Right to erasure

```js
import { eraseContact } from 'brevo-saas-automation/gdpr';

// Delete a contact from Brevo (GDPR Art. 17)
const result = await eraseContact('user@example.com');
// { success: true, data: { email: 'user@example.com', deletedAt: '2026-04-20T08:00:00.000Z', confirmed: true } }

// With custom logger
await eraseContact('user@example.com', {
  logger: { info: myLogger.info, error: myLogger.error },
});
```

---

### Consent logger

```js
import { logConsent, verifyConsentSignature } from 'brevo-saas-automation/gdpr';

// Log a consent event — returns a tamper-evident HMAC-signed record
const result = await logConsent({
  email: 'user@example.com',
  type: 'marketing',          // 'marketing' | 'transactional' | 'analytics' | 'all'
  ip: req.ip,
  timestamp: new Date(),      // default: now
  metadata: { source: 'signup-form', version: '2.1' },
});

// result.data.record  — the consent record object
// result.data.signature — 64-char HMAC-SHA256 hex string

// Store both in your database, then verify integrity later:
const { valid } = verifyConsentSignature(storedRecord, storedSignature);
// valid: true  — record is intact
// valid: false — record was tampered with
```

---

### Unsubscribe handler

```js
import { unsubscribeContact } from 'brevo-saas-automation/gdpr';

// One-click unsubscribe — removes from all Brevo lists, sets emailBlacklisted: true
const result = await unsubscribeContact('user@example.com');
// { success: true, data: { email: 'user@example.com', unsubscribedAt: '2026-04-20T...', blacklisted: true } }

// Express unsubscribe endpoint
app.get('/unsubscribe', async (req, res) => {
  const { email } = req.query;
  const result = await unsubscribeContact(email);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.send('<p>You have been unsubscribed.</p>');
});
```

---

## Sub-path Imports

You can import from the full package or from sub-paths:

```js
// Full package
import { sendWelcomeEmail, createContact, routeWebhookEvent } from 'brevo-saas-automation';

// Sub-path (better tree-shaking)
import { sendWelcomeEmail } from 'brevo-saas-automation/transactional';
import { createContact, bulkSyncContacts } from 'brevo-saas-automation/contacts';
import { routeWebhookEvent, verifyWebhookSignatureFromEnv } from 'brevo-saas-automation/webhooks';
import { startOnboardingSequence } from 'brevo-saas-automation/workflows';

// Phase 4
import { initQueue, queueEmail, withRetry, getQueueHealth } from 'brevo-saas-automation/queue';
import { getCampaignStats, getContactEngagement, exportStats } from 'brevo-saas-automation/analytics';
import { createRateLimiter, sanitizeHtml, validateApiKey } from 'brevo-saas-automation/security';
import { eraseContact, logConsent, unsubscribeContact } from 'brevo-saas-automation/gdpr';

// Integrations
import { createNextjsWebhookHandler } from 'brevo-saas-automation/integrations/nextjs/webhook';
import { brevoMiddleware, createExpressWebhookRouter } from 'brevo-saas-automation/integrations/express';
import { sendWelcomeEmail } from 'brevo-saas-automation/integrations/nextjs/actions';
```
