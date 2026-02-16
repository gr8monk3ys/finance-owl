/**
 * Budget Alert email template.
 *
 * Sent when a user's spending in a budget category reaches
 * 75%, 90%, or 100% of their configured limit.
 */

import {
  baseLayout,
  card,
  ctaButton,
  divider,
  badge,
  formatCurrency,
  escapeHtml,
} from './base-layout.template';

export interface BudgetAlertData {
  budgetName: string;
  amountSpent: number;
  budgetLimit: number;
  percentUsed: number;
  appUrl: string;
  settingsUrl: string;
}

export function budgetAlertHtml(data: BudgetAlertData): string {
  const { budgetName, amountSpent, budgetLimit, percentUsed, appUrl, settingsUrl } = data;
  const formattedSpent = formatCurrency(amountSpent);
  const formattedLimit = formatCurrency(budgetLimit);
  const roundedPercent = Math.round(percentUsed);
  const percentCapped = Math.min(roundedPercent, 100);

  let progressColor: string;
  let badgeVariant: 'info' | 'warning' | 'danger';
  if (percentUsed >= 100) {
    progressColor = '#ef4444';
    badgeVariant = 'danger';
  } else if (percentUsed >= 80) {
    progressColor = '#f59e0b';
    badgeVariant = 'warning';
  } else {
    progressColor = '#10b981';
    badgeVariant = 'info';
  }

  const content = card(`
    <div style="margin-bottom:16px;">
      ${badge(percentUsed >= 100 ? 'Budget Exceeded' : 'Budget Alert', badgeVariant)}
    </div>

    <h1 style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 8px 0;">
      ${percentUsed >= 100 ? 'Budget Limit Exceeded' : 'Budget Threshold Reached'}
    </h1>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
      Your spending in <strong style="color:#ffffff;">${escapeHtml(budgetName)}</strong> has reached a significant threshold.
    </p>

    ${divider()}

    <!-- Amount display -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:16px 0;">
          <p style="color:#718096;font-size:13px;margin:0 0 4px 0;">Spent</p>
          <p style="font-size:28px;font-weight:700;color:${percentUsed >= 100 ? '#f87171' : '#ffffff'};margin:0;">${formattedSpent}</p>
          <p style="color:#718096;font-size:13px;margin:4px 0 0 0;">of ${formattedLimit} budget</p>
        </td>
      </tr>
    </table>

    <!-- Progress bar -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="padding:0 0 8px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#2d3748;border-radius:8px;">
            <tr>
              <td style="height:8px;width:${percentCapped}%;background-color:${progressColor};border-radius:8px;">&nbsp;</td>
              ${percentCapped < 100 ? `<td style="height:8px;">&nbsp;</td>` : ''}
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="right" style="padding:0;">
          ${badge(`${roundedPercent}% used`, badgeVariant)}
        </td>
      </tr>
    </table>

    ${divider()}

    <p style="color:#718096;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
      Consider reviewing your recent transactions in this category to stay on track.
    </p>

    ${ctaButton('View Budget', `${appUrl}/budgets`)}
  `);

  return baseLayout({
    title: `Budget Alert: ${budgetName}`,
    preheader: `${budgetName} budget at ${roundedPercent}% - ${formattedSpent} of ${formattedLimit}`,
    content,
    appUrl,
    settingsUrl,
  });
}

export function budgetAlertText(data: BudgetAlertData): string {
  const { budgetName, amountSpent, budgetLimit, percentUsed, appUrl, settingsUrl } = data;
  const formattedSpent = formatCurrency(amountSpent);
  const formattedLimit = formatCurrency(budgetLimit);
  const roundedPercent = Math.round(percentUsed);

  return [
    percentUsed >= 100 ? 'Budget Exceeded' : 'Budget Alert',
    '=============',
    '',
    `Your spending in ${budgetName} has reached ${roundedPercent}%.`,
    '',
    `Spent: ${formattedSpent}`,
    `Budget: ${formattedLimit}`,
    `Used: ${roundedPercent}%`,
    '',
    'Consider reviewing your recent transactions in this category to stay on track.',
    '',
    `View Budget: ${appUrl}/budgets`,
    '',
    '---',
    `Manage notification preferences: ${settingsUrl}`,
    `Unsubscribe: ${settingsUrl}?unsubscribe=all`,
  ].join('\n');
}
