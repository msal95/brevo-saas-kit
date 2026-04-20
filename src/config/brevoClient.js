import * as Brevo from '@getbrevo/brevo';

let _config = null;

/**
 * Initialize the Brevo client. Call once at app startup before using any functions.
 * Falls back to BREVO_API_KEY / BREVO_SENDER_EMAIL / BREVO_SENDER_NAME env vars if
 * not called explicitly.
 * @param {object} options
 * @param {string} options.apiKey - Brevo API key
 * @param {{ email: string, name: string }} options.sender - Default sender identity
 * @returns {{ success: true, data: object } | { success: false, error: string }}
 */
export function initBrevo({ apiKey, sender } = {}) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { success: false, error: '[brevo-saas-automation] initBrevo: apiKey is required' };
  }
  if (!sender?.email || !sender?.name) {
    return {
      success: false,
      error: '[brevo-saas-automation] initBrevo: sender.email and sender.name are required',
    };
  }
  _config = { apiKey: apiKey.trim(), sender };
  return { success: true, data: { sender } };
}

function resolveConfig() {
  if (_config) return _config;
  const apiKey = process.env.BREVO_API_KEY;
  const email = process.env.BREVO_SENDER_EMAIL;
  const name = process.env.BREVO_SENDER_NAME;
  if (!apiKey || !email || !name) {
    throw new Error(
      '[brevo-saas-automation] Not initialized. Call initBrevo() or set ' +
        'BREVO_API_KEY, BREVO_SENDER_EMAIL, and BREVO_SENDER_NAME env vars.'
    );
  }
  return { apiKey, sender: { email, name } };
}

/**
 * @returns {Brevo.TransactionalEmailsApi} Configured transactional emails API instance
 * @throws {Error} If not initialized and env vars are missing
 */
export function getTransactionalApi() {
  const { apiKey } = resolveConfig();
  const api = new Brevo.TransactionalEmailsApi();
  api.authentications['apiKey'].apiKey = apiKey;
  return api;
}

/**
 * @returns {Brevo.ContactsApi} Configured contacts API instance
 * @throws {Error} If not initialized and env vars are missing
 */
export function getContactsApi() {
  const { apiKey } = resolveConfig();
  const api = new Brevo.ContactsApi();
  api.authentications['apiKey'].apiKey = apiKey;
  return api;
}

/**
 * @returns {{ email: string, name: string }} Default sender configuration
 * @throws {Error} If not initialized and env vars are missing
 */
export function getSenderConfig() {
  return resolveConfig().sender;
}

/** Reset internal state. For testing only. */
export function _resetClient() {
  _config = null;
}
