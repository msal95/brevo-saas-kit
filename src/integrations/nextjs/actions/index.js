'use server';

import { sendWelcomeEmail as _sendWelcomeEmail } from '../../../transactional/welcome.js';
import { sendVerificationEmail as _sendVerificationEmail } from '../../../transactional/emailVerification.js';
import { sendPasswordResetEmail as _sendPasswordResetEmail } from '../../../transactional/passwordReset.js';
import { sendInvoiceEmail as _sendInvoiceEmail } from '../../../transactional/invoice.js';
import { sendAccountDeletionEmail as _sendAccountDeletionEmail } from '../../../transactional/accountDeletion.js';
import { sendRoleChangeEmail as _sendRoleChangeEmail } from '../../../transactional/roleChange.js';
import { createContact as _createContact } from '../../../contacts/createContact.js';
import { updateContact as _updateContact } from '../../../contacts/updateContact.js';
import { deleteContact as _deleteContact } from '../../../contacts/deleteContact.js';
import { tagContact as _tagContact } from '../../../contacts/tagContact.js';
import { segmentContact as _segmentContact } from '../../../contacts/segmentContact.js';
import { bulkSyncContacts as _bulkSyncContacts } from '../../../contacts/bulkSync.js';
import { startOnboardingSequence as _startOnboardingSequence } from '../../../workflows/onboarding.js';
import { scheduleTrialReminders as _scheduleTrialReminders } from '../../../workflows/trialExpiry.js';
import { startReEngagementSequence as _startReEngagementSequence } from '../../../workflows/reEngagement.js';
import { sendFeatureAnnouncement as _sendFeatureAnnouncement } from '../../../workflows/featureAnnouncement.js';
import { startUpsellSequence as _startUpsellSequence } from '../../../workflows/upsell.js';

// ─── Transactional ────────────────────────────────────────────────────────────

/** @param {Parameters<typeof _sendWelcomeEmail>[0]} options */
export async function sendWelcomeEmail(options) {
  return _sendWelcomeEmail(options);
}

/** @param {Parameters<typeof _sendVerificationEmail>[0]} options */
export async function sendVerificationEmail(options) {
  return _sendVerificationEmail(options);
}

/** @param {Parameters<typeof _sendPasswordResetEmail>[0]} options */
export async function sendPasswordResetEmail(options) {
  return _sendPasswordResetEmail(options);
}

/** @param {Parameters<typeof _sendInvoiceEmail>[0]} options */
export async function sendInvoiceEmail(options) {
  return _sendInvoiceEmail(options);
}

/** @param {Parameters<typeof _sendAccountDeletionEmail>[0]} options */
export async function sendAccountDeletionEmail(options) {
  return _sendAccountDeletionEmail(options);
}

/** @param {Parameters<typeof _sendRoleChangeEmail>[0]} options */
export async function sendRoleChangeEmail(options) {
  return _sendRoleChangeEmail(options);
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

/** @param {Parameters<typeof _createContact>[0]} options */
export async function createContact(options) {
  return _createContact(options);
}

/** @param {Parameters<typeof _updateContact>[0]} options */
export async function updateContact(options) {
  return _updateContact(options);
}

/** @param {Parameters<typeof _deleteContact>[0]} options */
export async function deleteContact(options) {
  return _deleteContact(options);
}

/** @param {Parameters<typeof _tagContact>[0]} options */
export async function tagContact(options) {
  return _tagContact(options);
}

/** @param {Parameters<typeof _segmentContact>[0]} options */
export async function segmentContact(options) {
  return _segmentContact(options);
}

/** @param {Parameters<typeof _bulkSyncContacts>[0]} options */
export async function bulkSyncContacts(options) {
  return _bulkSyncContacts(options);
}

// ─── Workflows ────────────────────────────────────────────────────────────────

/** @param {Parameters<typeof _startOnboardingSequence>[0]} options */
export async function startOnboardingSequence(options) {
  return _startOnboardingSequence(options);
}

/** @param {Parameters<typeof _scheduleTrialReminders>[0]} options */
export async function scheduleTrialReminders(options) {
  return _scheduleTrialReminders(options);
}

/** @param {Parameters<typeof _startReEngagementSequence>[0]} options */
export async function startReEngagementSequence(options) {
  return _startReEngagementSequence(options);
}

/** @param {Parameters<typeof _sendFeatureAnnouncement>[0]} options */
export async function sendFeatureAnnouncement(options) {
  return _sendFeatureAnnouncement(options);
}

/** @param {Parameters<typeof _startUpsellSequence>[0]} options */
export async function startUpsellSequence(options) {
  return _startUpsellSequence(options);
}
