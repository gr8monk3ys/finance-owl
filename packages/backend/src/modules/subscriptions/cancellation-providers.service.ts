import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { cancellationRequests } from './cancellation.schema';

/**
 * Detailed provider information including cancellation method, difficulty,
 * step-by-step instructions, tips, and contact details.
 */
export interface ProviderEntry {
  name: string;
  cancellationMethod: 'online' | 'phone' | 'email' | 'in_person' | 'chat';
  url: string | null;
  phoneNumber: string | null;
  emailTemplate: string | null;
  steps: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  tips: string[];
}

export interface SavingsBreakdown {
  totalCancelled: number;
  totalPending: number;
  estimatedMonthlySavings: number;
  estimatedAnnualSavings: number;
  cancelledSubscriptions: {
    name: string;
    amount: number;
    frequency: string;
    cancelledAt: string | null;
  }[];
}

const FREQUENCY_MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

/**
 * Comprehensive provider knowledge base with cancellation details for 50+ services.
 * Each entry includes the preferred cancellation method, direct URLs, phone numbers,
 * email templates, step-by-step instructions, difficulty rating, and user tips.
 */
const PROVIDER_DATABASE: Record<string, ProviderEntry> = {
  // --- Streaming Video ---
  netflix: {
    name: 'Netflix',
    cancellationMethod: 'online',
    url: 'https://www.netflix.com/cancelplan',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to netflix.com and sign in to your account',
      'Click on your profile icon in the top right corner',
      'Select "Account" from the dropdown menu',
      'Click "Cancel Membership" in the Membership & Billing section',
      'Click "Finish Cancellation" to confirm',
      'Your account will remain active until the end of your billing period',
    ],
    difficulty: 'easy',
    tips: [
      'Your account stays active until the end of the current billing period',
      'You can restart your membership anytime within 10 months without losing your profile data',
      'Download any content you want to keep before cancelling',
    ],
  },

  hulu: {
    name: 'Hulu',
    cancellationMethod: 'online',
    url: 'https://secure.hulu.com/account',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to secure.hulu.com/account and log in',
      'Click "Cancel" next to your subscription plan',
      'Select your reason for cancelling',
      'Click "Continue to Cancel"',
      'Confirm by clicking "Cancel Subscription"',
    ],
    difficulty: 'easy',
    tips: [
      'Your subscription remains active until the end of the billing cycle',
      'If billed through a third party (Apple, Roku, etc.), cancel through that platform instead',
      'Hulu may offer a discounted plan to keep you',
    ],
  },

  'disney+': {
    name: 'Disney+',
    cancellationMethod: 'online',
    url: 'https://www.disneyplus.com/account',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to disneyplus.com/account and log in',
      'Click on your subscription under "Subscription"',
      'Select "Cancel Subscription"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Access continues until the end of your billing period',
      'If part of a Disney Bundle, cancelling Disney+ may affect other services',
      'Download content you want to watch before your access ends',
    ],
  },

  'hbo max': {
    name: 'HBO Max / Max',
    cancellationMethod: 'online',
    url: 'https://www.max.com/settings/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to max.com and sign in',
      'Navigate to Settings > Subscription',
      'Click "Manage Subscription"',
      'Select "Cancel Subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Now rebranded as "Max" -- the URL is max.com',
      'Access continues through the end of the billing period',
      'If subscribed through a cable provider, cancel through them instead',
    ],
  },

  max: {
    name: 'Max (HBO)',
    cancellationMethod: 'online',
    url: 'https://www.max.com/settings/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to max.com and sign in',
      'Navigate to Settings > Subscription',
      'Click "Manage Subscription"',
      'Select "Cancel Subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Access continues through the end of the billing period',
      'If subscribed through a cable provider, cancel through them instead',
    ],
  },

  'paramount+': {
    name: 'Paramount+',
    cancellationMethod: 'online',
    url: 'https://www.paramountplus.com/account/',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to paramountplus.com/account and sign in',
      'Click "Cancel Subscription"',
      'Select your reason for cancelling',
      'Confirm cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Access continues until the end of the billing period',
      'If subscribed through Apple, Roku, or Amazon, cancel through that platform',
    ],
  },

  peacock: {
    name: 'Peacock',
    cancellationMethod: 'online',
    url: 'https://www.peacocktv.com/account/plans',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to peacocktv.com and sign in',
      'Navigate to Account > Plans',
      'Click "Cancel Plan"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Free tier content remains available after cancelling premium',
      'If billed through a third party, cancel through that service',
    ],
  },

  'apple tv+': {
    name: 'Apple TV+',
    cancellationMethod: 'online',
    url: 'https://support.apple.com/en-us/HT202039',
    phoneNumber: '1-800-275-2273',
    emailTemplate: null,
    steps: [
      'On iPhone/iPad: Go to Settings > [your name] > Subscriptions',
      'On Mac: Open App Store > click your name > Account Settings > Subscriptions',
      'Find Apple TV+ in your subscription list',
      'Tap "Cancel Subscription"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'If part of Apple One bundle, cancelling individually may not be possible',
      'Access continues until the end of the billing period',
      'You can also manage subscriptions at appleid.apple.com',
    ],
  },

  crunchyroll: {
    name: 'Crunchyroll',
    cancellationMethod: 'online',
    url: 'https://www.crunchyroll.com/account/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to crunchyroll.com and sign in',
      'Navigate to Account > Subscription',
      'Click "Cancel Subscription"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Free content with ads is still available after cancelling',
      'Your watchlist and history are preserved',
    ],
  },

  // --- Streaming Music ---
  spotify: {
    name: 'Spotify',
    cancellationMethod: 'online',
    url: 'https://www.spotify.com/account/subscription/',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to spotify.com/account and log in',
      'Scroll down to "Your plan" section',
      'Click "Change plan"',
      'Scroll to the bottom and select "Cancel Premium"',
      'Follow the prompts and confirm cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Your premium features continue until the next billing date',
      'Your playlists and saved music will remain on a free account',
      'You can resubscribe at any time',
      'If on a family plan, cancelling removes all family members',
    ],
  },

  'apple music': {
    name: 'Apple Music',
    cancellationMethod: 'online',
    url: 'https://support.apple.com/en-us/HT202039',
    phoneNumber: '1-800-275-2273',
    emailTemplate: null,
    steps: [
      'On iPhone/iPad: Go to Settings > [your name] > Subscriptions',
      'On Mac: Open App Store > click your name > Account Settings > Subscriptions',
      'Find Apple Music in your subscription list',
      'Tap "Cancel Subscription"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Access continues until the end of the billing period',
      'Your music library and playlists will be preserved if you resubscribe',
      'You can also manage subscriptions at appleid.apple.com',
    ],
  },

  'youtube premium': {
    name: 'YouTube Premium',
    cancellationMethod: 'online',
    url: 'https://www.youtube.com/paid_memberships',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to youtube.com/paid_memberships and sign in',
      'Click "Manage Membership" next to YouTube Premium',
      'Click "Deactivate" or "Cancel Membership"',
      'Follow the prompts and confirm',
    ],
    difficulty: 'easy',
    tips: [
      'You lose ad-free viewing, background play, and YouTube Music Premium',
      'Access continues until the end of the billing period',
      'If on a family plan, all family members lose access',
    ],
  },

  'youtube music': {
    name: 'YouTube Music Premium',
    cancellationMethod: 'online',
    url: 'https://www.youtube.com/paid_memberships',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to youtube.com/paid_memberships and sign in',
      'Click "Manage Membership" next to YouTube Music',
      'Click "Deactivate" or "Cancel Membership"',
      'Follow the prompts and confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Free tier with ads remains available',
      'Access continues until the end of the billing period',
    ],
  },

  'amazon music': {
    name: 'Amazon Music Unlimited',
    cancellationMethod: 'online',
    url: 'https://www.amazon.com/music/settings',
    phoneNumber: '1-888-280-4331',
    emailTemplate: null,
    steps: [
      'Go to amazon.com/music/settings and sign in',
      'Click "Cancel subscription" under Your Amazon Music Unlimited Subscription',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Amazon Prime Music (included with Prime) is not affected',
      'Downloaded songs will no longer be playable',
    ],
  },

  tidal: {
    name: 'Tidal',
    cancellationMethod: 'online',
    url: 'https://account.tidal.com/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to account.tidal.com/subscription and sign in',
      'Click "Cancel subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Access continues until the end of the billing period',
      'Free tier is available with limited features',
    ],
  },

  // --- Apple Bundle ---
  'apple one': {
    name: 'Apple One',
    cancellationMethod: 'online',
    url: 'https://support.apple.com/en-us/HT211659',
    phoneNumber: '1-800-275-2273',
    emailTemplate: null,
    steps: [
      'On iPhone/iPad: Go to Settings > [your name] > Subscriptions',
      'Find Apple One in your subscription list',
      'Tap "Cancel Subscription" or "Cancel All Services"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Cancelling Apple One cancels all bundled services (Music, TV+, Arcade, iCloud+, etc.)',
      'Consider subscribing to individual services if you only want some',
      'iCloud storage may be reduced -- back up your data first',
    ],
  },

  'apple arcade': {
    name: 'Apple Arcade',
    cancellationMethod: 'online',
    url: 'https://support.apple.com/en-us/HT202039',
    phoneNumber: '1-800-275-2273',
    emailTemplate: null,
    steps: [
      'On iPhone/iPad: Go to Settings > [your name] > Subscriptions',
      'Find Apple Arcade in your subscription list',
      'Tap "Cancel Subscription"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'All Arcade games become unplayable after subscription ends',
      'Game save data may be lost',
    ],
  },

  // --- Shopping / Delivery ---
  'amazon prime': {
    name: 'Amazon Prime',
    cancellationMethod: 'online',
    url: 'https://www.amazon.com/mc?ref_=nav_AccountFlyout_prime',
    phoneNumber: '1-888-280-4331',
    emailTemplate: null,
    steps: [
      'Go to amazon.com and sign in',
      'Navigate to Account > Prime Membership',
      'Click "Update, cancel and more" under the Membership section',
      'Click "End Membership"',
      'Follow the prompts -- Amazon will show retention offers',
      'Confirm cancellation at the final prompt',
    ],
    difficulty: 'medium',
    tips: [
      'Amazon will try several retention offers before allowing cancellation',
      'You can get a prorated refund if you have not used Prime benefits',
      'Prime Video, free shipping, and all other benefits end immediately or at period end',
      'You can call customer service if the online process is difficult',
    ],
  },

  'walmart+': {
    name: 'Walmart+',
    cancellationMethod: 'online',
    url: 'https://www.walmart.com/plus/manage',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to walmart.com/plus/manage and sign in',
      'Click "Manage plan"',
      'Select "Cancel Walmart+ membership"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Free delivery and fuel discounts end at period expiration',
      'Paramount+ Essential (if included) also ends',
    ],
  },

  'instacart+': {
    name: 'Instacart+',
    cancellationMethod: 'online',
    url: 'https://www.instacart.com/store/account/instacart-plus',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to instacart.com or open the Instacart app',
      'Navigate to Account > Instacart+ Membership',
      'Click "Cancel membership"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Free delivery benefit ends at the end of the billing period',
      'You can reactivate at any time',
    ],
  },

  costco: {
    name: 'Costco Membership',
    cancellationMethod: 'in_person',
    url: null,
    phoneNumber: '1-800-774-2678',
    emailTemplate: null,
    steps: [
      'Visit your local Costco warehouse membership counter',
      'Request to cancel your membership',
      'Return your membership card',
      'You will receive a full refund of your membership fee',
    ],
    difficulty: 'easy',
    tips: [
      'Costco offers a full refund on membership at any time',
      'You can also call 1-800-774-2678 to cancel',
      'The Executive membership 2% reward check may need to be returned',
    ],
  },

  'doordash dashpass': {
    name: 'DoorDash DashPass',
    cancellationMethod: 'online',
    url: 'https://www.doordash.com/consumer/membership/',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Open the DoorDash app or go to doordash.com',
      'Navigate to Account > Manage DashPass',
      'Click "Cancel Membership"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'You lose free delivery and reduced service fees immediately or at period end',
      'DashPass may be included with certain credit cards -- check before cancelling',
    ],
  },

  doordash: {
    name: 'DoorDash DashPass',
    cancellationMethod: 'online',
    url: 'https://www.doordash.com/consumer/membership/',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Open the DoorDash app or go to doordash.com',
      'Navigate to Account > Manage DashPass',
      'Click "Cancel Membership"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'You lose free delivery and reduced service fees at period end',
      'DashPass may be included with certain credit cards -- check before cancelling',
    ],
  },

  'uber one': {
    name: 'Uber One',
    cancellationMethod: 'online',
    url: null,
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Open the Uber or Uber Eats app',
      'Go to Account > Uber One',
      'Tap "Manage Membership"',
      'Select "Cancel Membership"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'You lose discounts on rides and Uber Eats deliveries',
      'Access continues until the end of the billing period',
    ],
  },

  // --- Gym / Fitness ---
  'planet fitness': {
    name: 'Planet Fitness',
    cancellationMethod: 'in_person',
    url: null,
    phoneNumber: null,
    emailTemplate:
      'To Whom It May Concern,\n\nI am writing to request the cancellation of my Planet Fitness membership.\n\nMember Name: [YOUR NAME]\nMember ID: [YOUR MEMBER ID]\nHome Club: [YOUR LOCATION]\n\nPlease process this cancellation effective immediately. I understand my membership will remain active until the end of the current billing period.\n\nPlease send written confirmation of this cancellation to my email address on file.\n\nThank you,\n[YOUR NAME]',
    steps: [
      'Visit your home Planet Fitness location in person',
      'Go to the front desk and request a cancellation form',
      'Fill out the cancellation form completely',
      'Alternatively, send a certified letter to your home club address',
      'Keep a copy of your cancellation form or certified letter receipt',
      'Verify cancellation by checking your next billing statement',
    ],
    difficulty: 'hard',
    tips: [
      'You MUST cancel in person or via certified letter -- phone and online cancellation are not accepted',
      'Cancel before the 10th of the month to avoid being charged for the next month',
      'Annual fee is typically charged in the first few months -- check your contract',
      'Keep proof of cancellation in case of billing disputes',
      'Some locations may try to talk you into freezing your membership instead',
    ],
  },

  'anytime fitness': {
    name: 'Anytime Fitness',
    cancellationMethod: 'in_person',
    url: null,
    phoneNumber: null,
    emailTemplate:
      'To Whom It May Concern,\n\nI am writing to request the cancellation of my Anytime Fitness membership.\n\nMember Name: [YOUR NAME]\nMember ID: [YOUR MEMBER ID]\nHome Club: [YOUR LOCATION]\n\nPlease process this cancellation effective immediately and send written confirmation.\n\nThank you,\n[YOUR NAME]',
    steps: [
      'Review your membership agreement for cancellation terms',
      'Visit your home Anytime Fitness location',
      'Request a cancellation form at the front desk',
      'Complete and submit the form',
      'Request written confirmation of cancellation',
      'Monitor your bank statements to ensure charges stop',
    ],
    difficulty: 'hard',
    tips: [
      'Most contracts require 30 days written notice',
      'You may be required to pay a cancellation fee depending on your contract',
      'Some locations accept cancellation by certified mail',
      'Take a photo of your completed cancellation form',
    ],
  },

  '24 hour fitness': {
    name: '24 Hour Fitness',
    cancellationMethod: 'in_person',
    url: null,
    phoneNumber: '1-800-432-6348',
    emailTemplate: null,
    steps: [
      'Visit your home 24 Hour Fitness club',
      'Speak with the membership department',
      'Request to cancel your membership',
      'Complete the cancellation paperwork',
      'Get a written confirmation of cancellation',
    ],
    difficulty: 'hard',
    tips: [
      'Review your contract for any early termination fees',
      'You may also be able to cancel by calling 1-800-432-6348',
      'Cancellation typically requires 30 days notice',
      'Keep all documentation and confirmation numbers',
    ],
  },

  'la fitness': {
    name: 'LA Fitness',
    cancellationMethod: 'in_person',
    url: null,
    phoneNumber: '1-949-255-7200',
    emailTemplate:
      'Operations Manager\nLA Fitness\n[CLUB ADDRESS]\n\nDear Operations Manager,\n\nI am writing to cancel my LA Fitness membership effective immediately.\n\nMember Name: [YOUR NAME]\nMember ID: [YOUR MEMBER ID]\n\nPlease confirm this cancellation in writing.\n\nSincerely,\n[YOUR NAME]',
    steps: [
      'Visit your home LA Fitness location in person',
      'Request a cancellation form from the front desk',
      'Fill out the form and submit it',
      'Alternatively, send a certified letter to your home club',
      'Keep proof of submission',
    ],
    difficulty: 'hard',
    tips: [
      'In-person or certified mail are the only accepted methods',
      'Give at least 30 days notice before your next billing date',
      'If within a contract period, there may be an early termination fee',
    ],
  },

  orangetheory: {
    name: 'Orangetheory Fitness',
    cancellationMethod: 'in_person',
    url: null,
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Visit your home Orangetheory studio in person',
      'Speak with the front desk staff about cancelling',
      'Complete the required cancellation form',
      'Most locations require 30 days written notice',
      'Get a copy of the completed form for your records',
    ],
    difficulty: 'hard',
    tips: [
      'Check your contract for the specific notice period required',
      'Some locations may allow email or phone cancellation -- ask first',
      'You will typically be charged for one more month after submitting',
    ],
  },

  peloton: {
    name: 'Peloton',
    cancellationMethod: 'online',
    url: 'https://members.onepeloton.com/preferences/subscriptions',
    phoneNumber: '1-866-679-9129',
    emailTemplate: null,
    steps: [
      'Go to members.onepeloton.com and sign in',
      'Navigate to Preferences > Subscriptions',
      'Click "Cancel Subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'medium',
    tips: [
      'Cancelling the app membership does not affect hardware payments',
      'Without a membership, Peloton hardware has very limited functionality',
      'Peloton may offer discounted rates to retain you',
    ],
  },

  // --- Software / Productivity ---
  'adobe creative cloud': {
    name: 'Adobe Creative Cloud',
    cancellationMethod: 'online',
    url: 'https://account.adobe.com/plans',
    phoneNumber: '1-800-833-6687',
    emailTemplate: null,
    steps: [
      'Go to account.adobe.com and sign in',
      'Navigate to "Plans" or "Plans & Payment"',
      'Find your Creative Cloud plan and click "Manage plan"',
      'Click "Cancel plan"',
      'Follow the retention prompts -- Adobe will offer discounts',
      'Confirm cancellation at the final step',
    ],
    difficulty: 'medium',
    tips: [
      'Annual plans cancelled early incur a fee (50% of remaining months)',
      'Consider switching to a monthly plan first if you want flexibility',
      'Adobe will offer steep discounts to retain you -- you may get 40-60% off',
      'Export all files from Adobe cloud storage before cancelling',
      'Free tier still gives you access to Adobe Express and 2GB cloud storage',
    ],
  },

  adobe: {
    name: 'Adobe Creative Cloud',
    cancellationMethod: 'online',
    url: 'https://account.adobe.com/plans',
    phoneNumber: '1-800-833-6687',
    emailTemplate: null,
    steps: [
      'Go to account.adobe.com and sign in',
      'Navigate to "Plans" or "Plans & Payment"',
      'Find your plan and click "Manage plan"',
      'Click "Cancel plan"',
      'Follow the retention prompts',
      'Confirm cancellation at the final step',
    ],
    difficulty: 'medium',
    tips: [
      'Annual plans cancelled early incur a fee (50% of remaining months)',
      'Adobe will offer discounts to retain you',
      'Export files from Adobe cloud storage before cancelling',
    ],
  },

  'microsoft 365': {
    name: 'Microsoft 365',
    cancellationMethod: 'online',
    url: 'https://account.microsoft.com/services/',
    phoneNumber: '1-800-642-7676',
    emailTemplate: null,
    steps: [
      'Go to account.microsoft.com/services and sign in',
      'Find your Microsoft 365 subscription',
      'Click "Manage" next to your subscription',
      'Select "Cancel subscription" or "Turn off recurring billing"',
      'Follow the confirmation steps',
    ],
    difficulty: 'easy',
    tips: [
      'Turning off recurring billing lets you use the service until the end of the period',
      'You will lose access to premium Office apps and OneDrive storage',
      'Back up your OneDrive files before cancelling',
      'Office Online (free versions) will still be available',
    ],
  },

  'google one': {
    name: 'Google One',
    cancellationMethod: 'online',
    url: 'https://one.google.com/settings',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to one.google.com/settings',
      'Click "Cancel membership"',
      'Follow the prompts to confirm cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Your storage will revert to the free 15GB tier',
      'If you exceed 15GB, you will not be able to upload new files',
      'Google may delete excess data after a grace period',
      'Back up important files before downgrading',
    ],
  },

  notion: {
    name: 'Notion',
    cancellationMethod: 'online',
    url: 'https://www.notion.so/my-settings',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to notion.so and sign in',
      'Navigate to Settings & Members > Plans',
      'Click "Downgrade" to switch to the free plan',
      'Confirm the downgrade',
    ],
    difficulty: 'easy',
    tips: [
      'Free plan has limited file upload size and guest access',
      'Your workspace content is preserved',
    ],
  },

  evernote: {
    name: 'Evernote',
    cancellationMethod: 'online',
    url: 'https://www.evernote.com/Settings.action',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to evernote.com/Settings.action and sign in',
      'Navigate to Account Summary > Manage Subscription',
      'Select "Downgrade" or "Cancel"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'You revert to the free plan with limited features',
      'Notes are preserved but may become read-only if you exceed free tier limits',
      'Export your notes before downgrading as a precaution',
    ],
  },

  slack: {
    name: 'Slack',
    cancellationMethod: 'online',
    url: null,
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Only workspace owners/admins can change billing',
      'Go to your Slack workspace settings',
      'Navigate to Settings & Administration > Billing',
      'Click "Downgrade to Free" or "Cancel Plan"',
      'Confirm the change',
    ],
    difficulty: 'easy',
    tips: [
      'Free plan limits message history to 90 days',
      'Integration limits apply on the free plan',
      'Download important files before downgrading',
    ],
  },

  zoom: {
    name: 'Zoom',
    cancellationMethod: 'online',
    url: 'https://zoom.us/account/billing',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to zoom.us and sign in',
      'Navigate to Admin > Account Management > Billing',
      'Click "Cancel Subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Free tier allows unlimited 1-on-1 meetings and 40-minute group meetings',
      'Your account and past meeting data are preserved',
    ],
  },

  'canva pro': {
    name: 'Canva Pro',
    cancellationMethod: 'online',
    url: 'https://www.canva.com/settings/billing-and-plans',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to canva.com and sign in',
      'Navigate to Settings > Billing & Plans',
      'Click "Cancel subscription" or "Downgrade"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'You keep access to the free tier with limited features',
      'Premium templates and elements become inaccessible',
      'Download your designs before downgrading',
    ],
  },

  canva: {
    name: 'Canva Pro',
    cancellationMethod: 'online',
    url: 'https://www.canva.com/settings/billing-and-plans',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to canva.com and sign in',
      'Navigate to Settings > Billing & Plans',
      'Click "Cancel subscription" or "Downgrade"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: ['You keep access to the free tier', 'Download your designs before downgrading'],
  },

  grammarly: {
    name: 'Grammarly',
    cancellationMethod: 'online',
    url: 'https://account.grammarly.com/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to account.grammarly.com/subscription and sign in',
      'Click "Cancel Subscription"',
      'Follow the prompts and confirm',
    ],
    difficulty: 'easy',
    tips: [
      'The free tier still provides basic grammar and spelling checks',
      'Premium features are available until the end of the billing period',
    ],
  },

  dropbox: {
    name: 'Dropbox',
    cancellationMethod: 'online',
    url: 'https://www.dropbox.com/account/plan',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to dropbox.com/account/plan and sign in',
      'Click "Cancel plan" or "Downgrade"',
      'Follow the prompts to confirm the downgrade to Basic (free)',
    ],
    difficulty: 'easy',
    tips: [
      'You keep access until the end of your billing period',
      'Your files remain but you will be limited to 2GB on the free plan',
      'Download or move files exceeding the free limit before cancelling',
    ],
  },

  // --- AI / Tech ---
  'chatgpt plus': {
    name: 'ChatGPT Plus',
    cancellationMethod: 'online',
    url: 'https://chat.openai.com/#settings/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to chat.openai.com and sign in',
      'Click your profile icon in the lower left',
      'Select "My Plan"',
      'Click "Manage my subscription"',
      'Select "Cancel plan"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'You revert to the free tier with limited access',
      'Chat history is preserved',
      'Access continues until the end of the billing period',
    ],
  },

  chatgpt: {
    name: 'ChatGPT Plus',
    cancellationMethod: 'online',
    url: 'https://chat.openai.com/#settings/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to chat.openai.com and sign in',
      'Click your profile icon in the lower left',
      'Select "My Plan"',
      'Click "Manage my subscription"',
      'Select "Cancel plan"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: ['You revert to the free tier', 'Chat history is preserved'],
  },

  // --- Gaming ---
  'xbox game pass': {
    name: 'Xbox Game Pass',
    cancellationMethod: 'online',
    url: 'https://account.microsoft.com/services/',
    phoneNumber: '1-800-469-9269',
    emailTemplate: null,
    steps: [
      'Go to account.microsoft.com/services and sign in',
      'Find Xbox Game Pass in your subscriptions',
      'Click "Manage"',
      'Select "Cancel subscription" or "Turn off recurring billing"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'You retain access until the end of your prepaid period',
      'Game saves are preserved even after cancellation',
      'Games from Game Pass are no longer playable without an active subscription',
    ],
  },

  'playstation plus': {
    name: 'PlayStation Plus',
    cancellationMethod: 'online',
    url: 'https://store.playstation.com/en-us/category/subscriptions',
    phoneNumber: '1-800-345-7669',
    emailTemplate: null,
    steps: [
      'On PS5/PS4: Go to Settings > Users and Accounts > Account > Payment and Subscriptions',
      'Select PlayStation Plus > Cancel Subscription',
      'Or go to the PlayStation Store website and manage subscriptions',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'You keep access and online multiplayer until the end of the period',
      'Monthly PS Plus games claimed during subscription become unplayable after expiry',
      'Cloud saves are retained for a limited time after cancellation',
    ],
  },

  'nintendo switch online': {
    name: 'Nintendo Switch Online',
    cancellationMethod: 'online',
    url: 'https://ec.nintendo.com/my/membership',
    phoneNumber: '1-800-255-3700',
    emailTemplate: null,
    steps: [
      'Go to ec.nintendo.com/my/membership or use the Nintendo Switch eShop',
      'Find your Nintendo Switch Online membership',
      'Turn off automatic renewal',
      'Confirm the change',
    ],
    difficulty: 'easy',
    tips: [
      'Your membership stays active until expiry even after turning off auto-renewal',
      'Cloud saves may be deleted after membership expires',
    ],
  },

  // --- Books / Audio ---
  audible: {
    name: 'Audible',
    cancellationMethod: 'online',
    url: 'https://www.audible.com/account/overview',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to audible.com/account/overview and sign in',
      'Scroll to the bottom and click "Cancel membership" under the plan details',
      'Follow the retention prompts',
      'Confirm the cancellation',
    ],
    difficulty: 'medium',
    tips: [
      'Audible will try multiple retention offers (pause, discount, etc.)',
      'You keep purchased audiobooks forever, even after cancelling',
      'Unused credits are lost after cancellation',
      'Consider using remaining credits before cancelling',
    ],
  },

  'kindle unlimited': {
    name: 'Kindle Unlimited',
    cancellationMethod: 'online',
    url: 'https://www.amazon.com/hz/mycd/myx#/home/settings/payment',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to amazon.com and sign in',
      'Navigate to Account > Memberships & Subscriptions',
      'Find Kindle Unlimited and click "Cancel Kindle Unlimited Membership"',
      'Confirm the cancellation',
    ],
    difficulty: 'easy',
    tips: [
      'Borrowed books are returned automatically after cancellation',
      'Highlights and notes on borrowed books may be lost',
    ],
  },

  scribd: {
    name: 'Scribd',
    cancellationMethod: 'online',
    url: 'https://www.scribd.com/account-settings/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to scribd.com/account-settings/subscription and sign in',
      'Click "Cancel your subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Access continues until the end of the billing period',
      'Downloaded content will no longer be accessible',
    ],
  },

  // --- VPN / Security ---
  nordvpn: {
    name: 'NordVPN',
    cancellationMethod: 'chat',
    url: 'https://my.nordaccount.com/dashboard/',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to my.nordaccount.com and sign in',
      'Navigate to subscription settings',
      'Click "Cancel automatic renewal" to stop future charges',
      'For a refund, contact support via live chat within 30 days of purchase',
    ],
    difficulty: 'medium',
    tips: [
      'You can disable auto-renewal without losing current access',
      '30-day money-back guarantee applies to new purchases',
      'Live chat support is available 24/7 for refund requests',
    ],
  },

  expressvpn: {
    name: 'ExpressVPN',
    cancellationMethod: 'online',
    url: 'https://www.expressvpn.com/subscriptions',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to expressvpn.com/subscriptions and sign in',
      'Click "Manage Settings"',
      'Turn off automatic renewal',
      'For a refund, contact support within 30 days via live chat',
    ],
    difficulty: 'easy',
    tips: [
      '30-day money-back guarantee on all plans',
      'Disabling auto-renewal lets you use the service until the end of the period',
    ],
  },

  // --- Password Managers ---
  dashlane: {
    name: 'Dashlane',
    cancellationMethod: 'online',
    url: 'https://app.dashlane.com/settings/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to app.dashlane.com and sign in',
      'Navigate to Settings > Subscription',
      'Click "Cancel subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Free tier allows up to 25 passwords on one device',
      'Export your passwords before downgrading',
    ],
  },

  '1password': {
    name: '1Password',
    cancellationMethod: 'online',
    url: 'https://my.1password.com/settings/billing',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to my.1password.com and sign in',
      'Navigate to Settings > Billing',
      'Click "Cancel subscription" or "Unsubscribe"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Your vault becomes read-only after cancellation',
      'Export your passwords before cancelling',
      'If subscribed through Apple, cancel in Apple settings',
    ],
  },

  lastpass: {
    name: 'LastPass',
    cancellationMethod: 'online',
    url: 'https://lastpass.com/update_premium.php',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to lastpass.com and sign in',
      'Navigate to Account Settings > Subscription',
      'Click "Cancel Subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Free tier now only supports one device type',
      'Export your passwords to a CSV before downgrading',
    ],
  },

  // --- News / Media ---
  'the new york times': {
    name: 'The New York Times',
    cancellationMethod: 'phone',
    url: 'https://myaccount.nytimes.com/seg/',
    phoneNumber: '1-800-591-9233',
    emailTemplate: null,
    steps: [
      'Call 1-800-591-9233 (NYT customer care)',
      'Tell the representative you want to cancel your subscription',
      'Be prepared for retention offers -- decline firmly if you want to cancel',
      'Request a confirmation email',
      'Alternatively, try online at myaccount.nytimes.com (chat support may be available)',
    ],
    difficulty: 'medium',
    tips: [
      'Phone cancellation is often required despite having online account management',
      'The representative will offer discounts -- be firm if you want to cancel',
      'Ask for a confirmation number or email',
      'Check your email for cancellation confirmation',
    ],
  },

  nytimes: {
    name: 'The New York Times',
    cancellationMethod: 'phone',
    url: 'https://myaccount.nytimes.com/seg/',
    phoneNumber: '1-800-591-9233',
    emailTemplate: null,
    steps: [
      'Call 1-800-591-9233 (NYT customer care)',
      'Tell the representative you want to cancel your subscription',
      'Be prepared for retention offers -- decline firmly',
      'Request a confirmation email',
    ],
    difficulty: 'medium',
    tips: [
      'Phone cancellation is often required',
      'Be firm if you want to cancel -- they will offer discounts',
    ],
  },

  'wall street journal': {
    name: 'The Wall Street Journal',
    cancellationMethod: 'phone',
    url: 'https://customercenter.wsj.com/',
    phoneNumber: '1-800-568-7625',
    emailTemplate: null,
    steps: [
      'Call 1-800-568-7625 during business hours',
      'Request cancellation of your subscription',
      'Decline retention offers if you want to proceed',
      'Get a confirmation number',
    ],
    difficulty: 'medium',
    tips: [
      'Phone is the most reliable way to cancel',
      'Be prepared for strong retention attempts',
      'Check your billing statement to confirm charges have stopped',
    ],
  },

  'washington post': {
    name: 'The Washington Post',
    cancellationMethod: 'online',
    url: 'https://www.washingtonpost.com/my-post/subscriptions/',
    phoneNumber: '1-800-477-4679',
    emailTemplate: null,
    steps: [
      'Go to washingtonpost.com/my-post/subscriptions and sign in',
      'Click "Cancel subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Online cancellation is now available',
      'You can also call 1-800-477-4679 if you prefer',
    ],
  },

  // --- Social / Dating ---
  'linkedin premium': {
    name: 'LinkedIn Premium',
    cancellationMethod: 'online',
    url: 'https://www.linkedin.com/mypreferences/d/categories/subscriptions',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'Go to LinkedIn and sign in',
      'Click your profile icon > Settings & Privacy',
      'Navigate to Account preferences > Subscriptions and payments',
      'Click "Manage Premium account"',
      'Select "Cancel subscription"',
      'Follow the prompts to confirm',
    ],
    difficulty: 'easy',
    tips: [
      'Premium features continue until the end of the billing period',
      'InMail credits expire after cancellation',
      'Your profile and connections are not affected',
    ],
  },

  bumble: {
    name: 'Bumble Premium',
    cancellationMethod: 'online',
    url: null,
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'If subscribed through Apple: Settings > [your name] > Subscriptions > Bumble > Cancel',
      'If subscribed through Google Play: Play Store > Profile > Payments & subscriptions > Subscriptions > Bumble > Cancel',
      'If subscribed on bumble.com: go to your profile > Manage Subscription > Cancel',
    ],
    difficulty: 'easy',
    tips: [
      'Cancel through the same platform you subscribed on',
      'Deleting the app does NOT cancel the subscription',
      'Features remain active until the end of the billing period',
    ],
  },

  tinder: {
    name: 'Tinder Plus/Gold/Platinum',
    cancellationMethod: 'online',
    url: null,
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'If subscribed through Apple: Settings > [your name] > Subscriptions > Tinder > Cancel',
      'If subscribed through Google Play: Play Store > Profile > Payments & subscriptions > Subscriptions > Tinder > Cancel',
      'If subscribed on tinder.com: go to My Profile > Manage Payment Account > Cancel',
    ],
    difficulty: 'easy',
    tips: [
      'Uninstalling the app does NOT cancel your subscription',
      'Cancel through the platform where you originally subscribed',
    ],
  },

  // --- Wellness / Meditation ---
  calm: {
    name: 'Calm',
    cancellationMethod: 'online',
    url: 'https://www.calm.com/account',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'If subscribed through Apple: Settings > [your name] > Subscriptions > Calm > Cancel',
      'If subscribed through Google Play: Play Store > Profile > Subscriptions > Calm > Cancel',
      'If subscribed on calm.com: go to calm.com/account > Manage Subscription > Cancel',
    ],
    difficulty: 'easy',
    tips: [
      'Downloaded content becomes unavailable after subscription ends',
      'Cancel through the same platform you subscribed on',
    ],
  },

  headspace: {
    name: 'Headspace',
    cancellationMethod: 'online',
    url: 'https://www.headspace.com/settings/subscription',
    phoneNumber: null,
    emailTemplate: null,
    steps: [
      'If subscribed through Apple: Settings > [your name] > Subscriptions > Headspace > Cancel',
      'If subscribed through Google Play: Play Store > Profile > Subscriptions > Headspace > Cancel',
      'If subscribed on headspace.com: go to Settings > Subscription > Cancel',
    ],
    difficulty: 'easy',
    tips: [
      'Some free content remains available after cancellation',
      'Cancel through the platform where you originally subscribed',
    ],
  },

  // --- Radio / Satellite ---
  'sirius xm': {
    name: 'SiriusXM',
    cancellationMethod: 'phone',
    url: 'https://www.siriusxm.com/manage-subscription',
    phoneNumber: '1-866-635-2349',
    emailTemplate: null,
    steps: [
      'Call 1-866-635-2349 (SiriusXM Listener Care)',
      'Navigate through the phone menu to reach cancellation',
      'Tell the representative you want to cancel',
      'Decline retention offers firmly if you want to cancel',
      'Get a confirmation number',
      'You may also try the online chat at siriusxm.com',
    ],
    difficulty: 'hard',
    tips: [
      'SiriusXM is notoriously difficult to cancel',
      'Be prepared to spend 20-30 minutes on the phone',
      'Representatives will offer progressively better deals',
      'If you want to cancel, be firm and do not negotiate',
      'Request a confirmation email and keep the confirmation number',
      'Check your credit card statement for the next few months to ensure charges stopped',
    ],
  },

  siriusxm: {
    name: 'SiriusXM',
    cancellationMethod: 'phone',
    url: 'https://www.siriusxm.com/manage-subscription',
    phoneNumber: '1-866-635-2349',
    emailTemplate: null,
    steps: [
      'Call 1-866-635-2349 (SiriusXM Listener Care)',
      'Tell the representative you want to cancel',
      'Decline retention offers firmly',
      'Get a confirmation number',
    ],
    difficulty: 'hard',
    tips: [
      'Be prepared to spend 20-30 minutes on the phone',
      'Be firm -- they will offer multiple discounts',
      'Keep the confirmation number',
    ],
  },
};

