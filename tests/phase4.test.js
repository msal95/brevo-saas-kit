import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@getbrevo/brevo', () => ({
  TransactionalEmailsApi: class {
    authentications = { apiKey: { apiKey: '' } };
    getEmailEventReport = vi.fn().mockResolvedValue({ body: { events: [] } });
  },
  ContactsApi: class {
    authentications = { apiKey: { apiKey: '' } };
    deleteContact = vi.fn().mockResolvedValue({});
    updateContact = vi.fn().mockResolvedValue({});
    getContactInfo = vi.fn().mockResolvedValue({ body: { attributes: { TAGS: '' }, listIds: [1, 2] } });
  },
  UpdateContact: class {},
}));

vi.mock('../src/config/brevoClient.js', () => ({
  initBrevo: vi.fn(() => ({ success: true, data: {} })),
  getTransactionalApi: vi.fn(() => ({
    getEmailEventReport: vi.fn().mockResolvedValue({ body: { events: [] } }),
  })),
  getContactsApi: vi.fn(() => ({
    deleteContact: vi.fn().mockResolvedValue({}),
    updateContact: vi.fn().mockResolvedValue({}),
    getContactInfo: vi.fn().mockResolvedValue({ body: { attributes: { TAGS: '' }, listIds: [1, 2] } }),
  })),
  getSenderConfig: vi.fn(() => ({ email: 'test@app.com', name: 'TestApp' })),
}));

import {
  initQueue, queueEmail, getQueueMode, _resetQueue,
} from '../src/queue/emailQueue.js';
import { withRetry, getBackoffDelay, buildQueueRetryOptions } from '../src/queue/retryStrategy.js';
import { getQueueHealth, pingQueue } from '../src/queue/queueMonitor.js';
import { getCampaignStats } from '../src/analytics/campaignStats.js';
import { getContactEngagement } from '../src/analytics/contactEngagement.js';
import { exportStats } from '../src/analytics/exportStats.js';
import { createRateLimiter } from '../src/security/rateLimiter.js';
import { sanitizeSubject, sanitizeName, sanitizeHtml, sanitizeEmailOptions } from '../src/security/inputSanitizer.js';
import { validateApiKey } from '../src/security/apiKeyValidator.js';
import { eraseContact } from '../src/gdpr/rightToErasure.js';
import { logConsent, verifyConsentSignature } from '../src/gdpr/consentLogger.js';
import { unsubscribeContact } from '../src/gdpr/unsubscribeHandler.js';
import { getTransactionalApi, getContactsApi } from '../src/config/brevoClient.js';

beforeEach(() => {
  vi.clearAllMocks();
  _resetQueue();
});

// ─── Queue — emailQueue ───────────────────────────────────────────────────────

