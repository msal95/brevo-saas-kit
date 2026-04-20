import { z } from 'zod';

const schema = z.object({
  BREVO_API_KEY: z.string().min(1, 'BREVO_API_KEY is required'),
  BREVO_SENDER_EMAIL: z.string().email('BREVO_SENDER_EMAIL must be a valid email'),
  BREVO_SENDER_NAME: z.string().min(1, 'BREVO_SENDER_NAME is required'),
  BREVO_WEBHOOK_SECRET: z.string().optional(),
  BREVO_LIST_FREE: z.coerce.number().int().positive().optional(),
  BREVO_LIST_PRO: z.coerce.number().int().positive().optional(),
  BREVO_LIST_ENTERPRISE: z.coerce.number().int().positive().optional(),
  REDIS_URL: z.string().optional(),
});

/**
 * Validate environment variables against required schema.
 * @param {NodeJS.ProcessEnv} [env] - Env object to validate (defaults to process.env)
 * @returns {{ success: true, data: object } | { success: false, error: string }}
 */
export function validateEnv(env = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  ${String(i.path[0])}: ${i.message}`)
      .join('\n');
    const msg = `[brevo-saas-automation] Invalid environment variables:\n${issues}`;
    console.error(msg);
    return { success: false, error: msg };
  }
  return { success: true, data: result.data };
}

/**
 * Validate env vars and throw on failure. Use at app startup to fail fast.
 * @param {NodeJS.ProcessEnv} [env] - Env object to validate (defaults to process.env)
 * @returns {object} Parsed and validated env vars
 * @throws {Error} If any required variable is missing or invalid
 */
export function requireEnv(env = process.env) {
  const result = validateEnv(env);
  if (!result.success) throw new Error(result.error);
  return result.data;
}
