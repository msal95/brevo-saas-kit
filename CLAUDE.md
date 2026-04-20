# CLAUDE.md — Brevo SaaS Automation Library

This file gives Claude Code full context about this project — its purpose, architecture, build phases, and current progress. Update the status checkboxes as each module is completed.

---

## Project Overview

**Package Name:** `brevo-saas-automation`
**Language:** Node.js (ESM)
**Purpose:** A production-grade Brevo (formerly Sendinblue) automation library for SaaS developers. Not just an API wrapper — real workflow patterns, webhook handling, drip sequences, and framework integrations used in actual SaaS products.

**Target Frameworks:** Next.js, Express.js
**Key Dependencies:** `@getbrevo/brevo`, `bullmq`, `zod`

---

## Architecture Decisions

- **No nodemailer** — Brevo is the only transport
- **Webhook verification** — HMAC-SHA256 against raw body buffer, header `x-brevo-signature`
- **Contact list IDs** — env vars as default (`BREVO_LIST_FREE/PRO/ENTERPRISE`), override via options at call time
- **Phase 1 emails** — inline HTML (zero Brevo template setup required out of the box)
- **Phase 2 emails** — `sendTemplateEmail.js` with Brevo template IDs via env vars
- **Tags** — stored as `TAGS` comma-separated attribute on Brevo contact
- **Pure library** — zero framework dependency at core; integrations are thin wrappers only

---

## Folder Structure

```
brevo-saas-automation/
├── src/
│   ├── config/              → Brevo client init, env validation, constants
│   ├── transactional/       → Single sends, template-based sends, email modules
│   ├── contacts/            → Create, update, tag, delete, sync
│   ├── workflows/           → Drip sequences, onboarding, re-engagement
│   ├── webhooks/            → Signature verification, event router, handlers
│   ├── analytics/           → Stats fetcher, engagement scoring
│   ├── security/            → Rate limiting, input sanitization
│   ├── queue/               → BullMQ async send queue with retry
│   └── integrations/
│       ├── nextjs/          → API route helpers
│       └── express/         → Middleware + router
├── examples/
│   ├── nextjs-app/
│   ├── express-app/
│   └── standalone/
├── templates/
│   ├── welcome.html
│   ├── otp.html
│   ├── invoice.html
│   ├── reset-password.html
│   ├── reengagement.html
│   └── trial-expiry.html
├── tests/
│   ├── config.test.js
│   ├── transactional.test.js
│   ├── contacts.test.js
│   ├── webhooks.test.js
│   └── workflows.test.js
├── CLAUDE.md                → This file
├── README.md
├── TESTING.md
├── USAGE.md
├── CONTRIBUTING.md
├── .env.example
├── package.json
└── index.js                 → Main export entry point
```

---

## Environment Variables Required

```env
BREVO_API_KEY=your_api_key_here
BREVO_WEBHOOK_SECRET=your_webhook_secret
BREVO_SENDER_EMAIL=no-reply@yourdomain.com
BREVO_SENDER_NAME=YourApp

# Contact list IDs (Brevo dashboard → Contacts → Lists)
BREVO_LIST_FREE=1
BREVO_LIST_PRO=2
BREVO_LIST_ENTERPRISE=3

# Only needed for queue module (Phase 4)
REDIS_URL=redis://localhost:6379
```

---

## Build Phases & Progress Tracker

Update `[x]` as each task is completed.

---

### ✅ Phase 1 — Core Foundation
> Goal: Working base that can send emails and manage contacts.

#### 1.1 Config Module (`src/config/`)
- [x] `brevoClient.js` — Initialize Brevo SDK with API key validation
- [x] `envValidator.js` — Zod-based env variable validation on startup
- [x] `constants.js` — Shared constants (event names, default values)

