import { z } from 'zod';
import { sendEmail } from './sendEmail.js';
import { layout, heading, para, tableRow } from './html.js';

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  currency: z.string().length(3).optional(),
  totalAmount: z.number().nonnegative(),
  paymentUrl: z.string().url().optional(),
  appName: z.string().optional(),
});

function buildLineItemsTable(items, currency) {
  const sym = currency ?? 'USD';
  const rows = items
    .map(
      i =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">${i.description}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:center;">${i.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:right;">${sym} ${i.unitPrice.toFixed(2)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;font-weight:600;text-align:right;">${sym} ${i.total.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <thead>
      <tr style="border-bottom:2px solid #e5e7eb;">
        <th style="text-align:left;padding-bottom:8px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Description</th>
        <th style="text-align:center;padding-bottom:8px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Qty</th>
        <th style="text-align:right;padding-bottom:8px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Unit Price</th>
        <th style="text-align:right;padding-bottom:8px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildHtml({ name, invoiceNumber, invoiceDate, lineItems, currency, totalAmount, paymentUrl, appName }) {
  const sym = currency ?? 'USD';
  const app = appName ?? 'us';
  const body = [
    heading(`Invoice #${invoiceNumber}`),
    para(`Hi ${name}, thank you for your purchase. Here is your invoice from ${app}.`),
    `<table cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tbody>
      ${tableRow('Invoice #', invoiceNumber)}
      ${tableRow('Date', invoiceDate)}
    </tbody></table>`,
    buildLineItemsTable(lineItems, sym),
    `<div style="text-align:right;padding:8px 0;border-top:2px solid #111827;">
      <span style="font-size:18px;font-weight:700;color:#111827;">${sym} ${totalAmount.toFixed(2)}</span>
    </div>`,
    paymentUrl
      ? `<div style="margin-top:24px;"><a href="${paymentUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;">Pay Now</a></div>`
      : '',
    para(`Keep this email as your receipt. If you have any questions, please reply to this email.`),
  ].join('');

  return layout({
    title: `Invoice #${invoiceNumber}`,
    preheader: `Your invoice #${invoiceNumber} for ${sym} ${totalAmount.toFixed(2)}`,
    body,
  });
}

/**
 * Send an invoice or payment receipt email with line items.
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient full name
 * @param {string} options.invoiceNumber - Invoice identifier
 * @param {string} options.invoiceDate - Human-readable invoice date
 * @param {Array<{description:string,quantity:number,unitPrice:number,total:number}>} options.lineItems
 * @param {number} options.totalAmount - Grand total amount
 * @param {string} [options.currency] - 3-letter currency code (default: USD)
 * @param {string} [options.paymentUrl] - URL to payment page if unpaid
 * @param {string} [options.appName] - Your app's display name
 * @returns {Promise<{success:boolean,data?:{messageId:string},error?:string}>}
 */
export async function sendInvoiceEmail(options) {
  const parsed = schema.safeParse(options);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return { success: false, error: `sendInvoiceEmail validation failed: ${msg}` };
  }

  const { email, invoiceNumber, ...rest } = parsed.data;

  return sendEmail({
    to: email,
    subject: `Invoice #${invoiceNumber}`,
    htmlContent: buildHtml({ invoiceNumber, ...rest }),
  });
}
