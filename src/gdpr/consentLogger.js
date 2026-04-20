import { z } from 'zod';
import { createHmac } from 'node:crypto';

const CONSENT_TYPES = ['marketing', 'transactional', 'analytics', 'all'];

const schema = z.object({
  email: z.string().email(),
  type: z.enum(['marketing', 'transactional', 'analytics', 'all']),
  ip: z.string().optional(),
  timestamp: z.union([z.string(), z.date()]).optional(),
  metadata: z.record(z.unknown()).optional(),
  logger: z.any().optional(),
});

/**
 * Log a user's email consent with a tamper-evident HMAC signature.
 * The signature is HMAC-SHA256 over `${email}:${type}:${timestamp}` using BREVO_WEBHOOK_SECRET.
 * Logs to console by default; pass a custom logger via options.
 *
 * @param {object} options
 * @param {string} options.email - Contact email
 * @param {'marketing'|'transactional'|'analytics'|'all'} options.type - Consent type
 * @param {string} [options.ip] - IP address of the user at consent time
 * @param {string|Date} [options.timestamp] - Consent timestamp (default: now)
 * @param {object} [options.metadata] - Any additional data to attach to the record
 * @param {object} [options.logger] - Custom logger with .info() method
 * @returns {Promise<{success:boolean,data?:{record:object,signature:string},error?:string}>}
 */
export async function logConsent({ email, type, ip, timestamp, metadata, logger } = {}) {
  const log = logger ?? console;

  const parsed = schema.safeParse({ email, type, ip, timestamp, metadata, logger });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `logConsent: invalid input — ${msg}` };
  }

  const ts = parsed.data.timestamp
    ? new Date(parsed.data.timestamp).toISOString()
    : new Date().toISOString();

  const record = {
    email: parsed.data.email,
    type: parsed.data.type,
    ip: parsed.data.ip ?? null,
    timestamp: ts,
    metadata: parsed.data.metadata ?? {},
  };

  const signature = _sign(record);

  const consentEntry = { ...record, signature };

  log.info?.(`[gdpr] logConsent: ${record.email} consented to ${record.type} at ${ts}`);

  return { success: true, data: { record, signature } };
}

function _sign(record) {
  const secret = process.env.BREVO_WEBHOOK_SECRET ?? 'brevo-saas-consent-default';
  const payload = `${record.email}:${record.type}:${record.timestamp}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify a consent record signature.
 * @param {object} record - The record object (without signature)
 * @param {string} signature - The signature to verify
 * @returns {{ valid: boolean }}
 */
export function verifyConsentSignature(record, signature) {
  if (!record || typeof signature !== 'string') return { valid: false };
  const expected = _sign(record);
  const match = expected.length === signature.length &&
    Buffer.from(expected).equals(Buffer.from(signature));
  return { valid: match };
}

export { CONSENT_TYPES };