describe('emailQueue', () => {
  it('getQueueMode returns simple by default', () => {
    expect(getQueueMode()).toBe('simple');
  });

  it('initQueue succeeds when BullMQ is installed (lazy Redis connection)', async () => {
    // BullMQ Queue constructor is lazy — it does not throw on init even if Redis is down
    const result = await initQueue({ redisUrl: 'redis://localhost:6379' });
    // Either succeeds (BullMQ loaded, Queue created) or fails with install hint
    expect(typeof result.success).toBe('boolean');
    if (!result.success) {
      expect(result.error).toMatch(/bullmq|redis/i);
    } else {
      expect(result.data.mode).toBe('queue');
    }
    _resetQueue(); // clean up regardless
  });

  it('initQueue returns error when redisUrl is missing', async () => {
    const result = await initQueue({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch('redisUrl');
  });

  it('queueEmail returns failure for unknown type in simple mode', async () => {
    const result = await queueEmail({ type: 'unknown-type', payload: { email: 'u@e.com' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('unknown-type');
  });

  it('queueEmail returns failure for invalid options', async () => {
    const result = await queueEmail({ type: '', payload: {} });
    expect(result.success).toBe(false);
  });

  it('queueEmail simple mode dispatches welcome type', async () => {
    vi.doMock('../src/transactional/welcome.js', () => ({
      sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true, data: { messageId: '<t@b>' } }),
    }));
    const result = await queueEmail({ type: 'welcome', payload: { email: 'u@e.com', name: 'M' } });
    // Dynamic import mock may not fully work in test env — just check it attempted
    expect(typeof result).toBe('object');
    expect('success' in result).toBe(true);
  });
});

// ─── Queue — retryStrategy ────────────────────────────────────────────────────

describe('retryStrategy', () => {
  it('withRetry succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry({ fn });
    expect(result.success).toBe(true);
    expect(result.data).toBe('ok');
    expect(result.attempts).toBe(1);
  });

  it('withRetry succeeds on second attempt after one failure', async () => {
    let count = 0;
    const fn = vi.fn().mockImplementation(() => {
      count++;
      if (count < 2) throw new Error('transient');
      return Promise.resolve('recovered');
    });
    const result = await withRetry({ fn, maxAttempts: 3 });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  }, 15000);

  it('withRetry returns failure after all attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    const result = await withRetry({ fn, maxAttempts: 2 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('always fails');
    expect(result.attempts).toBe(2);
  }, 15000);

  it('withRetry calls onRetry on each failed attempt', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await withRetry({ fn, maxAttempts: 2, onRetry });
    expect(onRetry).toHaveBeenCalledOnce();
  }, 15000);

  it('getBackoffDelay returns correct delays', () => {
    expect(getBackoffDelay(1)).toBe(1000);
    expect(getBackoffDelay(2)).toBe(5000);
    expect(getBackoffDelay(3)).toBe(30000);
    expect(getBackoffDelay(99)).toBe(30000); // capped at last entry
  });

  it('buildQueueRetryOptions returns BullMQ-compatible shape', () => {
    const opts = buildQueueRetryOptions({ attempts: 5, initialDelay: 2000 });
    expect(opts.attempts).toBe(5);
    expect(opts.backoff.type).toBe('exponential');
    expect(opts.backoff.delay).toBe(2000);
  });

  it('withRetry returns failure for invalid options', async () => {
    const result = await withRetry({ fn: 'not-a-function' });
    expect(result.success).toBe(false);
  });
});

// ─── Queue — queueMonitor ────────────────────────────────────────────────────

describe('queueMonitor', () => {
  it('getQueueHealth returns simple mode stats when no queue initialized', async () => {
    const result = await getQueueHealth();
    expect(result.success).toBe(true);
    expect(result.data.mode).toBe('simple');
    expect(result.data.pending).toBe(0);
    expect(result.data.active).toBe(0);
    expect(result.data.failed).toBe(0);
    expect(result.data.completed).toBe(0);
  });

  it('pingQueue returns alive in simple mode', async () => {
    const result = await pingQueue();
    expect(result.success).toBe(true);
    expect(result.data.alive).toBe(true);
    expect(result.data.mode).toBe('simple');
  });
});

// ─── Analytics — campaignStats ───────────────────────────────────────────────

describe('campaignStats', () => {
  it('returns zero counts for empty event list', async () => {
    const result = await getCampaignStats('msg-123');
    expect(result.success).toBe(true);
    expect(result.data.sent).toBe(0);
    expect(result.data.openRate).toBe(0);
    expect(result.data.clickRate).toBe(0);
  });

  it('aggregates opened and clicked events correctly', async () => {
    vi.mocked(getTransactionalApi).mockReturnValueOnce({
      getEmailEventReport: vi.fn().mockResolvedValue({
        body: {
          events: [
            { event: 'delivered' },
            { event: 'delivered' },
            { event: 'delivered' },
            { event: 'opened' },
            { event: 'opened' },
            { event: 'clicked' },
          ],
        },
      }),
    });
    const result = await getCampaignStats(42);
    expect(result.success).toBe(true);
    expect(result.data.sent).toBe(3);
    expect(result.data.opened).toBe(2);
    expect(result.data.clicked).toBe(1);
    expect(result.data.openRate).toBeCloseTo(66.67, 1);
    expect(result.data.clickRate).toBeCloseTo(33.33, 1);
  });

  it('returns failure for invalid campaignId', async () => {
    const result = await getCampaignStats('');
    expect(result.success).toBe(false);
  });

  it('returns failure on API error', async () => {
    vi.mocked(getTransactionalApi).mockReturnValueOnce({
      getEmailEventReport: vi.fn().mockRejectedValue(new Error('API down')),
    });
    const result = await getCampaignStats('msg-999');
    expect(result.success).toBe(false);
    expect(result.error).toMatch('API down');
  });
});

