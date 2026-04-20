import { z } from 'zod';
import { verifyWebhookSignature } from '../../webhooks/verifySignature.js';
import { routeWebhookEvent } from '../../webhooks/eventRouter.js';

const optionsSchema = z.object({
  secret: z.string().optional(),
  onOpened: z.function().optional(),
  onClicked: z.function().optional(),
  onBounced: z.function().optional(),
  onSpamComplaint: z.function().optional(),
  onUnsubscribed: z.function().optional(),
  onUnhandled: z.function().optional(),
  onError: z.function().optional(),
});

function resolveSecret(provided) {
  const secret = provided ?? process.env.BREVO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      '[brevo-saas-automation] createExpressWebhookRouter: secret is required. ' +
        'Pass it as options.secret or set BREVO_WEBHOOK_SECRET env var.'
    );
  }
  return secret;
}

/**
 * Create an Express-compatible webhook handler for Brevo events.
 * Expects req.body to be a raw Buffer — mount with express.raw() before this handler.
 *
 * @param {object} [options]
 * @param {string} [options.secret] - Webhook secret (falls back to BREVO_WEBHOOK_SECRET env var)
 * @param {function} [options.onOpened]
 * @param {function} [options.onClicked]
 * @param {function} [options.onBounced]
 * @param {function} [options.onSpamComplaint]
 * @param {function} [options.onUnsubscribed]
 * @param {function} [options.onUnhandled]
 * @param {function} [options.onError] - Called with (error, req, res) on unexpected failures
 * @returns {(req: object, res: object) => Promise<void>} Express route handler
 *
 * @example
 * import { createExpressWebhookRouter } from 'brevo-saas-automation/integrations/express';
 * import express from 'express';
 * // Mount with express.raw() to preserve raw body for HMAC verification:
 * app.post('/webhooks/brevo',
 *   express.raw({ type: '*\/*' }),
 *   createExpressWebhookRouter({ onBounced: async ({ email }) => { ... } })
 * );
 */
export function createExpressWebhookRouter(options = {}) {
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    throw new Error(`createExpressWebhookRouter configuration invalid: ${msg}`);
  }

  const { onOpened, onClicked, onBounced, onSpamComplaint, onUnsubscribed, onUnhandled, onError } = parsed.data;

  return async function webhookHandler(req, res) {
    try {
      const secret = resolveSecret(options.secret);
      const rawBody = req.body;
      const signature = req.headers['x-brevo-signature'] ?? '';

      if (!Buffer.isBuffer(rawBody)) {
        res.status(400).json({ error: 'Raw body required. Mount with express.raw() before this handler.' });
        return;
      }

      const verification = verifyWebhookSignature({ rawBody, signature, secret });
      if (!verification.success) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const payload = JSON.parse(rawBody.toString('utf8'));

      const result = await routeWebhookEvent(payload, {
        onOpened,
        onClicked,
        onBounced,
        onSpamComplaint,
        onUnsubscribed,
        onUnhandled,
      });

      if (!result.success) {
        const err = new Error(result.error);
        if (onError) await onError(err, req, res);
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ received: true, type: result.data?.type ?? null });
    } catch (err) {
      if (onError) await onError(err, req, res);
      else res.status(500).json({ error: 'Internal server error' });
    }
  };
}
