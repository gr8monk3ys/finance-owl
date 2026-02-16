/**
 * Bill Reminder email template.
 *
 * Sent when a user has an upcoming bill within their configured
 * reminder window (default 3 days before due date).
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

export interface BillReminderData {
  billName: string;
  amount: number;
  dueDate: string;
  appUrl: string;
  settingsUrl: string;
}

export function billReminderHtml(data: BillReminderData): string {
  const { billName, amount, dueDate, appUrl, settingsUrl } = data;
  const formattedAmount = formatCurrency(amount);
  const formattedDate = formatDate(dueDate);

  const content = card(`
    <div style="margin-bottom:16px;">
      ${badge('Upcoming Bill', 'warning')}
    </div>

    <h1 style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 8px 0;">Bill Reminder</h1>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
      You have an upcoming bill that needs your attention.
    </p>

    ${divider()}

    ${statsTable(
      statsRow('Bill Name', escapeHtml(billName)) +
      statsRow('Amount', formattedAmount, '#fbbf24') +
      statsRow('Due Date', formattedDate)
    )}

    ${divider()}

    <p style="color:#718096;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
      Make sure you have enough funds in your account before the due date to avoid late fees.
    </p>

    ${ctaButton('View Bill', `${appUrl}/bills`)}
  `);

  return baseLayout({
    title: `Bill Reminder: ${billName}`,
    preheader: `${billName} - ${formattedAmount} due ${formattedDate}`,
    content,
    appUrl,
    settingsUrl,
  });
}

export function billReminderText(data: BillReminderData): string {
  const { billName, amount, dueDate, appUrl, settingsUrl } = data;
  const formattedAmount = formatCurrency(amount);
  const formattedDate = formatDate(dueDate);

  return [
    'Bill Reminder',
    '=============',
    '',
    'You have an upcoming bill that needs your attention.',
    '',
    `Bill Name: ${billName}`,
    `Amount: ${formattedAmount}`,
    `Due Date: ${formattedDate}`,
    '',
    'Make sure you have enough funds in your account before the due date to avoid late fees.',
    '',
    `View Bill: ${appUrl}/bills`,
    '',
    '---',
    `Manage notification preferences: ${settingsUrl}`,
    `Unsubscribe: ${settingsUrl}?unsubscribe=all`,
  ].join('\n');
}
