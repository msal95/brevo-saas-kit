/**
 * brevo-saas-automation
 * Production-grade Brevo email automation library for SaaS developers.
 *
 * Usage:
 *   import { initBrevo, sendWelcomeEmail, createContact } from 'brevo-saas-automation';
 *   initBrevo({ apiKey: process.env.BREVO_API_KEY, sender: { email: '...', name: '...' } });
 */

// ─── Initialization ───────────────────────────────────────────────────────────
export { initBrevo, getSenderConfig } from './src/config/brevoClient.js';
export { validateEnv, requireEnv } from './src/config/envValidator.js';
export { WEBHOOK_EVENTS, CONTACT_PLANS, EMAIL_DEFAULTS } from './src/config/constants.js';

// ─── Transactional Emails ─────────────────────────────────────────────────────
export { sendEmail } from './src/transactional/sendEmail.js';
export { sendTemplateEmail } from './src/transactional/sendTemplateEmail.js';
export { sendWelcomeEmail } from './src/transactional/welcome.js';
export { sendVerificationEmail } from './src/transactional/emailVerification.js';
export { sendPasswordResetEmail } from './src/transactional/passwordReset.js';
export { sendInvoiceEmail } from './src/transactional/invoice.js';
export { sendAccountDeletionEmail } from './src/transactional/accountDeletion.js';
export { sendRoleChangeEmail } from './src/transactional/roleChange.js';

// ─── Contact Management ───────────────────────────────────────────────────────
export { createContact } from './src/contacts/createContact.js';
export { updateContact } from './src/contacts/updateContact.js';
export { deleteContact } from './src/contacts/deleteContact.js';
export { tagContact } from './src/contacts/tagContact.js';
export { segmentContact } from './src/contacts/segmentContact.js';
export { bulkSyncContacts } from './src/contacts/bulkSync.js';

// ─── Workflows ────────────────────────────────────────────────────────────────
export { defineWorkflow, getWorkflowSchedule, executeWorkflowStep, startWorkflow, DELAYS } from './src/workflows/workflowRunner.js';
export { startOnboardingSequence } from './src/workflows/onboarding.js';
export { scheduleTrialReminders } from './src/workflows/trialExpiry.js';
export { startReEngagementSequence } from './src/workflows/reEngagement.js';
export { sendFeatureAnnouncement } from './src/workflows/featureAnnouncement.js';
export { startUpsellSequence } from './src/workflows/upsell.js';

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export { verifyWebhookSignature, verifyWebhookSignatureFromEnv } from './src/webhooks/verifySignature.js';
export { routeWebhookEvent } from './src/webhooks/eventRouter.js';
export { handleOpened } from './src/webhooks/handlers/opened.js';
export { handleClicked } from './src/webhooks/handlers/clicked.js';
export { handleBounced } from './src/webhooks/handlers/bounced.js';
export { handleSpam } from './src/webhooks/handlers/spam.js';
export { handleUnsubscribed } from './src/webhooks/handlers/unsubscribed.js';

// ─── Queue ────────────────────────────────────────────────────────────────────
export { initQueue, queueEmail, getQueueMode } from './src/queue/emailQueue.js';
export { withRetry, getBackoffDelay, buildQueueRetryOptions } from './src/queue/retryStrategy.js';
export { getQueueHealth, pingQueue } from './src/queue/queueMonitor.js';

// ─── Analytics ────────────────────────────────────────────────────────────────
export { getCampaignStats } from './src/analytics/campaignStats.js';
export { getContactEngagement } from './src/analytics/contactEngagement.js';
export { exportStats } from './src/analytics/exportStats.js';

// ─── Security ─────────────────────────────────────────────────────────────────
export { createRateLimiter } from './src/security/rateLimiter.js';
export { sanitizeSubject, sanitizeName, sanitizeHtml, sanitizeEmailOptions } from './src/security/inputSanitizer.js';
export { validateApiKey } from './src/security/apiKeyValidator.js';

// ─── GDPR ─────────────────────────────────────────────────────────────────────
export { eraseContact } from './src/gdpr/rightToErasure.js';
export { logConsent, verifyConsentSignature, CONSENT_TYPES } from './src/gdpr/consentLogger.js';
export { unsubscribeContact } from './src/gdpr/unsubscribeHandler.js';