@Injectable()
export class CancellationProvidersService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Look up provider cancellation info by name.
   * Performs exact match, then partial/fuzzy matching.
   */
  getProviderInfo(providerName: string): ProviderEntry | null {
    const normalized = providerName.toLowerCase().trim();

    // Direct match
    if (PROVIDER_DATABASE[normalized]) {
      return PROVIDER_DATABASE[normalized];
    }

    // Partial match: check if provider name contains or is contained by a known key
    for (const [key, info] of Object.entries(PROVIDER_DATABASE)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return info;
      }
    }

    // Word-level match
    for (const [key, info] of Object.entries(PROVIDER_DATABASE)) {
      const keyWords = key.split(/\s+/);
      const nameWords = normalized.split(/\s+/);
      const hasMatch = keyWords.some(
        (kw) => kw.length > 3 && nameWords.some((nw) => nw.includes(kw)),
      );
      if (hasMatch) {
        return info;
      }
    }

    return null;
  }

  /**
   * Return all known providers, de-duplicated by display name.
   */
  getAllProviders(): ProviderEntry[] {
    const seen = new Set<string>();
    const providers: ProviderEntry[] = [];

    for (const info of Object.values(PROVIDER_DATABASE)) {
      if (!seen.has(info.name)) {
        seen.add(info.name);
        providers.push(info);
      }
    }

    return providers.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Search providers by partial name match.
   */
  searchProviders(query: string): ProviderEntry[] {
    const normalized = query.toLowerCase().trim();
    if (!normalized) {
      return this.getAllProviders();
    }

    const seen = new Set<string>();
    const results: ProviderEntry[] = [];

    for (const info of Object.values(PROVIDER_DATABASE)) {
      if (!seen.has(info.name) && info.name.toLowerCase().includes(normalized)) {
        seen.add(info.name);
        results.push(info);
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Generate a pre-written cancellation email for a given subscription.
   */
  generateCancellationEmail(subscriptionName: string, providerEmail: string | null): string {
    // Check if provider has a specific email template
    const provider = this.getProviderInfo(subscriptionName);
    if (provider?.emailTemplate) {
      return provider.emailTemplate;
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `Subject: Subscription Cancellation Request - ${subscriptionName}

Dear ${subscriptionName} Customer Support,

I am writing to formally request the immediate cancellation of my ${subscriptionName} subscription.

Account Details:
- Service: ${subscriptionName}
- Account Email: [YOUR ACCOUNT EMAIL]
- Date of Request: ${today}

Please process this cancellation and confirm in writing that:
1. My subscription has been cancelled
2. No further charges will be applied to my payment method
3. The effective date of cancellation

If any additional information is needed from my end, please let me know promptly.

Thank you for your attention to this matter.

Sincerely,
[YOUR NAME]
[YOUR PHONE NUMBER]`;
  }

  /**
   * Generate a phone cancellation script for a given subscription.
   */
  generateCancellationScript(subscriptionName: string, provider: string): string {
    const providerInfo = this.getProviderInfo(provider);
    const difficulty = providerInfo?.difficulty ?? 'medium';

    let retentionSection = '';
    if (difficulty === 'hard' || difficulty === 'medium') {
      retentionSection = `
HANDLING RETENTION OFFERS:
----------------------------------------
The representative may try to keep you as a customer. Here is how to respond:

If offered a discount:
"I appreciate the offer, but I have made my decision and would like to proceed with the cancellation."

If offered a pause or hold:
"Thank you, but I would prefer a full cancellation rather than a temporary pause."

If offered a downgrade:
"No, thank you. I would like to fully cancel my subscription."

If pressed for a reason:
"I have personal reasons for cancelling. Please process my cancellation request."
`;
    }

    return `PHONE CANCELLATION SCRIPT
==================================================
Service: ${subscriptionName}
${providerInfo?.phoneNumber ? `Phone: ${providerInfo.phoneNumber}` : 'Phone: Check the provider website for their support number'}
${difficulty === 'hard' ? '\nWARNING: This provider is known for aggressive retention tactics.\nBe firm and polite. Budget 20-30 minutes for this call.\n' : ''}
--------------------------------------------------

STEP 1 - OPENING
"Hello, I would like to cancel my ${subscriptionName} subscription, please."

STEP 2 - ACCOUNT VERIFICATION
Have the following ready:
- Your full name
- Account email address
- Last 4 digits of payment method
- Account or member number (if applicable)

"My name is [YOUR NAME] and the account email is [YOUR EMAIL]."

STEP 3 - STATE YOUR REQUEST
"I would like to cancel my subscription effective today."
${retentionSection}
STEP 4 - CONFIRM CANCELLATION DETAILS
"Before we end this call, can you please confirm:
 1. My subscription is now fully cancelled
 2. No further charges will be made to my payment method
 3. The date when my access will end
 4. The confirmation or reference number for this cancellation"

STEP 5 - REQUEST WRITTEN CONFIRMATION
"Please send a cancellation confirmation email to [YOUR EMAIL]."

--------------------------------------------------
RECORD THESE DETAILS:
- Confirmation number: ________________
- Representative name: ________________
- Date and time of call: ________________
- Access end date: ________________
--------------------------------------------------`;
  }

  /**
   * Calculate total savings from completed cancellations.
   * Returns a detailed breakdown including per-subscription savings.
   */
  async trackSavings(userId: string): Promise<SavingsBreakdown> {
    const cancellations = await this.db
      .select({
        status: cancellationRequests.status,
        subscriptionName: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        cancelledAt: cancellationRequests.cancellationConfirmedAt,
      })
      .from(cancellationRequests)
      .leftJoin(
        schema.recurringTransactions,
        eq(cancellationRequests.subscriptionId, schema.recurringTransactions.id),
      )
      .where(eq(cancellationRequests.userId, userId))
      .orderBy(desc(cancellationRequests.createdAt));

    let totalCancelled = 0;
    let totalPending = 0;
    let estimatedMonthlySavings = 0;
    const cancelledSubscriptions: SavingsBreakdown['cancelledSubscriptions'] = [];

    for (const c of cancellations) {
      if (c.status === 'completed') {
        totalCancelled++;
        if (c.estimatedAmount && c.frequency) {
          const multiplier = FREQUENCY_MONTHLY_MULTIPLIER[c.frequency] ?? 1;
          const monthlySaving = c.estimatedAmount * multiplier;
          estimatedMonthlySavings += monthlySaving;
          cancelledSubscriptions.push({
            name: c.merchantName ?? c.subscriptionName ?? 'Unknown',
            amount: c.estimatedAmount,
            frequency: c.frequency,
            cancelledAt: c.cancelledAt,
          });
        }
      } else if (c.status === 'pending' || c.status === 'in_progress') {
        totalPending++;
      }
    }

    return {
      totalCancelled,
      totalPending,
      estimatedMonthlySavings: Math.round(estimatedMonthlySavings * 100) / 100,
      estimatedAnnualSavings: Math.round(estimatedMonthlySavings * 12 * 100) / 100,
      cancelledSubscriptions,
    };
  }
}
