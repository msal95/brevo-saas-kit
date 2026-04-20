import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@getbrevo/brevo', () => ({
  TransactionalEmailsApi: class {
    authentications = { apiKey: { apiKey: '' } };
    sendTransacEmail = vi.fn().mockResolvedValue({ body: { messageId: '<t@b>' } });
  },
  ContactsApi: class {
    authentications = { apiKey: { apiKey: '' } };
    createContact = vi.fn().mockResolvedValue({ body: { id: 1 } });
    updateContact = vi.fn().mockResolvedValue({});
    deleteContact = vi.fn().mockResolvedValue({});
    getContactInfo = vi.fn().mockResolvedValue({ body: { attributes: { TAGS: '' } } });
    importContacts = vi.fn().mockResolvedValue({ body: {} });
  },
  SendSmtpEmail: class {},
  CreateContact: class {},
  UpdateContact: class {},
  RequestContactImport: class {},
}));

vi.mock('../src/transactional/sendEmail.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, data: { messageId: '<t@b>' } }),
}));

vi.mock('../src/config/brevoClient.js', () => ({
  initBrevo: vi.fn(() => ({ success: true, data: {} })),
  getTransactionalApi: vi.fn(() => ({
    sendTransacEmail: vi.fn().mockResolvedValue({ body: { messageId: '<t@b>' } }),
  })),
  getContactsApi: vi.fn(() => ({
    createContact: vi.fn().mockResolvedValue({ body: { id: 1 } }),
    updateContact: vi.fn().mockResolvedValue({}),
    deleteContact: vi.fn().mockResolvedValue({}),
    getContactInfo: vi.fn().mockResolvedValue({ body: { attributes: { TAGS: '' } } }),
    importContacts: vi.fn().mockResolvedValue({ body: {} }),
  })),
  getSenderConfig: vi.fn(() => ({ email: 'test@app.com', name: 'TestApp' })),
}));

import { createNextjsWebhookHandler } from '../src/integrations/nextjs/webhook/route.js';
import { brevoMiddleware } from '../src/integrations/express/brevoMiddleware.js';
import { createExpressWebhookRouter } from '../src/integrations/express/webhookRouter.js';
import { initBrevo } from '../src/config/brevoClient.js';
import {
  sendWelcomeEmail as actionSendWelcome,
  createContact as actionCreateContact,
  startOnboardingSequence as actionStartOnboarding,
} from '../src/integrations/nextjs/actions/index.js';

const SECRET = 'test-webhook-secret-32-chars!!';

function sign(rawStr, secret = SECRET) {
  return createHmac('sha256', secret).update(rawStr).digest('hex');
}