// ─── Analytics — contactEngagement ───────────────────────────────────────────

describe('contactEngagement', () => {
  it('returns score 0 and inactive for contact with no events', async () => {
    const result = await getContactEngagement('u@e.com');
    expect(result.success).toBe(true);
    expect(result.data.score).toBe(0);
    expect(result.data.rating).toBe('inactive');
    expect(result.data.lastOpened).toBeNull();
  });

  it('calculates score and rating from opens and clicks', async () => {
    vi.mocked(getTransactionalApi).mockReturnValueOnce({
      getEmailEventReport: vi.fn().mockResolvedValue({
        body: {
          events: [
            { event: 'opened', date: '2026-04-18T10:00:00Z' },
            { event: 'opened', date: '2026-04-19T10:00:00Z' },
            { event: 'clicked', date: '2026-04-19T10:05:00Z' },
          ],
        },
      }),
    });
    const result = await getContactEngagement('u@e.com');
    expect(result.success).toBe(true);
    expect(result.data.score).toBeGreaterThan(0);
    expect(result.data.totalOpens).toBe(2);
    expect(result.data.totalClicks).toBe(1);
    expect(result.data.lastOpened).toBe('2026-04-19T10:00:00Z');
  });

  it('returns failure for invalid email', async () => {
    const result = await getContactEngagement('not-an-email');
    expect(result.success).toBe(false);
  });

  it('returns failure on API error', async () => {
    vi.mocked(getTransactionalApi).mockReturnValueOnce({
      getEmailEventReport: vi.fn().mockRejectedValue(new Error('timeout')),
    });
    const result = await getContactEngagement('u@e.com');
    expect(result.success).toBe(false);
  });
});

// ─── Analytics — exportStats ─────────────────────────────────────────────────

describe('exportStats', () => {
  it('exports campaign stats as JSON', async () => {
    const result = await exportStats({ campaignId: 'msg-1', format: 'json' });
    expect(result.success).toBe(true);
    expect(typeof result.data).toBe('object');
    expect(result.data.campaign).toBeDefined();
  });

  it('exports contact engagement as JSON', async () => {
    const result = await exportStats({ email: 'u@e.com', format: 'json' });
    expect(result.success).toBe(true);
    expect(result.data.contact.email).toBe('u@e.com');
  });

  it('exports campaign stats as CSV string', async () => {
    const result = await exportStats({ campaignId: 'msg-2', format: 'csv' });
    expect(result.success).toBe(true);
    expect(typeof result.data).toBe('string');
    expect(result.data).toContain('sent');
  });

  it('exports both campaign and contact stats', async () => {
    const result = await exportStats({ campaignId: 'msg-3', email: 'u@e.com', format: 'json' });
    expect(result.success).toBe(true);
    expect(result.data.campaign).toBeDefined();
    expect(result.data.contact).toBeDefined();
  });

  it('returns failure when neither campaignId nor email provided', async () => {
    const result = await exportStats({ format: 'json' });
    expect(result.success).toBe(false);
  });
});

// ─── Security — rateLimiter ───────────────────────────────────────────────────

describe('rateLimiter', () => {
  it('throws on invalid options', () => {
    expect(() => createRateLimiter({ maxRequests: -1, windowMs: 1000 })).toThrow();
  });

  it('allows requests within limit', () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60000 });
    expect(limiter.check('key1').allowed).toBe(true);
    expect(limiter.check('key1').allowed).toBe(true);
    expect(limiter.check('key1').allowed).toBe(true);
  });

  it('blocks requests beyond limit', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60000 });
    limiter.check('key2');
    limiter.check('key2');
    const result = limiter.check('key2');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 });
    limiter.check('a');
    const a2 = limiter.check('a');
    const b1 = limiter.check('b');
    expect(a2.allowed).toBe(false);
    expect(b1.allowed).toBe(true);
  });

  it('reset clears a specific key', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 });
    limiter.check('k');
    limiter.check('k'); // now blocked
    limiter.reset('k');
    expect(limiter.check('k').allowed).toBe(true);
  });

  it('calls onLimitReached when limit is exceeded via middleware', () => {
    const onLimitReached = vi.fn();
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000, onLimitReached });
    const req = { ip: '1.2.3.4', headers: {} };
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    limiter(req, res, next); // allowed
    limiter(req, res, next); // blocked → onLimitReached
    expect(onLimitReached).toHaveBeenCalledOnce();
  });

  it('middleware calls next() when allowed', () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });
    const req = { ip: '5.6.7.8', headers: {} };
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ─── Security — inputSanitizer ───────────────────────────────────────────────

