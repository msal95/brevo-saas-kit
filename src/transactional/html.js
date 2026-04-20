/**
 * Internal HTML email layout helpers. Not exported from the public API.
 */

/**
 * @param {string} text
 * @param {string} url
 * @returns {string}
 */
export function btn(text, url) {
  return (
    `<a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;` +
    `text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;` +
    `font-weight:600;margin:24px 0;">${text}</a>`
  );
}

/**
 * @param {string} text
 * @returns {string}
 */
export function heading(text) {
  return `<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">${text}</h1>`;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function para(text) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${text}</p>`;
}

/**
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
export function tableRow(label, value) {
  return (
    `<tr><td style="padding:8px 0;font-size:14px;color:#6b7280;width:140px;">${label}</td>` +
    `<td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;">${value}</td></tr>`
  );
}

/**
 * Wrap HTML content in the standard single-column email layout.
 * @param {object} options
 * @param {string} options.title - Document title
 * @param {string} options.preheader - Short preview text shown in inbox
 * @param {string} options.body - Inner HTML content
 * @param {string} [options.footerText] - Override default footer text
 * @returns {string} Complete HTML email string
 */
export function layout({ title, preheader, body, footerText }) {
  const footer = footerText ?? 'You received this email because you have an account with us.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.08);max-width:600px;">
        <tr><td style="padding:40px 48px;">
          ${body}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 48px;text-align:center;
          font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