#### 1.2 Transactional Emails (`src/transactional/`)
- [x] `sendEmail.js` — Core single email send function
- [x] `sendTemplateEmail.js` — Send using Brevo template ID
- [x] `welcome.js` — Welcome email on user signup
- [x] `emailVerification.js` — OTP / verify email flow
- [x] `passwordReset.js` — Password reset link email
- [x] `invoice.js` — Invoice/receipt email with line items
- [x] `accountDeletion.js` — Account deletion confirmation
- [x] `roleChange.js` — Notify user of role change

#### 1.3 Contact Management (`src/contacts/`)
- [x] `createContact.js` — Add contact on signup
- [x] `updateContact.js` — Update attributes
- [x] `deleteContact.js` — GDPR delete
- [x] `tagContact.js` — Add/remove tags
- [x] `segmentContact.js` — Move contact to list by plan (free/pro/enterprise)
- [x] `bulkSync.js` — Sync array of users from DB to Brevo

#### 1.4 Webhook Handler (`src/webhooks/`)
- [x] `verifySignature.js` — Validate Brevo webhook HMAC-SHA256 signature
- [x] `eventRouter.js` — Route events to correct handlers
- [x] `handlers/opened.js` — Email opened event
- [x] `handlers/clicked.js` — Link clicked event
- [x] `handlers/bounced.js` — Bounce → auto-disable contact
- [x] `handlers/spam.js` — Spam complaint handler
- [x] `handlers/unsubscribed.js` — Unsubscribe handler

#### 1.5 Tests
- [x] `tests/config.test.js` — 17 tests covering envValidator, brevoClient, constants
- [x] `tests/transactional.test.js` — 23 tests covering all email modules
- [x] `tests/contacts.test.js` — 24 tests covering all contact modules
- [x] `tests/webhooks.test.js` — 25 tests covering verifySignature, eventRouter, all handlers

#### 1.6 Entry Point
- [x] `index.js` — All Phase 1 exports

---

### ✅ Phase 2 — Automation Workflows
> Goal: Full drip sequence builder and SaaS lifecycle automations.

#### 2.1 Workflow Engine (`src/workflows/`)
- [x] `workflowRunner.js` — Core scheduler that sequences emails with delays
- [x] `onboarding.js` — Day 0, 1, 3, 7, 14 onboarding drip
- [x] `trialExpiry.js` — Trial expiry reminders (7d, 3d, 1d, expired)
- [x] `reEngagement.js` — Inactive user re-engagement sequence
- [x] `featureAnnouncement.js` — Broadcast to all/segment
- [x] `upsell.js` — Upgrade nudge for free plan users

#### 2.2 Email Templates (`templates/`)
- [x] `welcome.html` — Welcome email template
- [x] `otp.html` — OTP verification template
- [x] `invoice.html` — Invoice/receipt template
- [x] `reset-password.html` — Password reset template
- [x] `reengagement.html` — Re-engagement campaign template
- [x] `trial-expiry.html` — Trial expiry reminder template

#### 2.3 Tests
- [x] `tests/workflows.test.js` — 36 tests covering workflowRunner, onboarding, trialExpiry, reEngagement, featureAnnouncement, upsell

---

### ✅ Phase 3 — Framework Integrations
> Goal: Drop-in helpers for Next.js and Express.

#### 3.1 Next.js Integration (`src/integrations/nextjs/`)
- [x] `actions/index.js` — 17 server actions wrapping all core functions (`'use server'`)
- [x] `webhook/route.js` — `createNextjsWebhookHandler` for App Router POST handler (raw body HMAC)

#### 3.2 Express Integration (`src/integrations/express/`)
- [x] `brevoMiddleware.js` — Attach Brevo helpers to `req.brevo`, optional `initBrevo` on mount
- [x] `webhookRouter.js` — `createExpressWebhookRouter` handler (requires `express.raw()` upstream)

#### 3.3 Tests
- [x] `tests/integrations.test.js` — 22 tests covering all integration modules

---

### ✅ Phase 4 — Advanced Features
> Goal: Production hardening — queuing, analytics, GDPR, security.