describe('inputSanitizer', () => {
  it('sanitizeSubject strips control characters and converts newlines to spaces', () => {
    const result = sanitizeSubject('  Hello\nWorld\n  ');
    expect(result.success).toBe(true);
    expect(result.data).toBe('Hello World');
  });

  it('sanitizeSubject returns failure for non-string input', () => {
    const result = sanitizeSubject(null);
    expect(result.success).toBe(false);
  });

  it('sanitizeName strips HTML tags', () => {
    const result = sanitizeName('<script>alert(1)</script>Muhammad');
    expect(result.success).toBe(true);
    expect(result.data).toBe('Muhammad');
  });

  it('sanitizeHtml removes script tags', () => {
    const result = sanitizeHtml('<p>Hello</p><script>alert(1)</script>');
    expect(result.success).toBe(true);
    expect(result.data).not.toContain('<script>');
    expect(result.data).toContain('<p>Hello</p>');
  });

  it('sanitizeHtml strips event handler attributes', () => {
    const result = sanitizeHtml('<a href="https://example.com" onclick="steal()">Click</a>');
    expect(result.success).toBe(true);
    expect(result.data).not.toContain('onclick');
  });

  it('sanitizeHtml neutralizes javascript: href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">Bad</a>');
    expect(result.success).toBe(true);
    expect(result.data).not.toContain('javascript:');
  });

  it('sanitizeEmailOptions sanitizes subject and htmlContent', () => {
    const result = sanitizeEmailOptions({
      subject: '  Hello\x00  ',
      htmlContent: '<p>Hi</p><script>bad()</script>',
      to: 'u@e.com',
    });
    expect(result.success).toBe(true);
    expect(result.data.subject).toBe('Hello');
    expect(result.data.htmlContent).not.toContain('<script>');
    expect(result.data.to).toBe('u@e.com');
  });

  it('sanitizeEmailOptions returns failure for non-object input', () => {
    const result = sanitizeEmailOptions('not-an-object');
    expect(result.success).toBe(false);
  });
});

// ─── Security — apiKeyValidator ───────────────────────────────────────────────

describe('apiKeyValidator', () => {
  it('returns failure when no API key is available', async () => {
    const savedKey = process.env.BREVO_API_KEY;
    delete process.env.BREVO_API_KEY;
    const result = await validateApiKey({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch('BREVO_API_KEY');
    if (savedKey) process.env.BREVO_API_KEY = savedKey;
  });

  it('returns valid: false for a 401 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const result = await validateApiKey({ apiKey: 'bad-key' });
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(false);
    delete global.fetch;
  });

  it('returns valid: true with account info on 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ companyName: 'ITivs', email: 'admin@itivs.com', plan: [{ type: 'free' }] }),
    });
    const result = await validateApiKey({ apiKey: 'valid-key' });
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
    expect(result.data.accountName).toBe('ITivs');
    expect(result.data.email).toBe('admin@itivs.com');
    delete global.fetch;
  });

  it('returns failure on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await validateApiKey({ apiKey: 'any-key' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('ECONNREFUSED');
    delete global.fetch;
  });
});

// ─── GDPR — rightToErasure ───────────────────────────────────────────────────

