import { z } from 'zod';

const BACKOFF_DELAYS_MS = [1000, 5000, 30000]; // attempt 1, 2, 3

const retrySchema = z.object({
  fn: z.function(),
  maxAttempts: z.number().int().min(1).max(10).optional().default(3),
  onRetry: z.function().optional(),
});

/**
 * Execute an async function with exponential backoff retry.
 * Simple mode: uses setTimeout delays (1s → 5s → 30s).
 * Delay sequence: attempt 1 = 1s, attempt 2 = 5s, attempt 3 = 30s.
 * @param {object} options
 * @param {function} options.fn - Async function to execute
 * @param {number} [options.maxAttempts=3] - Maximum number of attempts
 * @param {function} [options.onRetry] - Called with (attempt, error, delayMs) before each retry
 * @returns {Promise<{success:boolean,data?:unknown,error?:string,attempts?:number}>}
 */
export async function withRetry({ fn, maxAttempts = 3, onRetry } = {}) {
  const parsed = retrySchema.safeParse({ fn, maxAttempts, onRetry });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `withRetry: invalid options — ${msg}` };
  }

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { success: true, data: result, attempts: attempt };
    } catch (err) {
      lastError = err;

      if (attempt < maxAttempts) {
        const delayMs = getBackoffDelay(attempt);
        if (onRetry) {
          try { await onRetry(attempt, err, delayMs); } catch {}
        }
        await sleep(delayMs);
      }
    }
  }

  return {
    success: false,
    error: `withRetry: all ${maxAttempts} attempts failed — ${lastError?.message}`,
    attempts: maxAttempts,
  };
}

/**
 * Get the backoff delay in ms for a given attempt number.
 * Attempt 1 → 1000ms, attempt 2 → 5000ms, attempt 3+ → 30000ms.
 * @param {number} attempt - Attempt number (1-based)
 * @returns {number}
 */
export function getBackoffDelay(attempt) {
  const index = Math.min(attempt - 1, BACKOFF_DELAYS_MS.length - 1);
  return BACKOFF_DELAYS_MS[index];
}

/**
 * Build BullMQ-compatible retry options for use with queue.add().
 * @param {object} [options]
 * @param {number} [options.attempts=3] - Max retry attempts
 * @param {number} [options.initialDelay=1000] - Initial backoff delay in ms
 * @returns {{ attempts: number, backoff: { type: string, delay: number } }}
 */
export function buildQueueRetryOptions({ attempts = 3, initialDelay = 1000 } = {}) {
  return {
    attempts,
    backoff: {
      type: 'exponential',
      delay: initialDelay,
    },
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
