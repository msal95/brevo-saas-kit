import { z } from 'zod';
import { sendEmail } from './sendEmail.js';
import { layout, heading, para, btn } from './html.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  previousRole: z.string().min(1),
  newRole: z.string().min(1),
  changedBy: z.string().optional(),
  dashboardUrl: z.string().url().optional(),
  appName: z.string().optional(),
});

function buildHtml({ name, previousRole, newRole, changedBy, dashboardUrl, appName }) {
  const app = appName ?? 'your account';
  const actor = changedBy ? ` by ${changedBy}` : '';
  const body = [
    heading('Your role has been updated'),
    para(`Hi ${name}, your role in ${app} has been changed${actor}.`),
    `<table cellpadding="0" cellspacing="0" style="margin:24px 0;width:100%;">
      <tr>
        <td style="background:#f9fafb;border-radius:8px;padding:20px 24px;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:12px;">
            <span style="background:#e5e7eb;padding:6px 14px;border-radius:20px;font-size:14px;color:#374151;font-weight:600;">${previousRole}</span>
            <span style="font-size:20px;color:#9ca3af;">→</span>
            <span style="background:#dbeafe;padding:6px 14px;border-radius:20px;font-size:14px;color:#1d4ed8;font-weight:600;">${newRole}</span>
          </div>
        </td>
      </tr>
    </table>`,
    para(`Your new role is <strong>${newRole}</strong>. You may have access to different features and permissions now.`),
    dashboardUrl ? btn('Go to Dashboard', dashboardUrl) : '',
    para(`If you believe this change was made in error, please contact your administrator.`),
  ].join('');

  return layout({
    title: 'Role Updated',
    preheader: `Your role has been changed from ${previousRole} to ${newRole}`,
    body,
  });
}

/**
 * Send a role change notification email.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {string} options.previousRole - The role before the change
 * @param {string} options.newRole - The role after the change
 * @param {string} [options.changedBy] - Name of admin who made the change
 * @param {string} [options.dashboardUrl] - URL to user's dashboard
 * @param {string} [options.appName] - Your app's display name
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendRoleChangeEmail(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendRoleChangeEmail validation failed: ${msg}` };
  }

  const { email, name, previousRole, newRole, changedBy, dashboardUrl, appName } = parsed.data;

  return sendEmail({
    to: email,
    subject: `Your role has been updated to ${newRole}`,
    htmlContent: buildHtml({ name, previousRole, newRole, changedBy, dashboardUrl, appName }),
  });
}
