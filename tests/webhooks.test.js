import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'crypto';
import { verifyWebhookSignature, verifyWebhookSignatureFromEnv } from '../src/webhooks/verifySignature.js';
import { routeWebhookEvent } from '../src/webhooks/eventRouter.js';
import { handleOpened } from '../src/webhooks/handlers/opened.js';
import { handleClicked } from '../src/webhooks/handlers/clicked.js';
import { handleBounced } from '../src/webhooks/handlers/bounced.js';
import { handleSpam } from '../src/webhooks/handlers/spam.js';
import { handleUnsubscribed } from '../src/webhooks/handlers/unsubscribed.js';

const TEST_SECRET = 'test-webhook-secret-32-chars-long';

function sign(body, secret = TEST_SECRET) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

// ─── verifyWebhookSignature ──────────────────────────────────────────────────

describe('verifyWebhookSignature', () => {
  it('returns success for valid signature', () => {
    const body = JSON.stringify({ event: 'opened', email: 'u@e.com' });
    const sig = sign(body);
    const result = verifyWebhookSignature({ rawBody: body, signature: sig, secret: TEST_SECRET });
    expect(result.success).toBe(true);
  });

  it('returns failure for wrong signature', () => {
    const body = JSON.stringify({ event: 'opened', email: 'u@e.com' });
    const result = verifyWebhookSignature({ rawBody: body, signature: 'deadbeef'.repeat(8), secret: TEST_SECRET });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('signature');
  });

  it('returns failure for tampered body', () => {
    const body = JSON.stringify({ event: 'opened', email: 'u@e.com' });
    const sig = sign(body);
    const tampered = JSON.stringify({ event: 'opened', email: 'attacker@evil.com' });
    const result = verifyWebhookSignature({ rawBody: tampered, signature: sig, secret: TEST_SECRET });
    expect(result.success).toBe(false);
  });

  it('accepts Buffer as rawBody', () => {
    const body = Buffer.from(JSON.stringify({ event: 'opened', email: 'u@e.com' }));
    const sig = sign(body.toString('utf8'));
    const result = verifyWebhookSignature({ rawBody: body, signature: sig, secret: TEST_SECRET });
    expect(result.success).toBe(true);
  });

  it('returns failure when secret is missing', () => {
    const result = verifyWebhookSignature({ rawBody: '{}', signature: 'abc', secret: '' });
    expect(result.success).toBe(false);
  });
});

