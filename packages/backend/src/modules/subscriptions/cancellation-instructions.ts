export interface CancellationInfo {
  methods: string[];
  phone?: string;
  email?: string;
  website?: string;
  chatUrl?: string;
  steps: string[];
}

export const CANCELLATION_KNOWLEDGE_BASE: Record<string, CancellationInfo> = {
  netflix: {
    methods: ['self_service'],
    website: 'https://www.netflix.com/cancelplan',
    steps: [
      'Log in to your Netflix account at netflix.com',
      'Click on your profile icon in the top right corner',
      'Select "Account" from the dropdown menu',
      'Click "Cancel Membership" under the Membership & Billing section',
      'Confirm your cancellation by clicking "Finish Cancellation"',
      'You will retain access until the end of your current billing period',
    ],
  },

  spotify: {
    methods: ['self_service'],
    website: 'https://www.spotify.com/account/subscription/',
    steps: [
      'Log in to your Spotify account at spotify.com/account',
      'Scroll down to the "Your plan" section',
      'Click "Change plan"',
      'Scroll to the bottom and click "Cancel Premium"',
      'Confirm the cancellation when prompted',
      'Your Premium features will continue until the end of your billing cycle',
    ],
  },

  'amazon prime': {
    methods: ['self_service', 'chat'],
    website: 'https://www.amazon.com/mc/pipelines/cancelPrime',
    chatUrl: 'https://www.amazon.com/gp/help/customer/contact-us',
    steps: [
      'Go to amazon.com and sign in to your account',
      'Navigate to Account & Lists > Account > Prime Membership',
      'Click "Update, cancel and more" next to Manage Membership',
      'Select "End Membership" at the bottom of the page',
      'Follow the prompts to confirm cancellation',
      'You may be offered a reduced rate or pause option before final cancellation',
    ],
  },

  hulu: {
    methods: ['self_service'],
    website: 'https://secure.hulu.com/account',
    steps: [
      'Log in to your Hulu account at secure.hulu.com/account',
      'Click "Cancel" under Your Subscription',
      'Select a reason for cancelling',
      'Click "Continue to Cancel"',
      'Confirm by clicking "Cancel Subscription"',
      'You will keep access until the end of your billing period',
    ],
  },

  'disney+': {
    methods: ['self_service', 'chat'],
    website: 'https://www.disneyplus.com/account',
    chatUrl: 'https://help.disneyplus.com/csp',
    steps: [
      'Log in to Disney+ at disneyplus.com',
      'Click your profile avatar in the top right corner',
      'Select "Account"',
      'Under your subscription, click your plan name',
      'Select "Cancel Subscription"',
      'Follow the prompts to confirm your cancellation',
    ],
  },

  'hbo max': {
    methods: ['self_service'],
    website: 'https://www.max.com/settings/subscription',
    steps: [
      'Log in to Max (formerly HBO Max) at max.com',
      'Click your profile icon and go to Settings',
      'Select "Subscription" from the menu',
      'Click "Cancel Subscription" or "Manage Subscription"',
      'Confirm the cancellation when prompted',
      'Note: If you subscribed through a third party (Apple, Google, etc.), cancel through that platform instead',
    ],
  },

  'apple music': {
    methods: ['self_service', 'phone'],
    website: 'https://support.apple.com/en-us/HT202039',
    phone: '1-800-275-2273',
    steps: [
      'Open the Settings app on your iPhone/iPad, or System Settings on Mac',
      'Tap your name at the top, then tap "Subscriptions"',
      'Find Apple Music in the list and tap it',
      'Tap "Cancel Subscription"',
      'Confirm the cancellation',
      'Alternatively, open the Music app and go to Account > Manage Subscription',
    ],
  },

  'youtube premium': {
    methods: ['self_service'],
    website: 'https://www.youtube.com/paid_memberships',
    steps: [
      'Go to youtube.com/paid_memberships while signed in',
      'Click "Manage membership" next to YouTube Premium',
      'Click "Deactivate" or "Cancel membership"',
      'Select a reason for cancelling',
      'Click "Continue to cancel" and confirm',
      'You will retain Premium benefits until the end of your billing period',
    ],
  },

  adobe: {
    methods: ['self_service', 'chat', 'phone'],
    website: 'https://account.adobe.com/plans',
    chatUrl: 'https://helpx.adobe.com/contact.html',
    phone: '1-800-833-6687',
    steps: [
      'Go to account.adobe.com/plans and sign in',
      'Find the plan you want to cancel and click "Manage plan"',
      'Click "Cancel plan"',
      'Follow the on-screen instructions to complete cancellation',
      'Note: Annual plans cancelled early may incur an early termination fee',
      'Consider switching to a lower-tier plan if available to avoid fees',
    ],
  },

  'microsoft 365': {
    methods: ['self_service', 'chat', 'phone'],
    website: 'https://account.microsoft.com/services',
    chatUrl: 'https://support.microsoft.com/contactus',
    phone: '1-800-642-7676',
    steps: [
      'Go to account.microsoft.com/services and sign in',
      'Find your Microsoft 365 subscription',
      'Click "Manage" next to the subscription',
      'Select "Cancel" or "Turn off recurring billing"',
      'Follow the prompts to confirm cancellation',
      'Your access will continue until the end of the billing period',
    ],
  },

  gym: {
    methods: ['phone', 'email'],
    steps: [
      'Review your gym membership contract for cancellation terms and notice period',
      'Many gyms require written notice 30 days before the next billing date',
      'Visit the gym in person or send a certified letter requesting cancellation',
      'Some gyms allow cancellation via email - send a written request with your member ID',
      'Keep a copy of all cancellation correspondence for your records',
      'Follow up to confirm the cancellation was processed and check for final charges',
    ],
  },

  'cable/internet': {
    methods: ['phone', 'chat'],
    steps: [
      'Call your provider\'s cancellation/retention department directly',
      'Have your account number and last bill ready before calling',
      'Be prepared for retention offers - decide in advance if you want to negotiate',
      'Ask for a confirmation number and final bill details',
      'Return any rented equipment (modem, router, cable boxes) promptly to avoid fees',
      'Check your final bill to ensure no unexpected charges were added',
      'Consider sending a written cancellation request as backup documentation',
    ],
  },
};

