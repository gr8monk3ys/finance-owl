/**
 * Security Alert email template.
 *
 * Sent for security-related events such as new device logins,
 * password changes, 2FA changes, failed login attempts, etc.
 * These are always sent regardless of user notification preferences.
 */

import {
  baseLayout,
  card,
  ctaButton,
  divider,
  badge,
  statsTable,
  statsRow,
  escapeHtml,
} from './base-layout.template';

export interface SecurityAlertData {
  eventType: string;
  eventTitle: string;
  details: string;
  device?: string;
  ipAddress?: string;
  location?: string;
  timestamp: string;
  appUrl: string;
  settingsUrl: string;
}

export function securityAlertHtml(data: SecurityAlertData): string {
  const {
    eventTitle,
    details,
    device,
    ipAddress,
    location,
    timestamp,
    appUrl,
    settingsUrl,
  } = data;

  const formattedTime = formatTimestamp(timestamp);

  let deviceInfoRows = statsRow('Time', formattedTime);
  if (device) {
    deviceInfoRows += statsRow('Device', escapeHtml(device));
  }
  if (ipAddress) {
    deviceInfoRows += statsRow('IP Address', escapeHtml(ipAddress));
  }
  if (location) {
    deviceInfoRows += statsRow('Location', escapeHtml(location));
  }

  const content = card(`
    <div style="margin-bottom:16px;">
      ${badge('Security Alert', 'danger')}
    </div>

    <h1 style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 8px 0;">${escapeHtml(eventTitle)}</h1>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
      ${escapeHtml(details)}
    </p>

    ${divider()}

    ${statsTable(deviceInfoRows)}

    ${divider()}

    <!-- Warning box -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="padding:16px;background-color:rgba(239,68,68,0.08);border-radius:8px;border-left:3px solid #ef4444;">
          <p style="color:#f87171;font-size:14px;font-weight:600;margin:0 0 8px 0;">
            If this wasn't you
          </p>
          <p style="color:#cbd5e0;font-size:13px;line-height:1.6;margin:0;">
            Change your password immediately and review your recent account activity.
            If you have two-factor authentication disabled, enable it now for additional security.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
      <tr>
        <td>
          ${ctaButton('Review Account Security', `${appUrl}/settings/security`)}
        </td>
      </tr>
    </table>
  `);

  return baseLayout({
    title: `Security Alert: ${eventTitle}`,
    preheader: `Security: ${eventTitle} - ${details}`,
    content,
    appUrl,
    settingsUrl,
  });
}

export function securityAlertText(data: SecurityAlertData): string {
  const {
    eventTitle,
    details,
    device,
    ipAddress,
    location,
    timestamp,
    appUrl,
    settingsUrl,
  } = data;

  const formattedTime = formatTimestamp(timestamp);
  const lines: string[] = [
    `Security Alert: ${eventTitle}`,
    '================================',
    '',
    details,
    '',
    `Time: ${formattedTime}`,
  ];

  if (device) lines.push(`Device: ${device}`);
  if (ipAddress) lines.push(`IP Address: ${ipAddress}`);
  if (location) lines.push(`Location: ${location}`);

  lines.push(
    '',
    "IF THIS WASN'T YOU:",
    'Change your password immediately and review your recent account activity.',
    'If you have two-factor authentication disabled, enable it now.',
    '',
    `Review Account Security: ${appUrl}/settings/security`,
    '',
    '---',
    `Manage notification preferences: ${settingsUrl}`,
    `Unsubscribe: ${settingsUrl}?unsubscribe=all`,
  );

  return lines.join('\n');
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return timestamp;
  }
}
