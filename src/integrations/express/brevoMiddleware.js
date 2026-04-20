import { sendEmail } from '../../transactional/sendEmail.js';
import { sendTemplateEmail } from '../../transactional/sendTemplateEmail.js';
import { sendWelcomeEmail } from '../../transactional/welcome.js';
import { sendVerificationEmail } from '../../transactional/emailVerification.js';
import { sendPasswordResetEmail } from '../../transactional/passwordReset.js';
import { sendInvoiceEmail } from '../../transactional/invoice.js';
import { sendAccountDeletionEmail } from '../../transactional/accountDeletion.js';
import { sendRoleChangeEmail } from '../../transactional/roleChange.js';
import { createContact } from '../../contacts/createContact.js';
import { updateContact } from '../../contacts/updateContact.js';
import { deleteContact } from '../../contacts/deleteContact.js';
import { tagContact } from '../../contacts/tagContact.js';
import { segmentContact } from '../../contacts/segmentContact.js';
import { bulkSyncContacts } from '../../contacts/bulkSync.js';
import { startOnboardingSequence } from '../../workflows/onboarding.js';
import { scheduleTrialReminders } from '../../workflows/trialExpiry.js';
import { startReEngagementSequence } from '../../workflows/reEngagement.js';
import { sendFeatureAnnouncement } from '../../workflows/featureAnnouncement.js';
import { startUpsellSequence } from '../../workflows/upsell.js';
import { initBrevo } from '../../config/brevoClient.js';

const brevo = {
  sendEmail,
  sendTemplateEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInvoiceEmail,
  sendAccountDeletionEmail,
  sendRoleChangeEmail,
  createContact,
  updateContact,
  deleteContact,
  tagContact,
  segmentContact,
  bulkSyncContacts,
  startOnboardingSequence,
  scheduleTrialReminders,
  startReEngagementSequence,
  sendFeatureAnnouncement,
  startUpsellSequence,
};

/**
 * Express middleware that attaches all brevo-saas-automation functions to req.brevo.
 * Optionally initializes the Brevo client with explicit credentials.
 * Mount before any routes that need email/contact functionality.
 *
 * @param {object} [options]
 * @param {string} [options.apiKey] - Brevo API key (falls back to BREVO_API_KEY env var)
 * @param {{ email: string, name: string }} [options.sender] - Default sender (falls back to env vars)
 * @returns {(req: object, res: object, next: function) => void} Express middleware
 *
 * @example
 * app.use(brevoMiddleware({ apiKey: process.env.BREVO_API_KEY, sender: { email, name } }));
 * // Now available in all routes:
 * app.post('/signup', async (req, res) => {
 *   await req.brevo.sendWelcomeEmail({ email: req.body.email, name: req.body.name });
 * });
 */
export function brevoMiddleware(options = {}) {
  if (options.apiKey && options.sender) {
    initBrevo({ apiKey: options.apiKey, sender: options.sender });
  }
  return function attachBrevo(req, _res, next) {
    req.brevo = brevo;
    next();
  };
}
