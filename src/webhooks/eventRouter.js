import { z } from 'zod';
import { WEBHOOK_EVENTS } from '../config/constants.js';
import { handleOpened } from './handlers/opened.js';
import { handleClicked } from './handlers/clicked.js';
import { handleBounced } from './handlers/bounced.js';
import { handleSpam } from './handlers/spam.js';
import { handleUnsubscribed } from './handlers/unsubscribed.js';

const callbacksSchema = z.object({
  onOpened: z.function().optional(),
  onClicked: z.function().optional(),
  onBounced: z.function().optional(),
  onSpamComplaint: z.function().optional(),
  onUnsubscribed: z.function().optional(),
  onUnhandled: z.function().optional(),
}).optional();

const eventSchema = z.object({
  event: z.string().min(1),
  email: z.string().email(),
}).passthrough();

async function dispatch(handler, parsedData, callback) {
  const result = handler(parsedData);
  if (!result.success) return result;
  if (callback) await callback(result.data);
  return result;
}

/**
 * Route a raw Brevo webhook payload to the appropriate handler and optional callback.
 * @param {object} payload - Raw parsed JSON from the Brevo webhook POST body
 * @param {object} [callbacks] - Optional async callbacks per event type
 * @param {function} [callbacks.onOpened] - Called with opened event data
 * @param {function} [callbacks.onClicked] - Called with clicked event data
 * @param {function} [callbacks.onBounced] - Called with bounce event data
 * @param {function} [callbacks.onSpamComplaint] - Called with spam event data
 * @param {function} [callbacks.onUnsubscribed] - Called with unsubscribe event data
 * @param {function} [callbacks.onUnhandled] - Called for events with no registered handler
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function routeWebhookEvent(payload, callbacks = {}) {
  const payloadParsed = eventSchema.safeParse(payload);
  if (!payloadParsed.success) {
    return { success: false, error: 'routeWebhookEvent: payload missing required event or email fields' };
  }

  const callbacksParsed = callbacksSchema.safeParse(callbacks);
  if (!callbacksParsed.success) {
    return { success: false, error: 'routeWebhookEvent: invalid callbacks object' };
  }

  const { event } = payloadParsed.data;

  try {
    switch (event) {
      case WEBHOOK_EVENTS.OPENED:
        return await dispatch(handleOpened, payloadParsed.data, callbacks.onOpened);

      case WEBHOOK_EVENTS.CLICKED:
        return await dispatch(handleClicked, payloadParsed.data, callbacks.onClicked);

      case WEBHOOK_EVENTS.HARD_BOUNCE:
      case WEBHOOK_EVENTS.SOFT_BOUNCE:
        return await dispatch(handleBounced, payloadParsed.data, callbacks.onBounced);

      case WEBHOOK_EVENTS.SPAM:
        return await dispatch(handleSpam, payloadParsed.data, callbacks.onSpamComplaint);

      case WEBHOOK_EVENTS.UNSUBSCRIBED:
        return await dispatch(handleUnsubscribed, payloadParsed.data, callbacks.onUnsubscribed);

      default: {
        if (callbacks.onUnhandled) await callbacks.onUnhandled({ event, payload: payloadParsed.data });
        return { success: true, data: { type: 'unhandled', event } };
      }
    }
  } catch (err) {
    return { success: false, error: `routeWebhookEvent callback error: ${err.message}` };
  }
}
