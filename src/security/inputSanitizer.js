import { z } from 'zod';

// Tags that should be stripped entirely including their content
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'meta', 'link'];

// Attributes that can execute code
const DANGEROUS_ATTRS = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus',
  'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress'];

const subjectSchema = z.string().max(998); // RFC 5321 subject limit
const nameSchema    = z.string().max(255);

/**
 * Sanitize an email subject line.
 * Strips control characters, trims whitespace, enforces max length.
 * @param {string} subject
 * @returns {{ success: boolean, data?: string, error?: string }}
 */
export function sanitizeSubject(subject) {
  const parsed = subjectSchema.safeParse(subject);
  if (!parsed.success) {
    return { success: false, error: `sanitizeSubject: ${parsed.error.issues[0].message}` };
  }
  const clean = parsed.data
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars except \t \n \r
    .replace(/\r?\n/g, ' ')                              // collapse newlines to space
    .trim();
  return { success: true, data: clean };
}

/**
 * Sanitize a person's name for use in emails.
 * Strips tags and their content for dangerous tags (script, style), then strips
 * remaining HTML tags, trims whitespace, removes control characters.
 * @param {string} name
 * @returns {{ success: boolean, data?: string, error?: string }}
 */
export function sanitizeName(name) {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { success: false, error: `sanitizeName: ${parsed.error.issues[0].message}` };
  }
  let clean = parsed.data;
  // Remove dangerous tags with their content
  for (const tag of ['script', 'style', 'iframe']) {
    const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
    clean = clean.replace(re, '');
    const selfClose = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    clean = clean.replace(selfClose, '');
  }
  clean = clean
    .replace(/<[^>]*>/g, '')                             // strip remaining HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim();
  return { success: true, data: clean };
}

/**
 * Sanitize raw HTML email content.
 * Removes dangerous tags (script, iframe, form, etc.), strips event handler attributes,
 * and neutralizes javascript: protocol in href/src attributes.
 * Does not parse the full DOM — uses regex for zero-dependency safety pass.
 * @param {string} html
 * @returns {{ success: boolean, data?: string, error?: string }}
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string') {
    return { success: false, error: 'sanitizeHtml: input must be a string' };
  }

  let clean = html;

  // Remove dangerous tags and their content
  for (const tag of DANGEROUS_TAGS) {
    const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
    clean = clean.replace(re, '');
    const selfClose = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    clean = clean.replace(selfClose, '');
  }

  // Strip event handler attributes (on*)
  for (const attr of DANGEROUS_ATTRS) {
    const re = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    clean = clean.replace(re, '');
    const unquoted = new RegExp(`\\s${attr}\\s*=\\s*[^\\s>]+`, 'gi');
    clean = clean.replace(unquoted, '');
  }

  // Neutralize javascript: and data: in href/src
  clean = clean.replace(/(href|src)\s*=\s*["']\s*(javascript|data):/gi, '$1="#"');

  return { success: true, data: clean };
}

/**
 * Sanitize a full email options object in-place.
 * Runs sanitizeSubject on subject, sanitizeName on sender/recipient names,
 * and sanitizeHtml on htmlContent.
 * @param {object} emailOptions - Options object as passed to sendEmail()
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function sanitizeEmailOptions(emailOptions) {
  if (!emailOptions || typeof emailOptions !== 'object') {
    return { success: false, error: 'sanitizeEmailOptions: input must be an object' };
  }

  const out = { ...emailOptions };

  if (out.subject) {
    const r = sanitizeSubject(out.subject);
    if (!r.success) return r;
    out.subject = r.data;
  }

  if (out.htmlContent) {
    const r = sanitizeHtml(out.htmlContent);
    if (!r.success) return r;
    out.htmlContent = r.data;
  }

  return { success: true, data: out };
}
