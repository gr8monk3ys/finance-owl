/**
 * Weekly Digest email template.
 *
 * Sent once per week summarising the user's financial activity:
 * - Total income / expenses / net
 * - Top 5 spending categories
 * - Upcoming bills for the coming week
 * - Budget status summary
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

export interface WeeklyDigestCategory {
  name: string;
  amount: number;
}

export interface WeeklyDigestBill {
  name: string;
  amount: number;
  dueDate: string;
}

export interface WeeklyDigestBudgetStatus {
  name: string;
  spent: number;
  limit: number;
  percentUsed: number;
}

export interface WeeklyDigestData {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  topCategories: WeeklyDigestCategory[];
  upcomingBills: WeeklyDigestBill[];
  budgetStatuses: WeeklyDigestBudgetStatus[];
  appUrl: string;
  settingsUrl: string;
}

export function weeklyDigestHtml(data: WeeklyDigestData): string {
  const {
    totalIncome,
    totalExpenses,
    net,
    topCategories,
    upcomingBills,
    budgetStatuses,
    appUrl,
    settingsUrl,
  } = data;

  // ── Summary card ──────────────────────────────────────────────────
  const netColor = net >= 0 ? '#34d399' : '#f87171';
  const netSign = net >= 0 ? '+' : '';

  const summarySection = `
    <div style="margin-bottom:16px;">
      ${badge('Weekly Summary', 'info')}
    </div>

    <h1 style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 8px 0;">Your Weekly Spending Summary</h1>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
      Here is an overview of your finances for the past week.
    </p>

    ${divider()}

    <!-- Income / Expenses / Net -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:8px;width:33%;">
          <p style="color:#718096;font-size:11px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;">Income</p>
          <p style="font-size:18px;font-weight:700;color:#34d399;margin:0;">${formatCurrency(totalIncome)}</p>
        </td>
        <td align="center" style="padding:8px;width:33%;">
          <p style="color:#718096;font-size:11px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;">Expenses</p>
          <p style="font-size:18px;font-weight:700;color:#f87171;margin:0;">${formatCurrency(totalExpenses)}</p>
        </td>
        <td align="center" style="padding:8px;width:34%;">
          <p style="color:#718096;font-size:11px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;">Net</p>
          <p style="font-size:18px;font-weight:700;color:${netColor};margin:0;">${netSign}${formatCurrency(Math.abs(net))}</p>
        </td>
      </tr>
    </table>
  `;

  // ── Top categories ────────────────────────────────────────────────
  let categoriesSection = '';
  if (topCategories.length > 0) {
    const rows = topCategories
      .map((cat) => statsRow(cat.name, formatCurrency(cat.amount)))
      .join('');

    categoriesSection = `
      ${divider()}
      <h2 style="color:#ffffff;font-size:18px;font-weight:600;margin:0 0 12px 0;">Top Spending Categories</h2>
      ${statsTable(rows)}
    `;
  }

  // ── Upcoming bills ────────────────────────────────────────────────
  let billsSection = '';
  if (upcomingBills.length > 0) {
    const rows = upcomingBills
      .map((bill) =>
        statsRow(
          `${bill.name} (${formatDate(bill.dueDate)})`,
          formatCurrency(bill.amount),
        ),
      )
      .join('');

    billsSection = `
      ${divider()}
      <h2 style="color:#ffffff;font-size:18px;font-weight:600;margin:0 0 12px 0;">Upcoming Bills This Week</h2>
      ${statsTable(rows)}
    `;
  }

  // ── Budget status ─────────────────────────────────────────────────
  let budgetSection = '';
  if (budgetStatuses.length > 0) {
    const budgetRows = budgetStatuses
      .map((b) => {
        const pct = Math.round(b.percentUsed);
        const pctCapped = Math.min(pct, 100);
        let color = '#10b981';
        if (pct >= 100) color = '#ef4444';
        else if (pct >= 80) color = '#f59e0b';

        return `<tr>
          <td style="padding:6px 0;font-size:13px;color:#a0aec0;">${escapeHtml(b.name)}</td>
          <td style="padding:6px 0;font-size:13px;color:#ffffff;text-align:right;">${formatCurrency(b.spent)} / ${formatCurrency(b.limit)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0 0 8px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#2d3748;border-radius:4px;">
              <tr>
                <td style="height:6px;width:${pctCapped}%;background-color:${color};border-radius:4px;">&nbsp;</td>
                ${pctCapped < 100 ? '<td style="height:6px;">&nbsp;</td>' : ''}
              </tr>
            </table>
          </td>
        </tr>`;
      })
      .join('');

    budgetSection = `
      ${divider()}
      <h2 style="color:#ffffff;font-size:18px;font-weight:600;margin:0 0 12px 0;">Budget Status</h2>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
        ${budgetRows}
      </table>
    `;
  }

  const content = card(`
    ${summarySection}
    ${categoriesSection}
    ${billsSection}
    ${budgetSection}
    ${divider()}
    ${ctaButton('View Dashboard', `${appUrl}/dashboard`)}
  `);

  return baseLayout({
    title: 'Your Weekly Spending Summary',
    preheader: `Income: ${formatCurrency(totalIncome)} | Expenses: ${formatCurrency(totalExpenses)} | Net: ${netSign}${formatCurrency(Math.abs(net))}`,
    content,
    appUrl,
    settingsUrl,
  });
}

export function weeklyDigestText(data: WeeklyDigestData): string {
  const {
    totalIncome,
    totalExpenses,
    net,
    topCategories,
    upcomingBills,
    budgetStatuses,
    appUrl,
    settingsUrl,
  } = data;

  const netSign = net >= 0 ? '+' : '-';
  const lines: string[] = [
    'Your Weekly Spending Summary',
    '============================',
    '',
    `Income:   ${formatCurrency(totalIncome)}`,
    `Expenses: ${formatCurrency(totalExpenses)}`,
    `Net:      ${netSign}${formatCurrency(Math.abs(net))}`,
  ];

  if (topCategories.length > 0) {
    lines.push('', 'Top Spending Categories:');
    for (const cat of topCategories) {
      lines.push(`  - ${cat.name}: ${formatCurrency(cat.amount)}`);
    }
  }

  if (upcomingBills.length > 0) {
    lines.push('', 'Upcoming Bills This Week:');
    for (const bill of upcomingBills) {
      lines.push(
        `  - ${bill.name}: ${formatCurrency(bill.amount)} (due ${formatDate(bill.dueDate)})`,
      );
    }
  }

  if (budgetStatuses.length > 0) {
    lines.push('', 'Budget Status:');
    for (const b of budgetStatuses) {
      const pct = Math.round(b.percentUsed);
      lines.push(
        `  - ${b.name}: ${formatCurrency(b.spent)} / ${formatCurrency(b.limit)} (${pct}%)`,
      );
    }
  }

  lines.push(
    '',
    `View Dashboard: ${appUrl}/dashboard`,
    '',
    '---',
    `Manage notification preferences: ${settingsUrl}`,
    `Unsubscribe: ${settingsUrl}?unsubscribe=all`,
  );

  return lines.join('\n');
}
