import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

const schema = z.object({
  rawBody: z.union([z.string(), z.instanceof(Buffer)]),
  signature: z.string().min(1),
  secret: z.string().min(1),
});

function computeSignature(rawBody, secret) {
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  return createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Verify a Brevo webhook HMAC-SHA256 signature.
 * Brevo sends the signature in the x-brevo-signature header.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param {object} options
 * @param {string|Buffer} options.rawBody - The raw, unparsed request body
 * @param {string} options.signature - Value of the x-brevo-signature header
 * @param {string} options.secret - Your BREVO_WEBHOOK_SECRET
 * @returns {{ success: boolean, error?: string }}
 */
export function verifyWebhookSignature(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `verifyWebhookSignature validation failed: ${msg}` };
  }

  const { rawBody, signature, secret } = parsed.data;

  try {
    const expected = computeSignature(rawBody, secret);

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== receivedBuf.length) {
      return { success: false, error: 'Webhook signature verification failed: length mismatch' };
    }

    const valid = timingSafeEqual(expectedBuf, receivedBuf);
    if (!valid) {
      return { success: false, error: 'Webhook signature verification failed: signature mismatch' };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `verifyWebhookSignature error: ${err.message}` };
  }
}

/**
 * Extract and verify webhook signature using BREVO_WEBHOOK_SECRET env var.
 * @param {object} options
 * @param {string|Buffer} options.rawBody - The raw, unparsed request body
 * @param {string} options.signature - Value of the x-brevo-signature header
 * @returns {{ success: boolean, error?: string }}
 */
export function verifyWebhookSignatureFromEnv({ rawBody, signature }) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (!secret) {
    return {
      success: false,
      error: '[brevo-saas-automation] BREVO_WEBHOOK_SECRET env var is not set',
    };
  }
  return verifyWebhookSignature({ rawBody, signature, secret });
}
