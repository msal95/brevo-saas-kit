import { z } from 'zod';

const stepSchema = z.object({
  name: z.string().min(1),
  delayMs: z.number().int().nonnegative(),
  send: z.function(),
});

const workflowSchema = z.object({
  name: z.string().min(1),
  steps: z.array(stepSchema).min(1),
});

const startSchema = z.object({
  mode: z.enum(['inline', 'plan']).optional(),
});

/**
 * Define a reusable workflow from an ordered sequence of steps.
 * @param {object} options
 * @param {string} options.name - Workflow name for logging/tracking
 * @param {Array<{name:string,delayMs:number,send:function}>} options.steps - Ordered steps
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function defineWorkflow({ name, steps }) {
  const parsed = workflowSchema.safeParse({ name, steps });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `defineWorkflow validation failed: ${msg}` };
  }
  return { success: true, data: parsed.data };
}

/**
 * Build the scheduled execution plan for a workflow.
 * @param {object} workflow - Workflow definition from defineWorkflow
 * @param {Date} [startDate] - When the workflow starts (default: now)
 * @returns {Array<{stepIndex:number,name:string,delayMs:number,scheduledAt:Date}>}
 */
export function getWorkflowSchedule(workflow, startDate = new Date()) {
  return workflow.steps.map((step, i) => ({
    stepIndex: i,
    name: step.name,
    delayMs: step.delayMs,
    scheduledAt: new Date(startDate.getTime() + step.delayMs),
  }));
}

/**
 * Execute one specific step by index. Used by external schedulers in 'plan' mode.
 * @param {object} workflow - Workflow definition from defineWorkflow
 * @param {number} stepIndex - Index of the step to execute
 * @param {object} context - Context object passed to the step's send function
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function executeWorkflowStep(workflow, stepIndex, context) {
  const step = workflow.steps[stepIndex];
  if (!step) {
    return { success: false, error: `executeWorkflowStep: step index ${stepIndex} not found in workflow "${workflow.name}"` };
  }
  try {
    const result = await step.send(context);
    const nextIndex = stepIndex + 1;
    const nextStep = workflow.steps[nextIndex];
    return {
      success: true,
      data: {
        stepName: step.name,
        result,
        nextStepIndex: nextStep ? nextIndex : null,
        nextDelayMs: nextStep ? nextStep.delayMs : null,
      },
    };
  } catch (err) {
    return { success: false, error: `executeWorkflowStep "${step.name}" failed: ${err.message}` };
  }
}

/**
 * Start a workflow. In 'plan' mode returns the schedule without executing.
 * In 'inline' mode executes step 0 immediately and uses setTimeout for the rest.
 * For multi-day production workflows, use 'plan' mode with your own job scheduler.
 * @param {object} workflow - Workflow definition from defineWorkflow
 * @param {object} context - Context passed to every step's send function
 * @param {object} [options]
 * @param {'inline'|'plan'} [options.mode] - Execution mode (default: 'inline')
 * @returns {Promise<{success:boolean,data?:object,error?:string}>}
 */
export async function startWorkflow(workflow, context, options = {}) {
  const optParsed = startSchema.safeParse(options);
  if (!optParsed.success) {
    return { success: false, error: 'startWorkflow: invalid options' };
  }

  const mode = options.mode ?? 'inline';
  const schedule = getWorkflowSchedule(workflow);

  if (mode === 'plan') {
    return { success: true, data: { mode: 'plan', workflow: workflow.name, schedule } };
  }

  const timers = [];
  const stepResults = [];

  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (step.delayMs === 0) {
        const result = await step.send(context);
        stepResults.push({ stepIndex: i, name: step.name, result });
      } else {
        const timer = setTimeout(async () => {
          await step.send(context);
        }, step.delayMs);
        timers.push(timer);
        stepResults.push({ stepIndex: i, name: step.name, scheduledAt: new Date(Date.now() + step.delayMs) });
      }
    }
    const cancel = () => timers.forEach(t => clearTimeout(t));
    return { success: true, data: { mode: 'inline', workflow: workflow.name, schedule, stepResults, cancel } };
  } catch (err) {
    timers.forEach(t => clearTimeout(t));
    return { success: false, error: `startWorkflow "${workflow.name}" failed: ${err.message}` };
  }
}

export const DELAYS = {
  IMMEDIATE: 0,
  minutes: n => n * 60 * 1000,
  hours: n => n * 60 * 60 * 1000,
  days: n => n * 24 * 60 * 60 * 1000,
};
