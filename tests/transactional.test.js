import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from '../src/transactional/sendEmail.js';
import { sendTemplateEmail } from '../src/transactional/sendTemplateEmail.js';
import { sendWelcomeEmail } from '../src/transactional/welcome.js';
import { sendVerificationEmail } from '../src/transactional/emailVerification.js';
import { sendPasswordResetEmail } from '../src/transactional/passwordReset.js';
import { sendInvoiceEmail } from '../src/transactional/invoice.js';
import { sendAccountDeletionEmail } from '../src/transactional/accountDeletion.js';
import { sendRoleChangeEmail } from '../src/transactional/roleChange.js';

const mockSendTransacEmail = vi.fn();

vi.mock('@getbrevo/brevo', () => {
  class TransactionalEmailsApi {
    authentications = { apiKey: { apiKey: '' } };
    sendTransacEmail = mockSendTransacEmail;
  }
  class SendSmtpEmail {}
  return { TransactionalEmailsApi, SendSmtpEmail };
});

vi.mock('../src/config/brevoClient.js', () => ({
  getTransactionalApi: vi.fn(() => ({
    sendTransacEmail: mockSendTransacEmail,
  })),
  getSenderConfig: vi.fn(() => ({ email: 'sender@app.com', name: 'TestApp' })),
}));

beforeEach(() => {
  mockSendTransacEmail.mockReset();
  mockSendTransacEmail.mockResolvedValue({ body: { messageId: '<msg-123@brevo.com>' } });
});

// ─── sendEmail ───────────────────────────────────────────────────────────────