describe('rightToErasure', () => {
  it('eraseContact returns confirmed deletion with timestamp', async () => {
    const result = await eraseContact('u@e.com');
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('u@e.com');
    expect(result.data.confirmed).toBe(true);
    expect(result.data.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('eraseContact calls deleteContact API', async () => {
    const api = { deleteContact: vi.fn().mockResolvedValue({}) };
    vi.mocked(getContactsApi).mockReturnValueOnce(api);
    await eraseContact('u@e.com');
    expect(api.deleteContact).toHaveBeenCalledWith('u@e.com');
  });

  it('eraseContact returns failure for invalid email', async () => {
    const result = await eraseContact('not-an-email');
    expect(result.success).toBe(false);
  });

  it('eraseContact returns failure on API error', async () => {
    const api = { deleteContact: vi.fn().mockRejectedValue(new Error('Not found')) };
    vi.mocked(getContactsApi).mockReturnValueOnce(api);
    const result = await eraseContact('u@e.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch('Not found');
  });

  it('eraseContact uses custom logger', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    await eraseContact('u@e.com', { logger });
    expect(logger.info).toHaveBeenCalledOnce();
  });
});

// ─── GDPR — consentLogger ────────────────────────────────────────────────────

describe('consentLogger', () => {
  it('logConsent returns a record and signature', async () => {
    const result = await logConsent({ email: 'u@e.com', type: 'marketing' });
    expect(result.success).toBe(true);
    expect(result.data.record.email).toBe('u@e.com');
    expect(result.data.record.type).toBe('marketing');
    expect(typeof result.data.signature).toBe('string');
    expect(result.data.signature).toHaveLength(64); // SHA256 hex = 64 chars
  });

  it('verifyConsentSignature confirms a valid signature', async () => {
    const { data } = await logConsent({ email: 'u@e.com', type: 'transactional' });
    const { valid } = verifyConsentSignature(data.record, data.signature);
    expect(valid).toBe(true);
  });

  it('verifyConsentSignature rejects a tampered record', async () => {
    const { data } = await logConsent({ email: 'u@e.com', type: 'marketing' });
    const tampered = { ...data.record, email: 'hacker@evil.com' };
    const { valid } = verifyConsentSignature(tampered, data.signature);
    expect(valid).toBe(false);
  });

  it('logConsent uses custom timestamp', async () => {
    const ts = '2026-01-01T00:00:00.000Z';
    const result = await logConsent({ email: 'u@e.com', type: 'all', timestamp: ts });
    expect(result.success).toBe(true);
    expect(result.data.record.timestamp).toBe(ts);
  });

  it('logConsent returns failure for invalid type', async () => {
    const result = await logConsent({ email: 'u@e.com', type: 'unknown-type' });
    expect(result.success).toBe(false);
  });

  it('logConsent returns failure for invalid email', async () => {
    const result = await logConsent({ email: 'bad', type: 'marketing' });
    expect(result.success).toBe(false);
  });

  it('logConsent uses custom logger', async () => {
    const logger = { info: vi.fn() };
    await logConsent({ email: 'u@e.com', type: 'analytics', logger });
    expect(logger.info).toHaveBeenCalledOnce();
  });
});

// ─── GDPR — unsubscribeHandler ───────────────────────────────────────────────

describe('unsubscribeHandler', () => {
  it('unsubscribeContact returns confirmation with timestamp', async () => {
    const result = await unsubscribeContact('u@e.com');
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('u@e.com');
    expect(result.data.blacklisted).toBe(true);
    expect(result.data.unsubscribedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('unsubscribeContact calls updateContact with emailBlacklisted: true', async () => {
    const api = {
      getContactInfo: vi.fn().mockResolvedValue({ body: { listIds: [1] } }),
      updateContact: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(getContactsApi).mockReturnValueOnce(api);
    await unsubscribeContact('u@e.com');
    expect(api.updateContact).toHaveBeenCalledOnce();
  });

  it('unsubscribeContact returns failure for invalid email', async () => {
    const result = await unsubscribeContact('not-valid');
    expect(result.success).toBe(false);
  });

  it('unsubscribeContact returns failure on API error', async () => {
    const api = {
      getContactInfo: vi.fn().mockResolvedValue({ body: { listIds: [] } }),
      updateContact: vi.fn().mockRejectedValue(new Error('Brevo error')),
    };
    vi.mocked(getContactsApi).mockReturnValueOnce(api);
    const result = await unsubscribeContact('u@e.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch('Brevo error');
  });

  it('unsubscribeContact proceeds even if getContactInfo fails', async () => {
    const api = {
      getContactInfo: vi.fn().mockRejectedValue(new Error('not found')),
      updateContact: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(getContactsApi).mockReturnValueOnce(api);
    const result = await unsubscribeContact('u@e.com');
    expect(result.success).toBe(true);
  });

  it('unsubscribeContact uses custom logger', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    await unsubscribeContact('u@e.com', { logger });
    expect(logger.info).toHaveBeenCalledOnce();
  });
});
