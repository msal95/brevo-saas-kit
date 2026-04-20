import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  defineWorkflow,
  getWorkflowSchedule,
  executeWorkflowStep,
  startWorkflow,
  DELAYS,
} from '../src/workflows/workflowRunner.js';
import { startOnboardingSequence } from '../src/workflows/onboarding.js';
import { scheduleTrialReminders } from '../src/workflows/trialExpiry.js';
import { startReEngagementSequence } from '../src/workflows/reEngagement.js';
import { sendFeatureAnnouncement } from '../src/workflows/featureAnnouncement.js';
import { startUpsellSequence } from '../src/workflows/upsell.js';

vi.mock('../src/transactional/sendEmail.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, data: { messageId: '<test@brevo>' } }),
}));

vi.mock('../src/config/brevoClient.js', () => ({
  getTransactionalApi: vi.fn(() => ({ sendTransacEmail: vi.fn() })),
  getSenderConfig: vi.fn(() => ({ email: 'test@app.com', name: 'TestApp' })),
}));

import { sendEmail } from '../src/transactional/sendEmail.js';

beforeEach(() => vi.clearAllMocks());

// ─── workflowRunner ──────────────────────────────────────────────────────────

describe('defineWorkflow', () => {
  it('returns success with valid steps', () => {
    const result = defineWorkflow({
      name: 'test',
      steps: [{ name: 'step-1', delayMs: 0, send: vi.fn() }],
    });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('test');
    expect(result.data.steps).toHaveLength(1);
  });

  it('returns failure with empty steps', () => {
    const result = defineWorkflow({ name: 'test', steps: [] });
    expect(result.success).toBe(false);
  });

  it('returns failure when name is missing', () => {
    const result = defineWorkflow({ steps: [{ name: 's', delayMs: 0, send: vi.fn() }] });
    expect(result.success).toBe(false);
  });
});

describe('getWorkflowSchedule', () => {
  it('returns steps with correct scheduledAt times', () => {
    const workflow = defineWorkflow({
      name: 'test',
      steps: [
        { name: 'now', delayMs: 0, send: vi.fn() },
        { name: '1hr', delayMs: DELAYS.hours(1), send: vi.fn() },
        { name: '1day', delayMs: DELAYS.days(1), send: vi.fn() },
      ],
    }).data;
    const base = new Date('2026-04-20T00:00:00Z');
    const schedule = getWorkflowSchedule(workflow, base);
    expect(schedule).toHaveLength(3);
    expect(schedule[0].scheduledAt).toEqual(base);
    expect(schedule[1].scheduledAt.getTime()).toBe(base.getTime() + DELAYS.hours(1));
    expect(schedule[2].scheduledAt.getTime()).toBe(base.getTime() + DELAYS.days(1));
  });
});

