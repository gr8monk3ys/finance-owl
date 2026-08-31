/**
 * Welcome email template.
 *
 * Sent when a new user creates their FinanceOwl account.
 * Includes a greeting, getting started steps, and feature highlights.
 */

import { baseLayout, card, ctaButton, divider, escapeHtml } from './base-layout.template';

export interface WelcomeData {
  userName: string;
  appUrl: string;
  settingsUrl: string;
}

export function welcomeHtml(data: WelcomeData): string {
  const { userName, appUrl, settingsUrl } = data;

  const steps = [
    {
      number: '1',
      title: 'Connect Your Accounts',
      description:
        'Link your bank accounts, credit cards, and investment accounts for a complete financial picture.',
      icon: '&#x1F3E6;',
    },
    {
      number: '2',
      title: 'Set Up Budgets',
      description:
        'Create spending budgets for different categories to stay on track with your financial goals.',
      icon: '&#x1F4CA;',
    },
    {
      number: '3',
      title: 'Configure Alerts',
      description:
        'Customize notifications for bill reminders, budget alerts, and unusual transactions.',
      icon: '&#x1F514;',
    },
  ];

  const stepsHtml = steps
    .map(
      (step) => `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td style="width:48px;vertical-align:top;padding-right:12px;">
          <div style="width:40px;height:40px;background-color:rgba(16,185,129,0.15);border-radius:10px;text-align:center;line-height:40px;font-size:18px;">
            ${step.icon}
          </div>
        </td>
        <td style="vertical-align:top;">
          <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0 0 4px 0;">
            Step ${step.number}: ${step.title}
          </p>
          <p style="color:#a0aec0;font-size:13px;line-height:1.5;margin:0;">
            ${step.description}
          </p>
        </td>
      </tr>
    </table>`,
    )
    .join('');

  const features = [
    { icon: '&#x1F4B0;', name: 'Smart Savings', description: 'AI-powered savings recommendations' },
    {
      icon: '&#x1F4C8;',
      name: 'Investment Tracking',
      description: 'Monitor your portfolio performance',
    },
    {
      icon: '&#x1F6E1;',
      name: 'Anomaly Detection',
      description: 'Get alerted to unusual transactions',
    },
    {
      icon: '&#x1F4DD;',
      name: 'Weekly Digests',
      description: 'Stay informed with financial summaries',
    },
  ];

  const featuresHtml = features
    .map(
      (f) => `
    <td align="center" style="padding:8px;width:25%;">
      <div style="font-size:24px;margin-bottom:4px;">${f.icon}</div>
      <p style="color:#ffffff;font-size:12px;font-weight:600;margin:0 0 2px 0;">${f.name}</p>
      <p style="color:#718096;font-size:11px;margin:0;">${f.description}</p>
    </td>`,
    )
    .join('');

  const content = card(`
    <h1 style="color:#ffffff;font-size:24px;font-weight:600;margin:0 0 8px 0;">
      Welcome to FinanceOwl, ${escapeHtml(userName)}! &#x1F389;
    </h1>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      You have taken the first step toward smarter financial management.
      FinanceOwl helps you track spending, manage budgets, and build wealth — all in one place.
    </p>

    ${divider()}

    <h2 style="color:#ffffff;font-size:18px;font-weight:600;margin:16px 0 16px 0;">Getting Started</h2>
    ${stepsHtml}

    ${divider()}

    <h2 style="color:#ffffff;font-size:18px;font-weight:600;margin:16px 0 16px 0;">Feature Highlights</h2>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        ${featuresHtml}
      </tr>
    </table>

    ${divider()}

    <p style="color:#cbd5e0;font-size:14px;line-height:1.6;margin:16px 0 0 0;">
      Ready to get started? Head to your dashboard and connect your first account.
    </p>

    ${ctaButton('Go to Dashboard', `${appUrl}/dashboard`)}
  `);

  return baseLayout({
    title: 'Welcome to FinanceOwl!',
    preheader: `Welcome, ${userName}! Your smarter financial journey starts here.`,
    content,
    appUrl,
    settingsUrl,
  });
}

export function welcomeText(data: WelcomeData): string {
  const { userName, appUrl, settingsUrl } = data;

  return [
    `Welcome to FinanceOwl, ${userName}!`,
    '====================================',
    '',
    'You have taken the first step toward smarter financial management.',
    'FinanceOwl helps you track spending, manage budgets, and build wealth -- all in one place.',
    '',
    'GETTING STARTED',
    '',
    '1. Connect Your Accounts',
    '   Link your bank accounts, credit cards, and investment accounts.',
    '',
    '2. Set Up Budgets',
    '   Create spending budgets for different categories.',
    '',
    '3. Configure Alerts',
    '   Customize notifications for bill reminders, budget alerts, and more.',
    '',
    'FEATURE HIGHLIGHTS',
    '',
    '  - Smart Savings: AI-powered savings recommendations',
    '  - Investment Tracking: Monitor your portfolio performance',
    '  - Anomaly Detection: Get alerted to unusual transactions',
    '  - Weekly Digests: Stay informed with financial summaries',
    '',
    `Go to Dashboard: ${appUrl}/dashboard`,
    '',
    '---',
    `Manage notification preferences: ${settingsUrl}`,
    `Unsubscribe: ${settingsUrl}?unsubscribe=all`,
  ].join('\n');
}
