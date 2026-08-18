/**
 * Anomaly Alert email template.
 *
 * Sent when the system detects a transaction that deviates from the
 * user's normal spending patterns (unusual amount, unfamiliar merchant,
 * duplicate charge, etc.).
 */

import {
  baseLayout,
  card,
  ctaButton,
  divider,
  badge,
  statsTable,
  statsRow,
  formatCurrency,
  formatDate,
  escapeHtml,
} from './base-layout.template';

export interface AnomalyAlertData {
  merchantName: string;
  amount: number;
  date: string;
  reason: string;
  transactionId?: string;
  appUrl: string;
  settingsUrl: string;
}

export function anomalyAlertHtml(data: AnomalyAlertData): string {
  const { merchantName, amount, date, reason, transactionId, appUrl, settingsUrl } = data;
  const formattedAmount = formatCurrency(Math.abs(amount));
  const formattedDate = formatDate(date);
  const reviewUrl = transactionId
    ? `${appUrl}/transactions/${transactionId}`
    : `${appUrl}/transactions`;

  const content = card(`
    <div style="margin-bottom:16px;">
      ${badge('Unusual Activity', 'danger')}
    </div>

    <h1 style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 8px 0;">Unusual Transaction Detected</h1>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
      We noticed a transaction that looks different from your typical spending pattern.
    </p>

    ${divider()}

    ${statsTable(
      statsRow('Merchant', escapeHtml(merchantName)) +
        statsRow('Amount', formattedAmount, '#f87171') +
        statsRow('Date', formattedDate),
    )}

    ${divider()}

    <!-- Why it was flagged -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="padding:12px 16px;background-color:rgba(239,68,68,0.08);border-radius:8px;border-left:3px solid #ef4444;">
          <p style="color:#718096;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">Why this was flagged</p>
          <p style="color:#cbd5e0;font-size:14px;line-height:1.5;margin:0;">${escapeHtml(reason)}</p>
        </td>
      </tr>
    </table>

    <p style="color:#718096;font-size:13px;line-height:1.6;margin:16px 0 8px 0;">
      If you don't recognize this transaction, review it immediately and flag it if necessary.
    </p>

    ${ctaButton('Review Transaction', reviewUrl)}
  `);

  return baseLayout({
    title: `Unusual Transaction: ${merchantName}`,
    preheader: `Unusual ${formattedAmount} charge at ${merchantName} on ${formattedDate}`,
    content,
    appUrl,
    settingsUrl,
  });
}

export function anomalyAlertText(data: AnomalyAlertData): string {
  const { merchantName, amount, date, reason, transactionId, appUrl, settingsUrl } = data;
  const formattedAmount = formatCurrency(Math.abs(amount));
  const formattedDate = formatDate(date);
  const reviewUrl = transactionId
    ? `${appUrl}/transactions/${transactionId}`
    : `${appUrl}/transactions`;

  return [
    'Unusual Transaction Detected',
    '============================',
    '',
    `Merchant: ${merchantName}`,
    `Amount: ${formattedAmount}`,
    `Date: ${formattedDate}`,
    '',
    `Why this was flagged: ${reason}`,
    '',
    "If you don't recognize this transaction, review it immediately.",
    '',
    `Review Transaction: ${reviewUrl}`,
    '',
    '---',
    `Manage notification preferences: ${settingsUrl}`,
    `Unsubscribe: ${settingsUrl}?unsubscribe=all`,
  ].join('\n');
}