describe('executeWorkflowStep', () => {
  const mockSend = vi.fn().mockResolvedValue({ success: true, data: {} });
  const workflow = defineWorkflow({
    name: 'test',
    steps: [
      { name: 'step-0', delayMs: 0, send: mockSend },
      { name: 'step-1', delayMs: DELAYS.days(1), send: mockSend },
    ],
  }).data;

  beforeEach(() => mockSend.mockClear());

  it('executes a step and returns nextStepIndex', async () => {
    const result = await executeWorkflowStep(workflow, 0, { email: 'u@e.com' });
    expect(result.success).toBe(true);
    expect(result.data.stepName).toBe('step-0');
    expect(result.data.nextStepIndex).toBe(1);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it('returns null nextStepIndex on last step', async () => {
    const result = await executeWorkflowStep(workflow, 1, { email: 'u@e.com' });
    expect(result.success).toBe(true);
    expect(result.data.nextStepIndex).toBeNull();
  });

  it('returns failure for invalid step index', async () => {
    const result = await executeWorkflowStep(workflow, 99, { email: 'u@e.com' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('step index 99');
  });

  it('returns failure when step send function throws', async () => {
    const throwingWorkflow = defineWorkflow({
      name: 'throw-test',
      steps: [{ name: 'bad', delayMs: 0, send: async () => { throw new Error('send failed'); } }],
    }).data;
    const result = await executeWorkflowStep(throwingWorkflow, 0, {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch('send failed');
  });
});

describe('startWorkflow', () => {
  it("returns schedule only in 'plan' mode without executing", async () => {
    const send = vi.fn();
    const workflow = defineWorkflow({
      name: 'test',
      steps: [{ name: 's', delayMs: 0, send }],
    }).data;
    const result = await startWorkflow(workflow, {}, { mode: 'plan' });
    expect(result.success).toBe(true);
    expect(result.data.mode).toBe('plan');
    expect(send).not.toHaveBeenCalled();
    expect(result.data.schedule).toHaveLength(1);
  });

  it("executes step-0 immediately in 'inline' mode", async () => {
    const send = vi.fn().mockResolvedValue({ success: true });
    const workflow = defineWorkflow({
      name: 'test',
      steps: [{ name: 'immediate', delayMs: 0, send }],
    }).data;
    const result = await startWorkflow(workflow, { email: 'u@e.com' }, { mode: 'inline' });
    expect(result.success).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });

  it('returned cancel() clears pending timers', async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue({ success: true });
    const workflow = defineWorkflow({
      name: 'test',
      steps: [
        { name: 'now', delayMs: 0, send },
        { name: 'later', delayMs: 5000, send },
      ],
    }).data;
    const result = await startWorkflow(workflow, {}, { mode: 'inline' });
    result.data.cancel();
    await vi.runAllTimersAsync();
    expect(send).toHaveBeenCalledTimes(1); // only step-0
    vi.useRealTimers();
  });
});

describe('DELAYS', () => {
  it('DELAYS.IMMEDIATE is 0', () => expect(DELAYS.IMMEDIATE).toBe(0));
  it('DELAYS.minutes(5) is 300000ms', () => expect(DELAYS.minutes(5)).toBe(300000));
  it('DELAYS.hours(1) is 3600000ms', () => expect(DELAYS.hours(1)).toBe(3600000));
  it('DELAYS.days(1) is 86400000ms', () => expect(DELAYS.days(1)).toBe(86400000));
  it('DELAYS.days(14) is correct', () => expect(DELAYS.days(14)).toBe(14 * 24 * 60 * 60 * 1000));
});

// ─── onboarding ──────────────────────────────────────────────────────────────

describe('startOnboardingSequence', () => {
  it("returns schedule with 5 steps in 'plan' mode", async () => {
    const result = await startOnboardingSequence({
      email: 'u@e.com',
      name: 'Muhammad',
      mode: 'plan',
    });
    expect(result.success).toBe(true);
    expect(result.data.schedule).toHaveLength(5);
    expect(result.data.schedule[0].name).toBe('day-0-welcome');
    expect(result.data.schedule[0].delayMs).toBe(0);
    expect(result.data.schedule[4].name).toBe('day-14-nudge');
    expect(result.data.schedule[4].delayMs).toBe(DELAYS.days(14));
  });

  it("sends day-0 email immediately in 'inline' mode", async () => {
    await startOnboardingSequence({ email: 'u@e.com', name: 'Muhammad', mode: 'inline' });
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('returns failure on invalid email', async () => {
    const result = await startOnboardingSequence({ email: 'bad', name: 'M', mode: 'plan' });
    expect(result.success).toBe(false);
  });

  it('plan has correct delays at day indices', async () => {
    const result = await startOnboardingSequence({ email: 'u@e.com', name: 'M', mode: 'plan' });
    const delays = result.data.schedule.map(s => s.delayMs);
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBe(DELAYS.days(1));
    expect(delays[2]).toBe(DELAYS.days(3));
    expect(delays[3]).toBe(DELAYS.days(7));
    expect(delays[4]).toBe(DELAYS.days(14));
  });
});

// ─── trialExpiry ─────────────────────────────────────────────────────────────

describe('scheduleTrialReminders', () => {
  it("returns schedule with 4 steps when trial is 10+ days away", async () => {
    const trialEndsAt = new Date(Date.now() + DELAYS.days(10));
    const result = await scheduleTrialReminders({
      email: 'u@e.com',
      name: 'Muhammad',
      trialEndsAt,
      mode: 'plan',
    });
    expect(result.success).toBe(true);
    expect(result.data.schedule).toHaveLength(4);
  });

  it('skips 7-day reminder when trial ends in 5 days', async () => {
    const trialEndsAt = new Date(Date.now() + DELAYS.days(5));
    const result = await scheduleTrialReminders({
      email: 'u@e.com',
      name: 'M',
      trialEndsAt,
      mode: 'plan',
    });
    expect(result.success).toBe(true);
    const names = result.data.schedule.map(s => s.name);
    expect(names).not.toContain('7-day-warning');
    expect(names).toContain('3-day-warning');
  });

  it('returns failure when trial has already expired', async () => {
    const result = await scheduleTrialReminders({
      email: 'u@e.com',
      name: 'M',
      trialEndsAt: new Date(Date.now() - 1000),
      mode: 'plan',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('expired');
  });

  it('returns failure on invalid email', async () => {
    const result = await scheduleTrialReminders({
      email: 'bad',
      name: 'M',
      trialEndsAt: new Date(Date.now() + DELAYS.days(10)),
    });
    expect(result.success).toBe(false);
  });
});

// ─── reEngagement ────────────────────────────────────────────────────────────

describe('startReEngagementSequence', () => {
  it("returns schedule with 3 steps in 'plan' mode", async () => {
    const result = await startReEngagementSequence({
      email: 'u@e.com',
      name: 'Muhammad',
      lastActiveAt: new Date(Date.now() - DELAYS.days(30)),
      mode: 'plan',
    });
    expect(result.success).toBe(true);
    expect(result.data.schedule).toHaveLength(3);
    expect(result.data.schedule[0].name).toBe('miss-you');
    expect(result.data.schedule[1].delayMs).toBe(DELAYS.days(7));
    expect(result.data.schedule[2].delayMs).toBe(DELAYS.days(14));
  });

  it("sends first email immediately in 'inline' mode", async () => {
    await startReEngagementSequence({
      email: 'u@e.com',
      name: 'Muhammad',
      lastActiveAt: new Date(),
      mode: 'inline',
    });
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('returns failure on missing lastActiveAt', async () => {
    const result = await startReEngagementSequence({ email: 'u@e.com', name: 'M' });
    expect(result.success).toBe(false);
  });
});

// ─── featureAnnouncement ─────────────────────────────────────────────────────

describe('sendFeatureAnnouncement', () => {
  it('sends to all recipients and reports sent count', async () => {
    const result = await sendFeatureAnnouncement({
      recipients: ['a@e.com', 'b@e.com', 'c@e.com'],
      featureName: 'Dark Mode',
      description: 'We just shipped dark mode across the entire product.',
      bulletPoints: ['Easy on the eyes', 'Auto-detects system preference'],
      ctaUrl: 'https://app.com/settings',
    });
    expect(result.success).toBe(true);
    expect(result.data.sent).toBe(3);
    expect(result.data.failed).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(3);
  });

  it('accepts object recipients with name', async () => {
    const result = await sendFeatureAnnouncement({
      recipients: [{ email: 'user@e.com', name: 'Muhammad' }],
      featureName: 'API v2',
      description: 'New API with 10x performance.',
    });
    expect(result.success).toBe(true);
    expect(result.data.sent).toBe(1);
  });

  it('reports partial failures when some sends fail', async () => {
    sendEmail
      .mockResolvedValueOnce({ success: true, data: { messageId: 'x' } })
      .mockResolvedValueOnce({ success: false, error: 'sendEmail failed: rate limit' });
    const result = await sendFeatureAnnouncement({
      recipients: ['a@e.com', 'b@e.com'],
      featureName: 'Dark Mode',
      description: 'Dark mode is here.',
    });
    expect(result.success).toBe(false);
    expect(result.data.sent).toBe(1);
    expect(result.data.failed).toBe(1);
    expect(result.data.errors).toHaveLength(1);
  });

  it('returns failure on empty recipients', async () => {
    const result = await sendFeatureAnnouncement({
      recipients: [],
      featureName: 'X',
      description: 'Y',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure on missing featureName', async () => {
    const result = await sendFeatureAnnouncement({ recipients: ['u@e.com'], description: 'Y' });
    expect(result.success).toBe(false);
  });
});

// ─── upsell ──────────────────────────────────────────────────────────────────

describe('startUpsellSequence', () => {
  it("returns schedule with 2 steps in 'plan' mode", async () => {
    const result = await startUpsellSequence({
      email: 'u@e.com',
      name: 'Muhammad',
      currentPlan: 'free',
      upgradeUrl: 'https://app.com/upgrade',
      mode: 'plan',
    });
    expect(result.success).toBe(true);
    expect(result.data.schedule).toHaveLength(2);
    expect(result.data.schedule[0].name).toBe('value-proposition');
    expect(result.data.schedule[1].delayMs).toBe(DELAYS.days(3));
  });

  it('targets enterprise when currentPlan is pro', async () => {
    const result = await startUpsellSequence({
      email: 'u@e.com',
      name: 'M',
      currentPlan: 'pro',
      mode: 'plan',
    });
    expect(result.success).toBe(true);
  });

  it("sends first email immediately in 'inline' mode", async () => {
    await startUpsellSequence({ email: 'u@e.com', name: 'Muhammad', mode: 'inline' });
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('returns failure on invalid email', async () => {
    const result = await startUpsellSequence({ email: 'not-email', name: 'M', mode: 'plan' });
    expect(result.success).toBe(false);
  });
});
