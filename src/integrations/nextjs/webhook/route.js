import { z } from 'zod';
import { verifyWebhookSignature } from '../../../webhooks/verifySignature.js';
import { routeWebhookEvent } from '../../../webhooks/eventRouter.js';

const callbacksSchema = z.object({
  secret: z.string().min(1),
  onOpened: z.function().optional(),
  onClicked: z.function().optional(),
  onBounced: z.function().optional(),
  onSpamComplaint: z.function().optional(),
  onUnsubscribed: z.function().optional(),
  onUnhandled: z.function().optional(),
  onError: z.function().optional(),
});

/**
 * Create a Next.js App Router POST handler for Brevo webhooks.
 * Mount as: export const POST = createNextjsWebhookHandler({ secret, onBounced, ... })
 *
 * Uses request.arrayBuffer() to read raw bytes BEFORE any JSON parsing so that
 * HMAC-SHA256 signature verification operates on the original unmodified body.
 *
 * @param {object} options
 * @param {string} options.secret - Brevo webhook secret (BREVO_WEBHOOK_SECRET)
 * @param {function} [options.onOpened]
 * @param {function} [options.onClicked]
 * @param {function} [options.onBounced]
 * @param {function} [options.onSpamComplaint]
 * @param {function} [options.onUnsubscribed]
 * @param {function} [options.onUnhandled]
 * @param {function} [options.onError] - Called with (error, request) on unexpected failures
 * @returns {(request: Request) => Promise<Response>} Next.js App Router POST handler
 */
export function createNextjsWebhookHandler(options) {
  const parsed = callbacksSchema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    throw new Error(`createNextjsWebhookHandler configuration invalid: ${msg}`);
  }

  const { secret, onOpened, onClicked, onBounced, onSpamComplaint, onUnsubscribed, onUnhandled, onError } = parsed.data;

  return async function POST(request) {
    try {
      const signature = request.headers.get('x-brevo-signature') ?? '';

      // Read raw bytes FIRST — before any JSON parsing — to preserve body integrity for HMAC
      const arrayBuffer = await request.arrayBuffer();
      const rawBody = Buffer.from(arrayBuffer);

      const verification = verifyWebhookSignature({ rawBody, signature, secret });
      if (!verification.success) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
        if (onError) await onError(err, request);
        return Response.json({ error: result.error }, { status: 500 });
      }

      return Response.json({ received: true, type: result.data?.type ?? null });
    } catch (err) {
      if (onError) await onError(err, request);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
