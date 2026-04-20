# TESTING.md — brevo-saas-automation

Complete test documentation, curl examples, and setup guide.

---

## Running Tests

```bash
# Install dependencies first
npm install

# Run all tests once
npm test

# Watch mode (re-runs on file save)
npm run test:watch
```

**Expected output (Phase 1):**
```
✓ tests/config.test.js        (17 tests)
✓ tests/transactional.test.js (23 tests)
✓ tests/contacts.test.js      (24 tests)
✓ tests/webhooks.test.js      (25 tests)
↓ tests/workflows.test.js     (3 todo)

Tests  89 passed | 3 todo (92)
```

---

## Test Coverage by Module

### `tests/config.test.js`

| Test | What it covers |
|------|----------------|
| `validateEnv` — valid env | Accepts all required vars |
| `validateEnv` — coerces list IDs | `BREVO_LIST_FREE=5` becomes number `5` |
| `validateEnv` — missing key | Returns `{ success: false }` with field name |
| `validateEnv` — bad email | Rejects invalid `BREVO_SENDER_EMAIL` |
| `validateEnv` — optional fields | Missing webhook secret / redis URL are OK |
| `requireEnv` — valid | Returns parsed data, no throw |
| `requireEnv` — invalid | Throws with `[brevo-saas-automation]` prefix |
| `initBrevo` — valid config | Returns `{ success: true }` |
| `initBrevo` — empty apiKey | Returns `{ success: false }` |
| `initBrevo` — missing sender | Returns `{ success: false }` |
| `getTransactionalApi` | Returns configured API after `initBrevo` |
| `getTransactionalApi` — no init | Throws when env vars are also missing |
| `getSenderConfig` | Returns sender after `initBrevo` |
| `WEBHOOK_EVENTS` | Contains all expected event names |
| `CONTACT_PLANS` | Contains free/pro/enterprise |
| `LIST_ENV_KEYS` | Maps plans to correct env var names |
| `EMAIL_DEFAULTS` | Has sensible OTP and reset expiry values |

### `tests/transactional.test.js`

| Test | What it covers |
|------|----------------|
| `sendEmail` — success | Returns `{ success: true, data: { messageId } }` |
| `sendEmail` — array recipients | Accepts `[{ email, name }]` format |
| `sendEmail` — missing subject | Returns validation failure |
| `sendEmail` — invalid email | Returns validation failure |
| `sendEmail` — API throws | Extracts Brevo error message |
| `sendEmail` — optional fields | Passes replyTo, tags through to Brevo |
| `sendTemplateEmail` — success | Sends with templateId correctly |
| `sendTemplateEmail` — bad templateId | Rejects negative integer |
| `sendTemplateEmail` — missing to | Returns failure |
| `sendWelcomeEmail` — minimal | Works with just email + name |
| `sendWelcomeEmail` — with dashboard URL | HTML contains the URL |
| `sendWelcomeEmail` — invalid email | Returns validation failure |
| `sendVerificationEmail` — success | HTML contains OTP code |
| `sendVerificationEmail` — custom expiry | HTML contains custom minutes |
| `sendVerificationEmail` — missing otp | Returns failure |
| `sendPasswordResetEmail` — success | HTML contains reset URL |
| `sendPasswordResetEmail` — bad URL | Returns validation failure |
| `sendInvoiceEmail` — success | HTML contains invoice number and items |
| `sendInvoiceEmail` — empty items | Returns validation failure |
| `sendAccountDeletionEmail` — success | HTML contains "permanently deleted" |
| `sendAccountDeletionEmail` — feedback URL | HTML contains feedback link |
| `sendRoleChangeEmail` — success | HTML contains old and new roles |
| `sendRoleChangeEmail` — missing role | Returns validation failure |

### `tests/contacts.test.js`

