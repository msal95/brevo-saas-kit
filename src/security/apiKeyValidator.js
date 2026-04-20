import { z } from 'zod';

const BREVO_ACCOUNT_URL = 'https://api.brevo.com/v3/account';

const schema = z.object({
  apiKey: z.string().min(1).optional(),
});

/**
 * Validate a Brevo API key by hitting the /account endpoint.
 * Returns account name and plan if valid.
 * @param {object} [options]
 * @param {string} [options.apiKey] - API key to validate (falls back to BREVO_API_KEY env var)
 * @returns {Promise<{success:boolean,data?:{valid:boolean,accountName:string,plan:string,email:string},error?:string}>}
 */
export async function validateApiKey({ apiKey } = {}) {
  const parsed = schema.safeParse({ apiKey });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `validateApiKey: invalid options — ${msg}` };
  }

  const key = parsed.data.apiKey ?? process.env.BREVO_API_KEY;

  if (!key) {
    return {
      success: false,
      error: 'validateApiKey: no API key provided and BREVO_API_KEY env var is not set',
    };
  }

  try {
    const response = await fetch(BREVO_ACCOUNT_URL, {
      method: 'GET',
      headers: {
        'api-key': key,
        'Accept': 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        success: true,
        data: { valid: false, accountName: '', plan: '', email: '' },
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `validateApiKey: Brevo API returned ${response.status}`,
      };
    }

    const body = await response.json();

    return {
      success: true,
      data: {
        valid: true,
        accountName: body.companyName ?? body.firstName ?? '',
        plan: _extractPlan(body),
        email: body.email ?? '',
      },
    };
  } catch (err) {
    return { success: false, error: `validateApiKey: request failed — ${err.message}` };
  }
}

function _extractPlan(body) {
  const plan = body.plan;
  if (!plan) return 'unknown';
  if (Array.isArray(plan)) return plan.map(p => p.type ?? p.planName ?? p).join(', ');
  if (typeof plan === 'object') return plan.type ?? plan.planName ?? 'unknown';
  return String(plan);
}
