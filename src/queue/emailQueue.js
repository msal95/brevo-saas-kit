import { z } from 'zod';

const jobSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()),
  priority: z.number().int().min(1).max(10).optional(),
});

let _queueState = null; // null = simple mode, object = queue mode

/**
 * Initialize BullMQ queue mode. If not called, queueEmail() runs sends immediately.
 * Requires bullmq to be installed and Redis to be running.
 * @param {object} options
 * @param {string} options.redisUrl - Redis connection URL
 * @param {string} [options.queueName] - BullMQ queue name (default: 'brevo-email')
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function initQueue({ redisUrl, queueName = 'brevo-email' } = {}) {
  if (!redisUrl) {
    return { success: false, error: 'initQueue: redisUrl is required' };
  }

  let Queue;
  try {
    const bullmq = await import('bullmq');
    Queue = bullmq.Queue;
  } catch {
    return {
      success: false,
      error: 'Queue mode requires BullMQ and Redis. Run: npm install bullmq',
    };
  }

  try {
    const connection = { url: redisUrl };
    const queue = new Queue(queueName, { connection });
    _queueState = { queue, queueName, connection };
    return { success: true, data: { mode: 'queue', queueName } };
  } catch (err) {
    return { success: false, error: `initQueue: failed to connect — ${err.message}` };
  }
}

/**
 * Queue an email job. In simple mode, executes the send immediately.
 * In queue mode, adds the job to BullMQ for async processing.
 * @param {object} options
 * @param {string} options.type - Email type identifier (e.g. 'welcome', 'invoice')
 * @param {object} options.payload - Data for the email function
 * @param {number} [options.priority] - Job priority 1 (highest) – 10 (lowest)
 * @param {object} [options.retryOptions] - Override retry settings (queue mode only)
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function queueEmail({ type, payload, priority, retryOptions } = {}) {
  const parsed = jobSchema.safeParse({ type, payload: payload ?? {}, priority });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `queueEmail: invalid options — ${msg}` };
  }

  if (_queueState) {
    return _enqueueToQueue(parsed.data, retryOptions);
  }

  return _sendImmediate(parsed.data);
}

async function _sendImmediate({ type, payload }) {
  try {
    const handler = await _resolveHandler(type);
    if (!handler) {
      return { success: false, error: `queueEmail: unknown email type '${type}'` };
    }
    const result = await handler(payload);
    return result;
  } catch (err) {
    return { success: false, error: `queueEmail: immediate send failed — ${err.message}` };
  }
}

async function _enqueueToQueue({ type, payload, priority }, retryOptions) {
  try {
    const { queue } = _queueState;
    const defaultRetry = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    };
    const jobOpts = {
      priority: priority ?? 5,
      attempts: retryOptions?.attempts ?? defaultRetry.attempts,
      backoff: retryOptions?.backoff ?? defaultRetry.backoff,
    };
    const job = await queue.add(type, payload, jobOpts);
    return { success: true, data: { mode: 'queue', jobId: job.id, type } };
  } catch (err) {
    return { success: false, error: `queueEmail: failed to enqueue — ${err.message}` };
  }
}

async function _resolveHandler(type) {
  const map = {
    welcome:          () => import('../transactional/welcome.js').then(m => m.sendWelcomeEmail),
    verification:     () => import('../transactional/emailVerification.js').then(m => m.sendVerificationEmail),
    'password-reset': () => import('../transactional/passwordReset.js').then(m => m.sendPasswordResetEmail),
    invoice:          () => import('../transactional/invoice.js').then(m => m.sendInvoiceEmail),
    'account-delete': () => import('../transactional/accountDeletion.js').then(m => m.sendAccountDeletionEmail),
    'role-change':    () => import('../transactional/roleChange.js').then(m => m.sendRoleChangeEmail),
  };
  const loader = map[type];
  if (!loader) return null;
  return loader();
}

/**
 * Returns current queue mode.
 * @returns {'simple'|'queue'}
 */
export function getQueueMode() {
  return _queueState ? 'queue' : 'simple';
}

/** Returns the raw BullMQ Queue instance, or null in simple mode. For internal use. */
export function _getQueueInstance() {
  return _queueState?.queue ?? null;
}

/** Reset state. For testing only. */
export function _resetQueue() {
  _queueState = null;
}