| Test | What it covers |
|------|----------------|
| `createContact` — success | Returns contact id from Brevo |
| `createContact` — name split | Splits "First Last" into FIRSTNAME/LASTNAME |
| `createContact` — plan env var | Reads `BREVO_LIST_PRO` from env |
| `createContact` — listId override | Explicit listId wins over env var |
| `createContact` — invalid email | Returns validation failure |
| `createContact` — API throws | Extracts Brevo error message |
| `updateContact` — attributes | Calls Brevo with correct attributes |
| `updateContact` — blacklist | Sets `emailBlacklisted` on Brevo contact |
| `updateContact` — invalid email | Returns validation failure |
| `deleteContact` — success | Calls `deleteContact(email)` on Brevo |
| `deleteContact` — invalid email | Returns validation failure |
| `deleteContact` — API throws | Returns error with message |
| `tagContact` — add | Merges new tags with existing |
| `tagContact` — remove | Removes specific tag, keeps others |
| `tagContact` — set | Replaces all tags |
| `tagContact` — deduplicates | No duplicate tags on add |
| `tagContact` — empty array | Returns validation failure |
| `segmentContact` — listId option | Uses provided listId |
| `segmentContact` — env var | Reads `BREVO_LIST_ENTERPRISE` from env |
| `segmentContact` — missing env | Returns descriptive error with env var name |
| `segmentContact` — removeFromOtherPlans | Unlinks other plan lists |
| `bulkSyncContacts` — success | Reports synced count |
| `bulkSyncContacts` — empty | Returns validation failure |
| `bulkSyncContacts` — partial batch fail | Reports errors array |

### `tests/webhooks.test.js`

| Test | What it covers |
|------|----------------|
| `verifyWebhookSignature` — valid | Returns `{ success: true }` |
| `verifyWebhookSignature` — wrong sig | Returns failure with "signature" in error |
| `verifyWebhookSignature` — tampered body | Rejects modified body |
| `verifyWebhookSignature` — Buffer body | Works with raw Buffer |
| `verifyWebhookSignature` — empty secret | Returns validation failure |
| `verifyWebhookSignatureFromEnv` — no env | Returns error mentioning `BREVO_WEBHOOK_SECRET` |
| `verifyWebhookSignatureFromEnv` — from env | Uses env var for verification |
| `handleOpened` — success | Returns `{ type: 'opened', email }` |
| `handleOpened` — missing email | Returns failure |
| `handleClicked` — success | Returns `{ type: 'clicked', link }` |
| `handleClicked` — bad email | Returns failure |
| `handleBounced` — hard_bounce | Sets `isHardBounce: true`, type `hard_bounce` |
| `handleBounced` — soft_bounce | Sets `isHardBounce: false`, type `soft_bounce` |
| `handleSpam` — success | Returns `{ type: 'spam', email }` |
| `handleUnsubscribed` — success | Returns `{ type: 'unsubscribed', email }` |
| `routeWebhookEvent` — opened | Calls `onOpened` callback with data |
| `routeWebhookEvent` — clicked | Calls `onClicked` callback |
| `routeWebhookEvent` — hard_bounce | Calls `onBounced`, passes `isHardBounce: true` |
| `routeWebhookEvent` — soft_bounce | Calls `onBounced`, passes `isHardBounce: false` |
| `routeWebhookEvent` — spam | Calls `onSpamComplaint` callback |
| `routeWebhookEvent` — unsubscribed | Calls `onUnsubscribed` callback |
| `routeWebhookEvent` — unhandled event | Calls `onUnhandled`, returns `type: 'unhandled'` |
| `routeWebhookEvent` — no callbacks | Does not throw |
| `routeWebhookEvent` — missing email | Returns failure |
| `routeWebhookEvent` — callback throws | Returns `{ success: false }` with error message |

---

## Environment Setup for Testing

Tests use mocked Brevo SDK — no API key needed to run the test suite.

For manual / integration testing with a real Brevo account:

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
BREVO_API_KEY=xkeysib-your-real-api-key
BREVO_SENDER_EMAIL=test@yourdomain.com
BREVO_SENDER_NAME=TestApp
BREVO_WEBHOOK_SECRET=your-32-char-secret-here
BREVO_LIST_FREE=1
BREVO_LIST_PRO=2
BREVO_LIST_ENTERPRISE=3
```

Get your API key from [Brevo Dashboard → API Keys](https://app.brevo.com/settings/keys/api).

---

## Testing Webhook Events Manually with curl

Use these curl commands to simulate Brevo webhook POST requests to your local server.

### Setup

First, compute a valid HMAC-SHA256 signature for your test payload:

```bash
# Set your webhook secret
SECRET="your-webhook-secret"
BODY='{"event":"opened","email":"test@example.com","messageId":"<msg123@brevo.com>","date":"2026-04-20T09:00:00Z","subject":"Welcome!"}'

# Compute HMAC-SHA256 signature
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
echo "Signature: $SIG"
```

---

### Simulate: Email Opened

```bash
BODY='{"event":"opened","email":"test@example.com","messageId":"<msg123@brevo.com>","date":"2026-04-20T09:00:00Z","subject":"Welcome!"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "your-webhook-secret" | awk '{print $2}')

