# CHANGELOG

## v0.1.0 — Initial Release

---

### Phase 1 — Core Foundation

- **config/brevoClient.js** — Brevo SDK initialization with explicit `initBrevo()` or env var fallback
- **config/envValidator.js** — Zod-based env variable validation with `validateEnv()` and `requireEnv()`
- **config/constants.js** — Shared constants: WEBHOOK_EVENTS, CONTACT_PLANS, EMAIL_DEFAULTS, BULK_SYNC_CHUNK_SIZE
- **transactional/sendEmail.js** — Core single-send function with multi-recipient support
- **transactional/sendTemplateEmail.js** — Send using Brevo template ID with dynamic params
- **transactional/welcome.js** — Welcome email on user signup
- **transactional/emailVerification.js** — OTP / email verification flow
- **transactional/passwordReset.js** — Password reset link email
- **transactional/invoice.js** — Invoice/receipt email with line items table
- **transactional/accountDeletion.js** — Account deletion confirmation email
- **transactional/roleChange.js** — Role change notification email
- **contacts/createContact.js** — Create contact with auto list assignment by plan
- **contacts/updateContact.js** — Update contact attributes and list membership
- **contacts/deleteContact.js** — GDPR-safe contact deletion
- **contacts/tagContact.js** — Add, remove, or set tags on a contact
- **contacts/segmentContact.js** — Move contact between plan lists
- **contacts/bulkSync.js** — Batch sync contacts in chunks of 150
- **webhooks/verifySignature.js** — HMAC-SHA256 signature verification with timing-safe compare
- **webhooks/eventRouter.js** — Route Brevo events to typed callback handlers
- **webhooks/handlers/opened.js** — Email opened event handler
- **webhooks/handlers/clicked.js** — Link clicked event handler
- **webhooks/handlers/bounced.js** — Hard and soft bounce handler
- **webhooks/handlers/spam.js** — Spam complaint handler
- **webhooks/handlers/unsubscribed.js** — Unsubscribe event handler

---

### Phase 2 — Automation Workflows

- **workflows/workflowRunner.js** — Workflow engine with inline (setTimeout) and plan (schedule return) modes
- **workflows/onboarding.js** — 5-step onboarding drip: Day 0, 1, 3, 7, 14
- **workflows/trialExpiry.js** — Trial expiry reminders: 7d, 3d, 1d before, and expired
- **workflows/reEngagement.js** — 3-step re-engagement sequence for inactive users
- **workflows/featureAnnouncement.js** — Broadcast feature announcement to a list of recipients
- **workflows/upsell.js** — 2-step upsell nudge for free plan users
- **templates/welcome.html** — Welcome email Brevo template
- **templates/otp.html** — OTP verification Brevo template
- **templates/invoice.html** — Invoice/receipt Brevo template
- **templates/reset-password.html** — Password reset Brevo template
- **templates/reengagement.html** — Re-engagement campaign Brevo template
- **templates/trial-expiry.html** — Trial expiry reminder Brevo template

---

### Phase 3 — Framework Integrations

- **integrations/nextjs/actions/index.js** — 17 Next.js server actions wrapping all core functions (`'use server'`)
- **integrations/nextjs/webhook/route.js** — `createNextjsWebhookHandler` for App Router with raw-body HMAC verification
- **integrations/express/brevoMiddleware.js** — Express middleware that attaches all helpers to `req.brevo`
- **integrations/express/webhookRouter.js** — `createExpressWebhookRouter` handler (requires `express.raw()`)

---

### Phase 4 — Advanced Features

- **queue/emailQueue.js** — Dual-mode queue: immediate sends by default, BullMQ async queue via `initQueue()`
- **queue/retryStrategy.js** — `withRetry()` with 1s → 5s → 30s exponential backoff; `buildQueueRetryOptions()` for BullMQ
- **queue/queueMonitor.js** — `getQueueHealth()` and `pingQueue()`: live BullMQ stats or simple-mode zero counts
- **analytics/campaignStats.js** — `getCampaignStats()`: sent, opened, clicked, bounced, openRate, clickRate
- **analytics/contactEngagement.js** — `getContactEngagement()`: score 0–100, rating, lastOpened, totalClicks
- **analytics/exportStats.js** — `exportStats()`: export campaign and contact stats as JSON or CSV
- **security/rateLimiter.js** — `createRateLimiter()`: in-memory sliding window, zero dependencies, Express-compatible
- **security/inputSanitizer.js** — `sanitizeSubject`, `sanitizeName`, `sanitizeHtml`, `sanitizeEmailOptions`: XSS-strip with no deps
- **security/apiKeyValidator.js** — `validateApiKey()`: validates against Brevo `/account` endpoint, returns plan info
- **gdpr/rightToErasure.js** — `eraseContact()`: delete contact from Brevo with ISO timestamp confirmation
- **gdpr/consentLogger.js** — `logConsent()`: HMAC-SHA256 signed consent records; `verifyConsentSignature()` for integrity checks
- **gdpr/unsubscribeHandler.js** — `unsubscribeContact()`: removes from all lists and sets `emailBlacklisted: true`