describe('verifyWebhookSignatureFromEnv', () => {
  it('returns failure when BREVO_WEBHOOK_SECRET is not set', () => {
    const orig = process.env.BREVO_WEBHOOK_SECRET;
    delete process.env.BREVO_WEBHOOK_SECRET;
    const result = verifyWebhookSignatureFromEnv({ rawBody: '{}', signature: 'abc' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('BREVO_WEBHOOK_SECRET');
    if (orig) process.env.BREVO_WEBHOOK_SECRET = orig;
  });

  it('uses BREVO_WEBHOOK_SECRET from env', () => {
    process.env.BREVO_WEBHOOK_SECRET = TEST_SECRET;
    const body = '{"event":"opened"}';
    const sig = sign(body);
    const result = verifyWebhookSignatureFromEnv({ rawBody: body, signature: sig });
    expect(result.success).toBe(true);
    delete process.env.BREVO_WEBHOOK_SECRET;
  });
});

// ─── handlers ────────────────────────────────────────────────────────────────

describe('handleOpened', () => {
  const base = { event: 'opened', email: 'u@e.com', messageId: '<msg@brevo>', subject: 'Hi' };

  it('returns success with correct type', () => {
    const result = handleOpened(base);
    expect(result.success).toBe(true);
    expect(result.data.type).toBe('opened');
    expect(result.data.email).toBe('u@e.com');
  });

  it('returns failure on missing email', () => {
    const result = handleOpened({ event: 'opened' });
    expect(result.success).toBe(false);
  });
});

describe('handleClicked', () => {
  it('returns success with link and type', () => {
    const result = handleClicked({ event: 'clicked', email: 'u@e.com', link: 'https://app.com' });
    expect(result.success).toBe(true);
    expect(result.data.type).toBe('clicked');
    expect(result.data.link).toBe('https://app.com');
  });

  it('returns failure on invalid email', () => {
    const result = handleClicked({ event: 'clicked', email: 'bad', link: 'https://app.com' });
    expect(result.success).toBe(false);
  });
});

describe('handleBounced', () => {
  it('marks hard_bounce correctly', () => {
    const result = handleBounced({ event: 'hard_bounce', email: 'u@e.com', reason: 'Invalid address' });
    expect(result.success).toBe(true);
    expect(result.data.isHardBounce).toBe(true);
    expect(result.data.type).toBe('hard_bounce');
    expect(result.data.reason).toBe('Invalid address');
  });

  it('marks soft_bounce correctly', () => {
    const result = handleBounced({ event: 'soft_bounce', email: 'u@e.com' });
    expect(result.success).toBe(true);
    expect(result.data.isHardBounce).toBe(false);
    expect(result.data.type).toBe('soft_bounce');
  });
});

describe('handleSpam', () => {
  it('returns success with correct type', () => {
    const result = handleSpam({ event: 'spam', email: 'u@e.com' });
    expect(result.success).toBe(true);
    expect(result.data.type).toBe('spam');
    expect(result.data.email).toBe('u@e.com');
  });
});

describe('handleUnsubscribed', () => {
  it('returns success with correct type', () => {
    const result = handleUnsubscribed({ event: 'unsubscribed', email: 'u@e.com' });
    expect(result.success).toBe(true);
    expect(result.data.type).toBe('unsubscribed');
    expect(result.data.email).toBe('u@e.com');
  });
});

// ─── routeWebhookEvent ────────────────────────────────────────────────────────

describe('routeWebhookEvent', () => {
  it('routes opened event and calls onOpened callback', async () => {
    const onOpened = vi.fn();
    const payload = { event: 'opened', email: 'u@e.com', messageId: '<m@b>' };
    const result = await routeWebhookEvent(payload, { onOpened });
    expect(result.success).toBe(true);
    expect(result.data.type).toBe('opened');
    expect(onOpened).toHaveBeenCalledOnce();
    expect(onOpened).toHaveBeenCalledWith(expect.objectContaining({ email: 'u@e.com' }));
  });

  it('routes clicked event and calls onClicked callback', async () => {
    const onClicked = vi.fn();
    await routeWebhookEvent({ event: 'clicked', email: 'u@e.com', link: 'https://app.com' }, { onClicked });
    expect(onClicked).toHaveBeenCalledOnce();
  });

  it('routes hard_bounce and calls onBounced callback', async () => {
    const onBounced = vi.fn();
    await routeWebhookEvent({ event: 'hard_bounce', email: 'u@e.com' }, { onBounced });
    expect(onBounced).toHaveBeenCalledOnce();
    expect(onBounced.mock.calls[0][0].isHardBounce).toBe(true);
  });

  it('routes soft_bounce to onBounced callback', async () => {
    const onBounced = vi.fn();
    await routeWebhookEvent({ event: 'soft_bounce', email: 'u@e.com' }, { onBounced });
    expect(onBounced).toHaveBeenCalledOnce();
    expect(onBounced.mock.calls[0][0].isHardBounce).toBe(false);
  });

  it('routes spam and calls onSpamComplaint callback', async () => {
    const onSpamComplaint = vi.fn();
    await routeWebhookEvent({ event: 'spam', email: 'u@e.com' }, { onSpamComplaint });
    expect(onSpamComplaint).toHaveBeenCalledOnce();
  });

  it('routes unsubscribed and calls onUnsubscribed callback', async () => {
    const onUnsubscribed = vi.fn();
    await routeWebhookEvent({ event: 'unsubscribed', email: 'u@e.com' }, { onUnsubscribed });
    expect(onUnsubscribed).toHaveBeenCalledOnce();
  });

  it('calls onUnhandled for unknown events', async () => {
    const onUnhandled = vi.fn();
    const result = await routeWebhookEvent({ event: 'delivered', email: 'u@e.com' }, { onUnhandled });
    expect(result.success).toBe(true);
    expect(result.data.type).toBe('unhandled');
    expect(onUnhandled).toHaveBeenCalledOnce();
  });

  it('works without any callbacks (no throw)', async () => {
    const result = await routeWebhookEvent({ event: 'opened', email: 'u@e.com' });
    expect(result.success).toBe(true);
  });

  it('returns failure when payload is missing email', async () => {
    const result = await routeWebhookEvent({ event: 'opened' });
    expect(result.success).toBe(false);
  });

  it('returns failure when callback throws', async () => {
    const onOpened = vi.fn().mockRejectedValue(new Error('DB error'));
    const result = await routeWebhookEvent({ event: 'opened', email: 'u@e.com' }, { onOpened });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('DB error');
  });
});