curl -X POST http://localhost:3000/api/brevo/webhook \
  -H "Content-Type: application/json" \
  -H "x-brevo-signature: $SIG" \
  -d "$BODY"
```

---

### Simulate: Link Clicked

```bash
BODY='{"event":"clicked","email":"test@example.com","link":"https://yourapp.com/dashboard","messageId":"<msg123@brevo.com>"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "your-webhook-secret" | awk '{print $2}')

curl -X POST http://localhost:3000/api/brevo/webhook \
  -H "Content-Type: application/json" \
  -H "x-brevo-signature: $SIG" \
  -d "$BODY"
```

---

### Simulate: Hard Bounce

```bash
BODY='{"event":"hard_bounce","email":"bounced@example.com","reason":"Invalid email address","messageId":"<msg456@brevo.com>"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "your-webhook-secret" | awk '{print $2}')

curl -X POST http://localhost:3000/api/brevo/webhook \
  -H "Content-Type: application/json" \
  -H "x-brevo-signature: $SIG" \
  -d "$BODY"
```

---

### Simulate: Soft Bounce

```bash
BODY='{"event":"soft_bounce","email":"user@example.com","reason":"Mailbox full"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "your-webhook-secret" | awk '{print $2}')

curl -X POST http://localhost:3000/api/brevo/webhook \
  -H "Content-Type: application/json" \
  -H "x-brevo-signature: $SIG" \
  -d "$BODY"
```

---

### Simulate: Spam Complaint

```bash
BODY='{"event":"spam","email":"user@example.com","messageId":"<msg789@brevo.com>","subject":"Our Newsletter"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "your-webhook-secret" | awk '{print $2}')

curl -X POST http://localhost:3000/api/brevo/webhook \
  -H "Content-Type: application/json" \
  -H "x-brevo-signature: $SIG" \
  -d "$BODY"
```

---

### Simulate: Unsubscribe

```bash
BODY='{"event":"unsubscribed","email":"user@example.com","messageId":"<msg789@brevo.com>"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "your-webhook-secret" | awk '{print $2}')

curl -X POST http://localhost:3000/api/brevo/webhook \
  -H "Content-Type: application/json" \
  -H "x-brevo-signature: $SIG" \
  -d "$BODY"
```

---

### Simulate: Invalid Signature (should return 401)

```bash
curl -X POST http://localhost:3000/api/brevo/webhook \
  -H "Content-Type: application/json" \
  -H "x-brevo-signature: deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" \
  -d '{"event":"opened","email":"test@example.com"}'
```

---

## Testing with a Real Brevo Sandbox API Key

Brevo does not provide a sandbox environment, but you can test safely by:

1. **Create a free Brevo account** at [brevo.com](https://www.brevo.com)
2. **Use a verified sender email** (your own email address)
3. **Create test contact lists** in Brevo dashboard (Contacts → Lists → New List)
4. **Set list IDs** in your `.env` file
5. **Run integration tests** against the real API with a script like:

```js
// scripts/integration-test.js
import { initBrevo, sendWelcomeEmail, createContact } from './index.js';
import 'dotenv/config';

initBrevo({
  apiKey: process.env.BREVO_API_KEY,
  sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
});

// Test welcome email
const emailResult = await sendWelcomeEmail({
  email: 'your-real-email@example.com',
  name: 'Test User',
  dashboardUrl: 'https://example.com/dashboard',
  appName: 'TestApp',
});
console.log('sendWelcomeEmail:', emailResult);

// Test create contact
const contactResult = await createContact({
  email: 'test-contact@example.com',
  name: 'Test Contact',
  plan: 'free',
});
console.log('createContact:', contactResult);
```

```bash
node scripts/integration-test.js
```

---

## Brevo Webhook Setup

To receive real webhook events from Brevo:

1. Go to **Brevo Dashboard → Transactional → Settings → Webhook**
2. Click **Add a Webhook**
3. Set your URL (must be HTTPS and publicly reachable): `https://yourdomain.com/api/brevo/webhook`
4. Select events: `opened`, `clicked`, `hard_bounce`, `soft_bounce`, `spam`, `unsubscribe`
5. Copy the webhook secret to `BREVO_WEBHOOK_SECRET` in your `.env`

For local development, use [ngrok](https://ngrok.com) to expose your local server:
```bash
ngrok http 3000
# Use the https URL as your Brevo webhook endpoint
```