describe('sendEmail', () => {
  it('returns success with messageId on valid input', async () => {
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      htmlContent: '<p>Hello</p>',
    });
    expect(result.success).toBe(true);
    expect(result.data.messageId).toBe('<msg-123@brevo.com>');
    expect(mockSendTransacEmail).toHaveBeenCalledOnce();
  });

  it('accepts array of recipients', async () => {
    const result = await sendEmail({
      to: [{ email: 'a@example.com', name: 'A' }, { email: 'b@example.com' }],
      subject: 'Hello',
      htmlContent: '<p>Hi</p>',
    });
    expect(result.success).toBe(true);
  });

  it('returns failure on missing subject', async () => {
    const result = await sendEmail({ to: 'user@example.com', htmlContent: '<p>x</p>' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('validation failed');
  });

  it('returns failure on invalid email', async () => {
    const result = await sendEmail({ to: 'not-an-email', subject: 'Hi', htmlContent: '<p>x</p>' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('validation failed');
  });

  it('returns failure when Brevo API throws', async () => {
    mockSendTransacEmail.mockRejectedValue({
      response: { body: { message: 'API rate limit exceeded' } },
    });
    const result = await sendEmail({ to: 'u@e.com', subject: 'Hi', htmlContent: '<p>x</p>' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('API rate limit exceeded');
  });

  it('passes optional fields through to Brevo', async () => {
    await sendEmail({
      to: 'u@e.com',
      subject: 'Hi',
      htmlContent: '<p>x</p>',
      textContent: 'x',
      replyTo: { email: 'reply@app.com' },
      tags: ['welcome'],
    });
    expect(mockSendTransacEmail).toHaveBeenCalledOnce();
  });
});

// ─── sendTemplateEmail ───────────────────────────────────────────────────────

describe('sendTemplateEmail', () => {
  it('returns success with valid templateId', async () => {
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 5,
      params: { NAME: 'Muhammad' },
    });
    expect(result.success).toBe(true);
    expect(result.data.messageId).toBeDefined();
  });

  it('returns failure if templateId is not a positive integer', async () => {
    const result = await sendTemplateEmail({ to: 'u@e.com', templateId: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('validation failed');
  });

  it('returns failure if to is missing', async () => {
    const result = await sendTemplateEmail({ templateId: 5 });
    expect(result.success).toBe(false);
  });
});

// ─── sendWelcomeEmail ────────────────────────────────────────────────────────

describe('sendWelcomeEmail', () => {
  it('sends successfully with minimal required fields', async () => {
    const result = await sendWelcomeEmail({ email: 'u@e.com', name: 'Muhammad' });
    expect(result.success).toBe(true);
    expect(mockSendTransacEmail).toHaveBeenCalledOnce();
  });

  it('includes dashboard URL in email when provided', async () => {
    const result = await sendWelcomeEmail({
      email: 'u@e.com',
      name: 'Muhammad',
      dashboardUrl: 'https://app.com/dashboard',
      appName: 'MyApp',
    });
    expect(result.success).toBe(true);
    const [[arg]] = mockSendTransacEmail.mock.calls;
    expect(arg.htmlContent).toContain('https://app.com/dashboard');
    expect(arg.htmlContent).toContain('MyApp');
  });

  it('returns failure on invalid email', async () => {
    const result = await sendWelcomeEmail({ email: 'bad', name: 'X' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('validation failed');
  });
});

// ─── sendVerificationEmail ───────────────────────────────────────────────────

describe('sendVerificationEmail', () => {
  it('sends OTP successfully', async () => {
    const result = await sendVerificationEmail({
      email: 'u@e.com',
      name: 'Muhammad',
      otp: '847291',
    });
    expect(result.success).toBe(true);
    const [[arg]] = mockSendTransacEmail.mock.calls;
    expect(arg.htmlContent).toContain('847291');
  });

  it('uses custom expiry minutes in email body', async () => {
    await sendVerificationEmail({ email: 'u@e.com', name: 'M', otp: '1234', expiresInMinutes: 5 });
    const [[arg]] = mockSendTransacEmail.mock.calls;
    expect(arg.htmlContent).toContain('5 minutes');
  });

  it('returns failure if otp is missing', async () => {
    const result = await sendVerificationEmail({ email: 'u@e.com', name: 'M' });
    expect(result.success).toBe(false);
  });
});

// ─── sendPasswordResetEmail ──────────────────────────────────────────────────

describe('sendPasswordResetEmail', () => {
  it('sends reset email with link', async () => {
    const result = await sendPasswordResetEmail({
      email: 'u@e.com',
      name: 'Muhammad',
      resetUrl: 'https://app.com/reset?token=abc',
    });
    expect(result.success).toBe(true);
    const [[arg]] = mockSendTransacEmail.mock.calls;
    expect(arg.htmlContent).toContain('https://app.com/reset?token=abc');
  });

  it('returns failure if resetUrl is not a valid URL', async () => {
    const result = await sendPasswordResetEmail({
      email: 'u@e.com',
      name: 'M',
      resetUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

// ─── sendInvoiceEmail ────────────────────────────────────────────────────────

describe('sendInvoiceEmail', () => {
  const lineItems = [
    { description: 'Pro Plan', quantity: 1, unitPrice: 29.0, total: 29.0 },
  ];

  it('sends invoice with line items', async () => {
    const result = await sendInvoiceEmail({
      email: 'u@e.com',
      name: 'Muhammad',
      invoiceNumber: 'INV-001',
      invoiceDate: 'April 20, 2026',
      lineItems,
      totalAmount: 29.0,
    });
    expect(result.success).toBe(true);
    const [[arg]] = mockSendTransacEmail.mock.calls;
    expect(arg.htmlContent).toContain('INV-001');
    expect(arg.htmlContent).toContain('Pro Plan');
  });

  it('returns failure if lineItems is empty', async () => {
    const result = await sendInvoiceEmail({
      email: 'u@e.com',
      name: 'M',
      invoiceNumber: 'INV-001',
      invoiceDate: 'Today',
      lineItems: [],
      totalAmount: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── sendAccountDeletionEmail ─────────────────────────────────────────────────

describe('sendAccountDeletionEmail', () => {
  it('sends deletion confirmation', async () => {
    const result = await sendAccountDeletionEmail({ email: 'u@e.com', name: 'Muhammad' });
    expect(result.success).toBe(true);
    const [[arg]] = mockSendTransacEmail.mock.calls;
    expect(arg.htmlContent).toContain('permanently deleted');
  });

  it('includes feedback URL when provided', async () => {
    await sendAccountDeletionEmail({
      email: 'u@e.com',
      name: 'M',
      feedbackUrl: 'https://forms.app/feedback',
    });
    const [[arg]] = mockSendTransacEmail.mock.calls;
    expect(arg.htmlContent).toContain('https://forms.app/feedback');
  });
});

// ─── sendRoleChangeEmail ──────────────────────────────────────────────────────

describe('sendRoleChangeEmail', () => {
  it('sends role change notification', async () => {
    const result = await sendRoleChangeEmail({
      email: 'u@e.com',
      name: 'Muhammad',
      previousRole: 'member',
      newRole: 'admin',
    });
    expect(result.success).toBe(true);
    const [[arg]] = mockSendTransacEmail.mock.calls;
    expect(arg.htmlContent).toContain('member');
    expect(arg.htmlContent).toContain('admin');
  });

  it('returns failure if previousRole is missing', async () => {
    const result = await sendRoleChangeEmail({ email: 'u@e.com', name: 'M', newRole: 'admin' });
    expect(result.success).toBe(false);
  });
});
