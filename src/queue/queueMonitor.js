import { getQueueMode } from './emailQueue.js';

/**
 * Get queue health stats.
 * Simple mode: returns static zero-counts with mode indicator.
 * Queue mode: returns live BullMQ counts for pending, active, failed, completed jobs.
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function getQueueHealth() {
  const mode = getQueueMode();

  if (mode === 'simple') {
    return {
      success: true,
      data: {
        mode: 'simple',
        pending: 0,
        active: 0,
        failed: 0,
        completed: 0,
      },
    };
  }

  return _getLiveStats();
}

async function _getLiveStats() {
  try {
    const { _getQueueInstance } = await import('./emailQueue.js');
    const queue = _getQueueInstance?.();

    if (!queue) {
      return { success: false, error: 'getQueueHealth: queue not initialized' };
    }

    const [waiting, active, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
    ]);

    return {
      success: true,
      data: {
        mode: 'queue',
        pending: waiting,
        active,
        failed,
        completed,
      },
    };
  } catch (err) {
    return { success: false, error: `getQueueHealth: ${err.message}` };
  }
}

/**
 * Check if the queue connection is reachable (queue mode only).
 * @returns {Promise<{success:boolean,data?:{alive:boolean},error?:string}>}
 */
export async function pingQueue() {
  const mode = getQueueMode();

  if (mode === 'simple') {
    return { success: true, data: { alive: true, mode: 'simple' } };
  }

  try {
    const { _getQueueInstance } = await import('./emailQueue.js');
    const queue = _getQueueInstance?.();
    if (!queue) return { success: false, error: 'pingQueue: queue not initialized' };

    await queue.getWaitingCount();
    return { success: true, data: { alive: true, mode: 'queue' } };
  } catch (err) {
    return { success: false, error: `pingQueue: ${err.message}` };
  }
}