/**
 * Look up cancellation instructions for a merchant name.
 * Performs fuzzy matching against the knowledge base keys.
 */
export function findCancellationInfo(
  merchantName: string,
): CancellationInfo | null {
  const normalized = merchantName.toLowerCase().trim();

  // Direct match
  if (CANCELLATION_KNOWLEDGE_BASE[normalized]) {
    return CANCELLATION_KNOWLEDGE_BASE[normalized];
  }

  // Partial match - check if merchant name contains a known key or vice versa
  for (const [key, info] of Object.entries(CANCELLATION_KNOWLEDGE_BASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return info;
    }
  }

  // Word-level match - check if any key words appear in the merchant name
  for (const [key, info] of Object.entries(CANCELLATION_KNOWLEDGE_BASE)) {
    const keyWords = key.split(/\s+/);
    const merchantWords = normalized.split(/\s+/);
    const hasMatch = keyWords.some(
      (kw) => kw.length > 3 && merchantWords.some((mw) => mw.includes(kw)),
    );
    if (hasMatch) {
      return info;
    }
  }

  return null;
}

/**
 * Generate generic cancellation instructions when no specific merchant info is available.
 */
export function getGenericCancellationInfo(merchantName: string): CancellationInfo {
  return {
    methods: ['self_service', 'email', 'phone'],
    steps: [
      `Log in to your ${merchantName} account on their website or app`,
      'Look for Account Settings, Subscription, or Billing in the menu',
      'Find the cancellation or "Cancel subscription" option',
      'If no online option is available, look for a customer support phone number or email',
      'Request cancellation and ask for a confirmation number or email',
      'Keep a record of the cancellation date and any confirmation you receive',
      'Monitor your bank statements to confirm no further charges after cancellation',
    ],
  };
}
