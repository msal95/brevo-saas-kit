export const WEBHOOK_EVENTS = {
  OPENED: 'opened',
  CLICKED: 'clicked',
  HARD_BOUNCE: 'hard_bounce',
  SOFT_BOUNCE: 'soft_bounce',
  SPAM: 'spam',
  UNSUBSCRIBED: 'unsubscribed',
  DELIVERED: 'delivered',
  INVALID_EMAIL: 'invalid_email',
  DEFERRED: 'deferred',
};

export const CONTACT_PLANS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};

export const LIST_ENV_KEYS = {
  free: 'BREVO_LIST_FREE',
  pro: 'BREVO_LIST_PRO',
  enterprise: 'BREVO_LIST_ENTERPRISE',
};

export const EMAIL_DEFAULTS = {
  OTP_EXPIRY_MINUTES: 10,
  RESET_EXPIRY_HOURS: 1,
};

export const BULK_SYNC_CHUNK_SIZE = 150;