function makeNextjsRequest(bodyObj, secret = SECRET) {
  const raw = JSON.stringify(bodyObj);
  const buf = Buffer.from(raw);
  const sig = sign(raw, secret);
  return {
    headers: { get: (h) => (h === 'x-brevo-signature' ? sig : null) },
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

function makeExpressReq(bodyObj, secret = SECRET) {
  const raw = JSON.stringify(bodyObj);
  const buf = Buffer.from(raw);
  const sig = sign(raw, secret);
  return { body: buf, headers: { 'x-brevo-signature': sig } };
}

function makeRes() {
  const res = { _status: undefined, _body: undefined };
  res.status = (s) => { res._status = s; return res; };
  res.json = (b) => { res._body = b; return res; };
  return res;
}

beforeEach(() => vi.clearAllMocks());

// ─── Next.js webhook handler ──────────────────────────────────────────────────

describe('createNextjsWebhookHandler', () => {
  it('throws at configuration time when secret is empty', () => {
    expect(() => createNextjsWebhookHandler({ secret: '' })).toThrow();
  });

  it('returns 401 for wrong signature', async () => {
    const handler = createNextjsWebhookHandler({ secret: SECRET });
    const req = makeNextjsRequest({ event: 'opened', email: 'u@e.com' }, 'wrong-secret');
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('verifies signature on raw bytes and routes opened event', async () => {
    const onOpened = vi.fn();
    const handler = createNextjsWebhookHandler({ secret: SECRET, onOpened });
    const req = makeNextjsRequest({ event: 'opened', email: 'u@e.com' });
    const res = await handler(req);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(onOpened).toHaveBeenCalledOnce();
    expect(onOpened.mock.calls[0][0].email).toBe('u@e.com');
  });

  it('routes hard_bounce and passes isHardBounce to callback', async () => {
    const onBounced = vi.fn();
    const handler = createNextjsWebhookHandler({ secret: SECRET, onBounced });
    const req = makeNextjsRequest({ event: 'hard_bounce', email: 'u@e.com' });
    await handler(req);
    expect(onBounced).toHaveBeenCalledOnce();
    expect(onBounced.mock.calls[0][0].isHardBounce).toBe(true);
  });

  it('routes unsubscribed event', async () => {
    const onUnsubscribed = vi.fn();
    const handler = createNextjsWebhookHandler({ secret: SECRET, onUnsubscribed });
    await handler(makeNextjsRequest({ event: 'unsubscribed', email: 'u@e.com' }));
    expect(onUnsubscribed).toHaveBeenCalledOnce();
  });

  it('returns unhandled for unknown event type', async () => {
    const handler = createNextjsWebhookHandler({ secret: SECRET });
    const res = await handler(makeNextjsRequest({ event: 'delivered', email: 'u@e.com' }));
    const body = await res.json();
    expect(body.type).toBe('unhandled');
  });

  it('returns 500 and calls onError when callback throws', async () => {
    const onError = vi.fn();
    const onOpened = vi.fn().mockRejectedValue(new Error('DB down'));
    const handler = createNextjsWebhookHandler({ secret: SECRET, onOpened, onError });
    const res = await handler(makeNextjsRequest({ event: 'opened', email: 'u@e.com' }));
    expect(res.status).toBe(500);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('uses raw body bytes for HMAC — body with extra spaces verifies correctly', async () => {
    const rawBody = '{"event":"spam","email":"u@e.com","pad":"  extra  spaces  "}';
    const buf = Buffer.from(rawBody);
    const sig = sign(rawBody);
    const req = {
      headers: { get: (h) => (h === 'x-brevo-signature' ? sig : null) },
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
    const onSpamComplaint = vi.fn();
    const handler = createNextjsWebhookHandler({ secret: SECRET, onSpamComplaint });
    const res = await handler(req);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(onSpamComplaint).toHaveBeenCalledOnce();
  });
});

// ─── Express middleware ────────────────────────────────────────────────────────

describe('brevoMiddleware', () => {
  it('attaches req.brevo with all core functions', () => {
    const middleware = brevoMiddleware();
    const req = {};
    const next = vi.fn();
    middleware(req, {}, next);
    expect(typeof req.brevo.sendWelcomeEmail).toBe('function');
    expect(typeof req.brevo.createContact).toBe('function');
    expect(typeof req.brevo.tagContact).toBe('function');
    expect(typeof req.brevo.startOnboardingSequence).toBe('function');
    expect(typeof req.brevo.sendFeatureAnnouncement).toBe('function');
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls initBrevo when apiKey and sender are provided', () => {
    brevoMiddleware({ apiKey: 'key-abc', sender: { email: 'a@b.com', name: 'App' } });
    expect(initBrevo).toHaveBeenCalledWith({
      apiKey: 'key-abc',
      sender: { email: 'a@b.com', name: 'App' },
    });
  });

  it('does not call initBrevo with empty options', () => {
    brevoMiddleware();
    expect(initBrevo).not.toHaveBeenCalled();
  });

  it('req.brevo is the same object across calls (shared reference)', () => {
    const req1 = {};
    const req2 = {};
    const mw = brevoMiddleware();
    mw(req1, {}, vi.fn());
    mw(req2, {}, vi.fn());
    expect(req1.brevo.sendWelcomeEmail).toBe(req2.brevo.sendWelcomeEmail);
  });
});

// ─── Express webhook handler ──────────────────────────────────────────────────

describe('createExpressWebhookRouter', () => {
  it('routes opened event with correct secret', async () => {
    const onOpened = vi.fn();
    const handler = createExpressWebhookRouter({ secret: SECRET, onOpened });
    const res = makeRes();
    await handler(makeExpressReq({ event: 'opened', email: 'u@e.com' }), res);
    expect(res._body.received).toBe(true);
    expect(onOpened).toHaveBeenCalledOnce();
  });

  it('returns 401 for invalid signature', async () => {
    const handler = createExpressWebhookRouter({ secret: SECRET });
    const res = makeRes();
    await handler(makeExpressReq({ event: 'opened', email: 'u@e.com' }, 'wrong'), res);
    expect(res._status).toBe(401);
  });

  it('returns 400 when req.body is not a Buffer', async () => {
    const handler = createExpressWebhookRouter({ secret: SECRET });
    const res = makeRes();
    await handler({ body: '{"event":"opened"}', headers: { 'x-brevo-signature': 'abc' } }, res);
    expect(res._status).toBe(400);
  });

  it('falls back to BREVO_WEBHOOK_SECRET env var', async () => {
    process.env.BREVO_WEBHOOK_SECRET = SECRET;
    const onOpened = vi.fn();
    const handler = createExpressWebhookRouter({ onOpened });
    const res = makeRes();
    await handler(makeExpressReq({ event: 'opened', email: 'u@e.com' }), res);
    expect(res._body.received).toBe(true);
    delete process.env.BREVO_WEBHOOK_SECRET;
  });

  it('routes soft_bounce to onBounced with isHardBounce: false', async () => {
    const onBounced = vi.fn();
    const handler = createExpressWebhookRouter({ secret: SECRET, onBounced });
    const res = makeRes();
    await handler(makeExpressReq({ event: 'soft_bounce', email: 'u@e.com' }), res);
    expect(onBounced.mock.calls[0][0].isHardBounce).toBe(false);
  });

  it('calls onError and returns 500 when callback throws', async () => {
    const onError = vi.fn();
    const onOpened = vi.fn().mockRejectedValue(new Error('DB error'));
    const handler = createExpressWebhookRouter({ secret: SECRET, onOpened, onError });
    const res = makeRes();
    await handler(makeExpressReq({ event: 'opened', email: 'u@e.com' }), res);
    expect(onError).toHaveBeenCalledOnce();
  });
});

// ─── Next.js server actions (smoke tests) ────────────────────────────────────

describe('nextjs server actions', () => {
  it('sendWelcomeEmail delegates to core and returns result', async () => {
    const result = await actionSendWelcome({ email: 'u@e.com', name: 'M' });
    expect(result.success).toBe(true);
  });

  it('createContact delegates to core and returns result', async () => {
    const result = await actionCreateContact({ email: 'u@e.com', name: 'M' });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
  });

  it('startOnboardingSequence in plan mode returns 5-step schedule', async () => {
    const result = await actionStartOnboarding({ email: 'u@e.com', name: 'M', mode: 'plan' });
    expect(result.success).toBe(true);
    expect(result.data.schedule).toHaveLength(5);
  });

  it('returns validation failure for bad email', async () => {
    const result = await actionSendWelcome({ email: 'bad', name: 'M' });
    expect(result.success).toBe(false);
  });
});