#### 4.1 Queue System (`src/queue/`)
- [x] `emailQueue.js` — Dual-mode: immediate sends (simple) or BullMQ async queue (opt-in via initQueue)
- [x] `retryStrategy.js` — withRetry() with exponential backoff (1s → 5s → 30s), BullMQ retry config helper
- [x] `queueMonitor.js` — getQueueHealth() and pingQueue(); live BullMQ stats in queue mode, zero-counts in simple mode

#### 4.2 Analytics (`src/analytics/`)
- [x] `campaignStats.js` — getCampaignStats(campaignId): sent, opened, clicked, bounced, openRate, clickRate
- [x] `contactEngagement.js` — getContactEngagement(email): score 0–100, rating, lastOpened, totalClicks
- [x] `exportStats.js` — exportStats({ campaignId, email, format }): JSON object or CSV string

#### 4.3 Security (`src/security/`)
- [x] `rateLimiter.js` — createRateLimiter({ maxRequests, windowMs }): in-memory, zero deps, Express-compatible middleware
- [x] `inputSanitizer.js` — sanitizeSubject, sanitizeName, sanitizeHtml, sanitizeEmailOptions: strips XSS vectors, no deps
- [x] `apiKeyValidator.js` — validateApiKey(): hits Brevo /account endpoint, returns valid, accountName, plan, email

#### 4.4 GDPR Compliance (`src/gdpr/`)
- [x] `rightToErasure.js` — eraseContact(email): deletes from Brevo, returns confirmed timestamp
- [x] `consentLogger.js` — logConsent({ email, type, ip, timestamp }): HMAC-signed consent record, verifyConsentSignature()
- [x] `unsubscribeHandler.js` — unsubscribeContact(email): removes from all lists, sets emailBlacklisted=true

#### 4.5 Tests
- [x] `tests/phase4.test.js` — 65 tests covering all queue, analytics, security, and GDPR modules

---

## Coding Conventions

- **ESM only** — `import`/`export`, zero CommonJS
- **async/await** throughout, no `.then()` chains, no callbacks
- **Return shape** for all async public functions:
  ```js
  { success: true, data: ... }
  { success: false, error: '...' }
  ```
  Never throw from public functions — catch and return error shape
- **Zod validation** on every function that accepts input
- **JSDoc** on every exported function with `@param` and `@returns`
- **Named exports only** — no default exports on modules
- **Max 80 lines per function** — split into helpers if longer
- **No hardcoded values** — options object or env only
- **Descriptive errors** — always include context, never silent failures

---

## Module Export Pattern

```js
// src/transactional/welcome.js

/**
 * Send welcome email to a newly registered user
 * @param {object} options
 * @param {string} options.email - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} [options.dashboardUrl] - Link to user dashboard
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendWelcomeEmail({ email, name, dashboardUrl }) {
  // implementation
}
```

---

## Testing Approach

- Use **Vitest** for unit tests — run with `npm test`
- Mock Brevo SDK responses — never hit real API in tests
- Mock `brevoClient.js` with `vi.mock` in each test file
- Use `vi.fn()` inside `vi.mock` factories (not in outer scope) to avoid ESM hoisting issues
- See `TESTING.md` for full documentation, curl examples, and sandbox setup

---

## Current Status Summary

| Phase | Status | Tests |
|-------|--------|-------|
| Phase 1 — Core Foundation | 🟢 Complete | 89 passing |
| Phase 2 — Workflows | 🟢 Complete | 36 passing |
| Phase 3 — Integrations | 🟢 Complete | 22 passing |
| Phase 4 — Advanced | 🟢 Complete | 65 passing |

---

## How to Use This File With Claude Code

When starting a new session, tell Claude:
> "Read CLAUDE.md and check the progress tracker. I want to build [module name] next."

Claude will know the full project context, what's already built, what remains, and the coding conventions to follow — without you re-explaining anything.
