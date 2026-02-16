/**
 * Base email layout template.
 *
 * All email templates wrap their content with this layout so that branding,
 * header, footer, and unsubscribe link are consistent across every email
 * sent from FinanceOwl.
 *
 * Design goals:
 *  - Inline CSS only (email-client safe)
 *  - Responsive with max-width: 600px
 *  - Dark mode friendly with FinanceOwl green (#10b981) accent
 *  - Unsubscribe link in footer
 */

export interface BaseLayoutOptions {
  title: string;
  preheader?: string;
  content: string;
  appUrl: string;
  settingsUrl: string;
  year?: number;
}

export function baseLayout(options: BaseLayoutOptions): string {
  const {
    title,
    preheader,
    content,
    appUrl,
    settingsUrl,
    year = new Date().getFullYear(),
  } = options;

  const preheaderBlock = preheader
    ? `<span style="display:none;font-size:1px;color:#1a1d2e;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;color:#e2e8f0;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheaderBlock}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0f1117;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:24px 0;border-bottom:1px solid #2d3748;">
              <a href="${escapeHtml(appUrl)}" style="font-size:24px;font-weight:700;color:#ffffff;text-decoration:none;">
                <span style="display:inline-block;width:32px;height:32px;background-color:#10b981;border-radius:8px;vertical-align:middle;margin-right:8px;text-align:center;line-height:32px;font-size:18px;">&#x1F989;</span>
                FinanceOwl
              </a>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 0;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding:24px 0;border-top:1px solid #2d3748;color:#718096;font-size:12px;line-height:1.6;">
              <p style="margin:0 0 8px 0;color:#718096;font-size:12px;">You received this email because you have notifications enabled in FinanceOwl.</p>
              <p style="margin:0 0 8px 0;">
                <a href="${escapeHtml(settingsUrl)}" style="color:#34d399;text-decoration:underline;">Manage notification preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(settingsUrl)}?unsubscribe=all" style="color:#34d399;text-decoration:underline;">Unsubscribe from all emails</a>
              </p>
              <p style="margin:0;color:#718096;font-size:12px;">&copy; ${year} FinanceOwl. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Shared helpers used by all templates ─────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Reusable card wrapper used by every template for content blocks.
 */
export function card(innerHtml: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1d2e;border:1px solid #2d3748;border-radius:12px;">
  <tr>
    <td style="padding:24px;">
      ${innerHtml}
    </td>
  </tr>
</table>`;
}

/**
 * Reusable CTA button.
 */
export function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
  <tr>
    <td style="background-color:#10b981;border-radius:8px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Horizontal divider.
 */
export function divider(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="border-top:1px solid #2d3748;padding:0;height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table>`;
}

/**
 * Badge (colored label).
 */
export function badge(
  text: string,
  variant: 'info' | 'warning' | 'danger' | 'success' = 'info',
): string {
  const colors: Record<string, { bg: string; fg: string }> = {
    info: { bg: 'rgba(16,185,129,0.15)', fg: '#34d399' },
    warning: { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24' },
    danger: { bg: 'rgba(239,68,68,0.15)', fg: '#f87171' },
    success: { bg: 'rgba(16,185,129,0.15)', fg: '#34d399' },
  };
  const c = colors[variant];
  return `<span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500;background-color:${c.bg};color:${c.fg};">${escapeHtml(text)}</span>`;
}

/**
 * Key/value stats row (for use inside a table).
 */
export function statsRow(label: string, value: string, valueColor?: string): string {
  const vc = valueColor ?? '#ffffff';
  return `<tr>
  <td style="padding:8px 0;font-size:13px;color:#a0aec0;">${escapeHtml(label)}</td>
  <td style="padding:8px 0;font-size:13px;font-weight:500;color:${vc};text-align:right;">${value}</td>
</tr>`;
}

export function statsTable(rows: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">${rows}</table>`;
}
