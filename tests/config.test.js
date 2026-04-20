import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateEnv, requireEnv } from '../src/config/envValidator.js';
import { initBrevo, getTransactionalApi, getContactsApi, getSenderConfig, _resetClient } from '../src/config/brevoClient.js';
import { WEBHOOK_EVENTS, CONTACT_PLANS, LIST_ENV_KEYS, EMAIL_DEFAULTS } from '../src/config/constants.js';

vi.mock('@getbrevo/brevo', () => {
  class TransactionalEmailsApi {
    authentications = { apiKey: { apiKey: '' } };
  }
  class ContactsApi {
    authentications = { apiKey: { apiKey: '' } };
  }
  return { TransactionalEmailsApi, ContactsApi };
});

// ─── envValidator ────────────────────────────────────────────────────────────

describe('validateEnv', () => {
  const valid = {
    BREVO_API_KEY: 'xkeysib-test',
    BREVO_SENDER_EMAIL: 'no-reply@example.com',
    BREVO_SENDER_NAME: 'TestApp',
  };

  it('returns success with valid required vars', () => {
    const result = validateEnv(valid);
    expect(result.success).toBe(true);
    expect(result.data.BREVO_API_KEY).toBe('xkeysib-test');
  });

  it('coerces BREVO_LIST_FREE to a number', () => {
    const result = validateEnv({ ...valid, BREVO_LIST_FREE: '5' });
    expect(result.success).toBe(true);
    expect(result.data.BREVO_LIST_FREE).toBe(5);
  });

  it('returns failure when BREVO_API_KEY is missing', () => {
    const { BREVO_API_KEY: _, ...rest } = valid;
    const result = validateEnv(rest);
    expect(result.success).toBe(false);
    expect(result.error).toMatch('BREVO_API_KEY');
  });

  it('returns failure when BREVO_SENDER_EMAIL is invalid', () => {
    const result = validateEnv({ ...valid, BREVO_SENDER_EMAIL: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('BREVO_SENDER_EMAIL');
  });

  it('accepts optional fields when omitted', () => {
    const result = validateEnv(valid);
    expect(result.success).toBe(true);
    expect(result.data.BREVO_WEBHOOK_SECRET).toBeUndefined();
    expect(result.data.REDIS_URL).toBeUndefined();
  });
});

describe('requireEnv', () => {
  it('returns parsed data on valid env', () => {
    const env = {
      BREVO_API_KEY: 'xkeysib-test',
      BREVO_SENDER_EMAIL: 'no-reply@example.com',
      BREVO_SENDER_NAME: 'TestApp',
    };
    expect(() => requireEnv(env)).not.toThrow();
    expect(requireEnv(env).BREVO_API_KEY).toBe('xkeysib-test');
  });

  it('throws on invalid env', () => {
    expect(() => requireEnv({})).toThrow('[brevo-saas-automation]');
  });
});

// ─── brevoClient ─────────────────────────────────────────────────────────────

describe('initBrevo', () => {
  beforeEach(() => _resetClient());

  it('returns success with valid config', () => {
    const result = initBrevo({ apiKey: 'key-123', sender: { email: 'a@b.com', name: 'App' } });
    expect(result.success).toBe(true);
    expect(result.data.sender.email).toBe('a@b.com');
  });

  it('returns failure when apiKey is empty', () => {
    const result = initBrevo({ apiKey: '', sender: { email: 'a@b.com', name: 'App' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('apiKey');
  });

  it('returns failure when sender is missing fields', () => {
    const result = initBrevo({ apiKey: 'key-123', sender: { email: 'a@b.com' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('sender');
  });
});

describe('getTransactionalApi', () => {
  beforeEach(() => _resetClient());

  it('returns a TransactionalEmailsApi instance after initBrevo', () => {
    initBrevo({ apiKey: 'key-123', sender: { email: 'a@b.com', name: 'App' } });
    const api = getTransactionalApi();
    expect(api).toBeDefined();
    expect(api.authentications.apiKey.apiKey).toBe('key-123');
  });

  it('throws when not initialized and env vars are absent', () => {
    const orig = process.env.BREVO_API_KEY;
    delete process.env.BREVO_API_KEY;
    expect(() => getTransactionalApi()).toThrow('[brevo-saas-automation]');
    if (orig) process.env.BREVO_API_KEY = orig;
  });
});

describe('getSenderConfig', () => {
  beforeEach(() => _resetClient());

  it('returns sender after initBrevo', () => {
    initBrevo({ apiKey: 'key-123', sender: { email: 'sender@app.com', name: 'MyApp' } });
    expect(getSenderConfig()).toEqual({ email: 'sender@app.com', name: 'MyApp' });
  });
});

// ─── constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('WEBHOOK_EVENTS contains expected keys', () => {
    expect(WEBHOOK_EVENTS.OPENED).toBe('opened');
    expect(WEBHOOK_EVENTS.HARD_BOUNCE).toBe('hard_bounce');
    expect(WEBHOOK_EVENTS.SPAM).toBe('spam');
    expect(WEBHOOK_EVENTS.UNSUBSCRIBED).toBe('unsubscribed');
  });

  it('CONTACT_PLANS contains free/pro/enterprise', () => {
    expect(CONTACT_PLANS.FREE).toBe('free');
    expect(CONTACT_PLANS.PRO).toBe('pro');
    expect(CONTACT_PLANS.ENTERPRISE).toBe('enterprise');
  });

  it('LIST_ENV_KEYS maps plan to env var name', () => {
    expect(LIST_ENV_KEYS.free).toBe('BREVO_LIST_FREE');
    expect(LIST_ENV_KEYS.pro).toBe('BREVO_LIST_PRO');
    expect(LIST_ENV_KEYS.enterprise).toBe('BREVO_LIST_ENTERPRISE');
  });

  it('EMAIL_DEFAULTS has sensible values', () => {
    expect(EMAIL_DEFAULTS.OTP_EXPIRY_MINUTES).toBe(10);
    expect(EMAIL_DEFAULTS.RESET_EXPIRY_HOURS).toBe(1);
  });
});
