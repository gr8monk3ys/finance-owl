import { Injectable } from '@nestjs/common';
import {
  PROVIDER_DATABASE,
  normalizeProviderKey,
  type ProviderInfo,
} from './providers';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NegotiationStrategy {
  billType: string;
  provider: string;
  currentAmount: number;
  targetAmount: number;
  savingsPercent: number;
  recommendedApproach: 'phone' | 'email' | 'chat';
  bestTimeToCall: string;
  departmentToAsk: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedSuccessRate: number;
  steps: NegotiationStep[];
  keyPhrases: string[];
  competitorOffers: CompetitorOffer[];
  providerTips: string[];
}

export interface NegotiationStep {
  order: number;
  title: string;
  description: string;
  script: string;
  notes: string;
}

export interface CompetitorOffer {
  competitor: string;
  price: string;
  details: string;
  useAs: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
  followUpSubject: string;
  followUpBody: string;
}

export interface ChatScript {
  greeting: string;
  steps: { prompt: string; expectedResponse: string; followUp: string }[];
  closingSuccess: string;
  closingEscalate: string;
}

export interface SavingsEstimate {
  billType: string;
  currentAmount: number;
  estimatedMonthlySavingsMin: number;
  estimatedMonthlySavingsMax: number;
  estimatedAnnualSavingsMin: number;
  estimatedAnnualSavingsMax: number;
  savingsPercentMin: number;
  savingsPercentMax: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface ProviderTipsResult {
  provider: string;
  providerKey: string | null;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  retentionNumber: string;
  bestTimeToCall: string;
  tips: string[];
  commonOffers: string[];
  competitorPricing: { competitor: string; price: string; details: string }[];
  successRate: number;
  avgSavingsPercent: number;
  keyDepartment: string;
  negotiationNotes: string[];
}

// ─── Savings percentages by bill type ───────────────────────────────────────

const BILL_TYPE_SAVINGS: Record<
  string,
  {
    minPercent: number;
    maxPercent: number;
    difficulty: 'easy' | 'medium' | 'hard';
    recommendedApproach: 'phone' | 'email' | 'chat';
    department: string;
  }
> = {
  internet: {
    minPercent: 15,
    maxPercent: 30,
    difficulty: 'easy',
    recommendedApproach: 'phone',
    department: 'Retention / Loyalty Department',
  },
  cable: {
    minPercent: 20,
    maxPercent: 30,
    difficulty: 'easy',
    recommendedApproach: 'phone',
    department: 'Retention / Cancellation Department',
  },
  phone: {
    minPercent: 10,
    maxPercent: 25,
    difficulty: 'medium',
    recommendedApproach: 'phone',
    department: 'Customer Loyalty Department',
  },
  insurance: {
    minPercent: 15,
    maxPercent: 30,
    difficulty: 'medium',
    recommendedApproach: 'phone',
    department: 'Policy Review / Underwriting',
  },
  medical: {
    minPercent: 20,
    maxPercent: 50,
    difficulty: 'medium',
    recommendedApproach: 'phone',
    department: 'Billing / Financial Assistance Department',
  },
  utility: {
    minPercent: 5,
    maxPercent: 20,
    difficulty: 'hard',
    recommendedApproach: 'phone',
    department: 'Customer Service / Rate Review',
  },
  streaming: {
    minPercent: 20,
    maxPercent: 40,
    difficulty: 'easy',
    recommendedApproach: 'chat',
    department: 'Customer Support / Cancellation',
  },
  utilities: {
    minPercent: 5,
    maxPercent: 20,
    difficulty: 'hard',
    recommendedApproach: 'phone',
    department: 'Customer Service / Rate Review',
  },
  other: {
    minPercent: 10,
    maxPercent: 20,
    difficulty: 'medium',
    recommendedApproach: 'phone',
    department: 'Customer Service / Retention',
  },
};

// ─── Extended provider tips database (30+ providers) ────────────────────────

const EXTENDED_PROVIDER_TIPS: Record<
  string,
  {
    negotiationNotes: string[];
    keyDepartment: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }
> = {
  comcast: {
    negotiationNotes: [
      'Comcast/Xfinity is one of the most negotiable providers. Their retention department has significant authority to offer discounts.',
      'Always ask for the retention or loyalty department. Front-line agents have limited discount authority.',
      'If you mention canceling, you will be transferred to the "save" team which typically has the best offers.',
      'Xfinity mobile bundle deals can sometimes lower your overall bill even if the internet price stays similar.',
      'Check the Xfinity app for self-service promotional offers before calling.',
    ],
    keyDepartment: 'Retention / Loyalty Department',
    difficulty: 'easy',
  },
  spectrum: {
    negotiationNotes: [
      'Spectrum does not use contracts, which means you can leave at any time. Use this as leverage.',
      'Their retention department is accessed by asking to cancel your service.',
      'Spectrum periodically raises rates. Calling within 30 days of a rate increase gives the strongest negotiation position.',
      'Online chat can sometimes offer similar deals with shorter wait times.',
    ],
    keyDepartment: 'Retention Department',
    difficulty: 'easy',
  },
  'att-internet': {
    negotiationNotes: [
      'Press the cancellation option on the phone tree to reach retention faster.',
      'AT&T loyalty offers are often not advertised and must be specifically requested.',
      'If you also have AT&T Wireless, bundling can provide an additional 5-10% discount.',
      'Ask about their price-lock guarantee on fiber plans.',
    ],
    keyDepartment: 'Customer Loyalty Department',
    difficulty: 'medium',
  },
  'att-wireless': {
    negotiationNotes: [
      'Check for corporate/employer discounts (FAN discounts) which can save 15-25%.',
      'Military, first responder, teacher, and nurse discounts are significant and stackable.',
      'Consider AT&T Prepaid plans as an alternative that can save 40-50%.',
      'Multi-line plans get cheaper per line. Consider consolidating family members.',
    ],
    keyDepartment: 'Customer Loyalty / Retention',
    difficulty: 'medium',
  },
  'verizon-fios': {
    negotiationNotes: [
      'Verizon Fios Mix & Match plans can be restructured to lower your bill.',
      'If you have Verizon Wireless, the combined discount can be substantial.',
      'The Verizon app chat feature sometimes provides quicker access to retention offers.',
      'Ask about autopay and paperless billing discounts which save $5-10/month.',
    ],
    keyDepartment: 'Customer Retention',
    difficulty: 'medium',
  },
  'verizon-wireless': {
    negotiationNotes: [
      'Review your myPlan add-ons. Many customers pay for perks they do not use.',
      'Autopay with a debit card or bank account saves $10/month per line.',
      'Employer corporate discounts can provide 15-22% off. Check your company HR portal.',
      'Device payment plans may be inflating your bill. Check if any phones are already paid off.',
    ],
    keyDepartment: 'Customer Loyalty',
    difficulty: 'hard',
  },
  tmobile: {
    negotiationNotes: [
      'Ask about the T-Mobile Insider discount which is 20% off for life when available.',
      'T-Mobile includes Netflix on many plans. Cancel your separate Netflix subscription.',
      'Contact T-Force on Twitter/X for faster and sometimes better results than phone support.',
      'Military and first responder discounts can be up to 50% off (Magenta Military).',
    ],
    keyDepartment: 'Customer Care / T-Force',
    difficulty: 'medium',
  },
  sprint: {
    negotiationNotes: [
      'Sprint has merged with T-Mobile. You may get better pricing by migrating to a T-Mobile plan.',
      'Legacy Sprint plans may have features that new T-Mobile plans do not include. Verify before switching.',
      'Ask about special migration promotions available only to Sprint legacy customers.',
    ],
    keyDepartment: 'Migration / Customer Care',
    difficulty: 'easy',
  },
  'state-farm': {
    negotiationNotes: [
      'State Farm works through local agents. Building a relationship with your agent can lead to better advocacy for discounts.',
      'Ask for a full discount review. Many customers miss multi-policy, good driver, or safety feature discounts.',
      'Drive Safe & Save telematics program can provide up to 30% savings for safe drivers.',
      'Increasing deductibles from $500 to $1,000 typically saves 15-25% on premiums.',
      'Ask about paying annually instead of monthly for a 5-10% discount.',
    ],
    keyDepartment: 'Local Agent / Policy Review',
    difficulty: 'medium',
  },
  geico: {
    negotiationNotes: [
      'GEICO is already competitively priced, so negotiate by optimizing coverage rather than just asking for discounts.',
      'Check for professional organization, alumni, military, and federal employee discounts.',
      'Bundling renters/homeowners insurance can provide additional savings.',
      'Ask about the pay-in-full discount which can save 5-10% for annual payment.',
      'Review coverage on older vehicles. Drop comprehensive/collision on cars worth less than $5,000.',
    ],
    keyDepartment: 'Customer Service / Policy Review',
    difficulty: 'medium',
  },
  progressive: {
    negotiationNotes: [
      'The Snapshot program can save up to 30% for safe drivers. Ask about enrollment.',
      'Progressive shows competitor rates on their website. Use this transparency in your favor.',
      'The "Name Your Price" tool can help find coverage within your budget.',
      'Multi-vehicle and multi-policy discounts are significant with Progressive.',
    ],
    keyDepartment: 'Customer Service',
    difficulty: 'medium',
  },
  allstate: {
    negotiationNotes: [
      'Allstate tends to be on the higher end of pricing. Getting competitor quotes gives strong leverage.',
      'The Drivewise program can provide up to 40% savings for safe driving habits.',
      'Check your Allstate Rewards balance for unclaimed credits.',
      'Ask your local agent for a full discount review when rates increase.',
    ],
    keyDepartment: 'Local Agent / Customer Service',
    difficulty: 'easy',
  },
  usaa: {
    negotiationNotes: [
      'USAA already has very competitive rates for military members. Focus on optimizing coverage.',
      'SafePilot usage-based savings can provide additional discounts.',
      'Bundling all policies (auto, home, life) maximizes the discount.',
      'Ask about the annual dividend. USAA sometimes returns money to members.',
    ],
    keyDepartment: 'Member Services',
    difficulty: 'hard',
  },
  netflix: {
    negotiationNotes: [
      'Netflix has limited negotiation options. Focus on plan optimization.',
      'The ad-supported tier at $6.99/mo is half the price with minimal ad interruption.',
      'Check if your phone carrier includes Netflix free (T-Mobile, some Verizon plans).',
      'Cancel and wait 1-2 months. Netflix sometimes sends "come back" offers with a free month.',
      'Rotate streaming services monthly rather than paying for all simultaneously.',
    ],
    keyDepartment: 'Customer Support (Online)',
    difficulty: 'hard',
  },
  hulu: {
    negotiationNotes: [
      'Hulu is one of the most negotiable streaming services.',
      'Starting the online cancellation flow often triggers a $1.99/month retention offer.',
      'The Disney Bundle (Hulu + Disney+ + ESPN+) is often cheaper than Hulu alone at full price.',
      'Students get Hulu with ads for $1.99/month.',
      'Black Friday typically offers $0.99-1.99/month annual deals.',
    ],
    keyDepartment: 'Online Cancellation Flow / Chat',
    difficulty: 'easy',
  },
  'disney-plus': {
    negotiationNotes: [
      'The Disney Bundle with Hulu and ESPN+ provides the best value.',
      'Annual billing saves about 15% compared to monthly.',
      'Check if your Verizon plan includes Disney+ for free.',
      'Cancel and resubscribe seasonally when new content drops.',
    ],
    keyDepartment: 'Customer Support',
    difficulty: 'medium',
  },
  'hbo-max': {
    negotiationNotes: [
      'Now rebranded as "Max" with tiered pricing. Review which tier you actually need.',
      'Annual subscription saves about 20% compared to monthly.',
      'If you have AT&T Internet or DirecTV, check if Max is included.',
      'Going through the online cancellation flow sometimes triggers retention offers.',
    ],
    keyDepartment: 'Customer Support (Online)',
    difficulty: 'medium',
  },
  spotify: {
    negotiationNotes: [
      'Spotify Premium Family ($16.99/mo for 6 accounts) is the best per-person value.',
      'Students get Premium plus Hulu and Showtime for $5.99/month.',
      'If you cancel, Spotify often sends discount offers via email within 2-4 weeks.',
      'Check if your employer or health insurance offers Spotify as a wellness benefit.',
    ],
    keyDepartment: 'Online Chat Support',
    difficulty: 'medium',
  },
  'apple-music': {
    negotiationNotes: [
      'Apple One bundle ($19.95/mo) includes Music, TV+, Arcade, and iCloud+.',
      'Student pricing includes Apple TV+ free.',
      'New Apple device purchases often come with free Apple Music trials.',
      'Annual billing saves about 15% compared to monthly.',
    ],
    keyDepartment: 'Apple Support',
    difficulty: 'hard',
  },
  'utilities-general': {
    negotiationNotes: [
      'Ask about budget billing or equal payment plans to smooth out seasonal spikes.',
      'Time-of-use rates can save 20-40% by shifting heavy usage to off-peak hours.',
      'Check for LIHEAP or other income-based assistance programs.',
      'Ask about energy efficiency rebates for smart thermostats and LED bulbs.',
      'In deregulated markets, shop for a different energy supplier at a lower rate.',
    ],
    keyDepartment: 'Customer Service / Rate Review',
    difficulty: 'hard',
  },
  cox: {
    negotiationNotes: [
      'Cox has a 1.25 TB data cap. Ask about having it waived or getting an unlimited add-on discount.',
      'Cox Mobile launched recently. Ask about bundle savings if you switch your phone plan too.',
      'Try negotiating through the Cox app chat for faster response times.',
      'Request waiving any recent price increases retroactively.',
    ],
    keyDepartment: 'Retention / Loyalty Department',
    difficulty: 'medium',
  },
  centurylink: {
    negotiationNotes: [
      'CenturyLink offers a "Price for Life" guarantee on some plans. Ask about this specifically.',
      'If you are on DSL, ask about fiber availability. Fiber plans may be cheaper.',
      'The rebrand to Quantum Fiber may come with different plan options and pricing.',
      'Check if you qualify for any income-based discount programs.',
    ],
    keyDepartment: 'Customer Service / Retention',
    difficulty: 'medium',
  },
};

// ─── Medical billing key phrases ────────────────────────────────────────────

const MEDICAL_BILLING_KEY_PHRASES = [
  '"I would like to request an itemized bill with all charges and procedure codes."',
  '"Can you tell me what the self-pay or uninsured rate would be for this service?"',
  '"I am experiencing financial hardship. Does your facility have a financial assistance or charity care program?"',
  '"I have compared these charges to Medicare rates, and it appears the billed amount is significantly higher than the Medicare-approved amount."',
  '"I would like to set up a payment plan. Can we discuss a zero-interest arrangement?"',
  '"I am prepared to pay $X today if we can agree on a reduced total balance."',
  '"Can I speak with a supervisor or patient financial services manager about reducing this bill?"',
  '"I would like to apply for your facility\'s financial assistance program."',
];

@Injectable()
export class NegotiationAiService {
  /**
   * Generate a comprehensive negotiation strategy for a bill.
   */
  generateNegotiationStrategy(
    billType: string,
    currentAmount: number,
    provider: string,
  ): NegotiationStrategy {
    const providerKey = normalizeProviderKey(provider);
    const providerInfo: ProviderInfo | null = providerKey
      ? PROVIDER_DATABASE[providerKey] ?? null
      : null;
    const billConfig = BILL_TYPE_SAVINGS[billType] ?? BILL_TYPE_SAVINGS['other'];
    const extendedTips = providerKey
      ? EXTENDED_PROVIDER_TIPS[providerKey] ?? null
      : null;

    const savingsPercent =
      providerInfo?.averageSavingsPercent ?? billConfig.maxPercent;
    const targetAmount =
      Math.round(currentAmount * (1 - savingsPercent / 100) * 100) / 100;

    const successRate =
      providerInfo?.successRate ?? this.getDefaultSuccessRate(billType);
    const difficulty = extendedTips?.difficulty ?? billConfig.difficulty;
    const recommendedApproach = billConfig.recommendedApproach;
    const bestTimeToCall =
      providerInfo?.bestTimeToCall ?? 'Tuesday-Thursday, 8-10 AM local time';
    const departmentToAsk = extendedTips?.keyDepartment ?? billConfig.department;
    const displayProvider = providerInfo?.name ?? provider;

    const steps = this.buildNegotiationSteps(
      billType,
      displayProvider,
      currentAmount,
      targetAmount,
      providerInfo,
    );

    const keyPhrases = this.buildKeyPhrases(
      billType,
      displayProvider,
      currentAmount,
      targetAmount,
    );

    const competitorOffers: CompetitorOffer[] = (
      providerInfo?.competitorPricing ?? []
    ).map((cp) => ({
      competitor: cp.competitor,
      price: cp.price,
      details: cp.details,
      useAs: `Mention that ${cp.competitor} is offering ${cp.price} (${cp.details}) as an alternative.`,
    }));

    const providerTips = [
      ...(providerInfo?.tips ?? []),
      ...(extendedTips?.negotiationNotes ?? []),
    ];

    return {
      billType,
      provider: displayProvider,
      currentAmount,
      targetAmount,
      savingsPercent,
      recommendedApproach,
      bestTimeToCall,
      departmentToAsk,
      difficulty,
      estimatedSuccessRate: successRate,
      steps,
      keyPhrases,
      competitorOffers,
      providerTips: [...new Set(providerTips)],
    };
  }

  /**
   * Generate a formal negotiation email template.
   */
  generateEmailTemplate(
    billType: string,
    provider: string,
    currentAmount: number,
    targetAmount: number,
  ): EmailTemplate {
    const providerKey = normalizeProviderKey(provider);
    const providerInfo = providerKey
      ? PROVIDER_DATABASE[providerKey] ?? null
      : null;
    const displayProvider = providerInfo?.name ?? provider;

    const competitorLine =
      providerInfo?.competitorPricing &&
      providerInfo.competitorPricing.length > 0
        ? `I have received competitive offers from providers such as ${providerInfo.competitorPricing
            .slice(0, 2)
            .map((c) => `${c.competitor} (${c.price})`)
            .join(
              ' and ',
            )}, which are significantly lower than my current rate.`
        : 'I have been researching competitive offers from other providers in my area, and I have found several options that are significantly lower than my current rate.';

    const isMedical = billType === 'medical';

    const subject = isMedical
      ? 'Request for Bill Review and Financial Assistance - Account [YOUR ACCOUNT NUMBER]'
      : 'Long-term Customer Requesting Rate Review - Account [YOUR ACCOUNT NUMBER]';

    const body = isMedical
      ? this.generateMedicalEmailBody(displayProvider, currentAmount, targetAmount)
      : this.generateStandardEmailBody(
          displayProvider,
          currentAmount,
          targetAmount,
          competitorLine,
          billType,
        );

    const followUpSubject = isMedical
      ? 'Follow-up: Bill Review Request - Account [YOUR ACCOUNT NUMBER]'
      : 'Follow-up: Rate Review Request - Account [YOUR ACCOUNT NUMBER]';

    const followUpBody = [
      `Dear ${displayProvider} Customer Service,`,
      '',
      `I am writing to follow up on my previous request regarding a rate review for my account [YOUR ACCOUNT NUMBER], sent on [DATE OF ORIGINAL EMAIL].`,
      '',
      `I have not yet received a response and would appreciate an update on the status of my request. As mentioned previously, I am currently paying $${currentAmount.toFixed(2)} per month and am seeking a rate closer to $${targetAmount.toFixed(2)} per month.`,
      '',
      `I value my relationship with ${displayProvider} and hope we can reach an arrangement that allows me to continue as a customer. However, if I am unable to receive a competitive rate, I will need to explore other options.`,
      '',
      'Please contact me at [YOUR PHONE NUMBER] or reply to this email at your earliest convenience.',
      '',
      'Thank you for your time.',
      '',
      'Sincerely,',
      '[YOUR NAME]',
      'Account: [YOUR ACCOUNT NUMBER]',
      'Phone: [YOUR PHONE NUMBER]',
    ].join('\n');

    return { subject, body, followUpSubject, followUpBody };
  }

  /**
   * Generate a live chat negotiation script with prompts and expected responses.
   */
  generateChatScript(billType: string, provider: string): ChatScript {
    const providerKey = normalizeProviderKey(provider);
    const providerInfo = providerKey
      ? PROVIDER_DATABASE[providerKey] ?? null
      : null;
    const displayProvider = providerInfo?.name ?? provider;

    const greeting = `Hello, I have been a loyal ${displayProvider} customer for [X years/months]. I am reaching out because I have been reviewing my monthly expenses and would like to discuss options for reducing my ${billType} bill. Could you help me with this?`;

    const steps = [
      {
        prompt:
          'I am currently paying $[AMOUNT] per month, and I have noticed that new customers and competitors are offering significantly lower rates. I was hoping to see if there are any promotions or loyalty discounts available for my account.',
        expectedResponse:
          'The agent will likely review your account and may offer a small discount or explain current pricing.',
        followUp:
          'Thank you for checking. I appreciate that offer, but I was hoping for something closer to what new customers receive. I have been a loyal customer and would like to continue, but I need the pricing to be more competitive. Are there any retention or loyalty department offers available?',
      },
      {
        prompt:
          'I understand you may have limitations on what you can offer. I have received quotes from [COMPETITOR 1] and [COMPETITOR 2] that are $[AMOUNT] lower per month. Is there someone in the retention or loyalty department who might have additional options?',
        expectedResponse:
          'The agent may transfer you to retention or offer an improved discount.',
        followUp:
          'I appreciate your help. Before we proceed, I want to make sure I am getting the best possible rate. Can you confirm this is the best offer available? I would hate to switch providers over a small difference.',
      },
      {
        prompt:
          'If this is the best available offer, I may need to consider my other options. Would it be possible to speak with a supervisor or retention specialist who might have access to additional promotions?',
        expectedResponse:
          'At this point the agent will typically either provide a better offer or escalate your request.',
        followUp:
          'Thank you for your help. Can you please provide me with a reference number for this conversation and confirm any changes to my account in writing?',
      },
    ];

    const closingSuccess = `Thank you so much for your help today. I really appreciate ${displayProvider} working with me on this. Can you please confirm the new rate, when it takes effect, and how long the promotional pricing will last? Also, please send me a confirmation email at [YOUR EMAIL].`;

    const closingEscalate =
      'I appreciate your time, but I am not satisfied with the options presented. I would like to formally request a callback from a retention supervisor or manager. My account number is [ACCOUNT NUMBER] and I can be reached at [PHONE NUMBER]. Thank you.';

    return { greeting, steps, closingSuccess, closingEscalate };
  }

  /**
   * Estimate potential savings for a bill type.
   */
  estimateSavings(billType: string, currentAmount: number): SavingsEstimate {
    const config = BILL_TYPE_SAVINGS[billType] ?? BILL_TYPE_SAVINGS['other'];

    const minSavings =
      Math.round(currentAmount * (config.minPercent / 100) * 100) / 100;
    const maxSavings =
      Math.round(currentAmount * (config.maxPercent / 100) * 100) / 100;

    let confidence: 'low' | 'medium' | 'high';
    if (
      billType === 'internet' ||
      billType === 'cable' ||
      billType === 'streaming'
    ) {
      confidence = 'high';
    } else if (billType === 'phone' || billType === 'insurance') {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      billType,
      currentAmount,
      estimatedMonthlySavingsMin: minSavings,
      estimatedMonthlySavingsMax: maxSavings,
      estimatedAnnualSavingsMin: Math.round(minSavings * 12 * 100) / 100,
      estimatedAnnualSavingsMax: Math.round(maxSavings * 12 * 100) / 100,
      savingsPercentMin: config.minPercent,
      savingsPercentMax: config.maxPercent,
      confidence,
    };
  }

  /**
   * Get provider-specific tips for negotiating.
   */
  getProviderTips(provider: string): ProviderTipsResult | null {
    const providerKey = normalizeProviderKey(provider);
    if (!providerKey) {
      return null;
    }

    const providerInfo = PROVIDER_DATABASE[providerKey];
    if (!providerInfo) {
      return null;
    }

    const extended = EXTENDED_PROVIDER_TIPS[providerKey];

    return {
      provider: providerInfo.name,
      providerKey,
      category: providerInfo.category,
      difficulty: extended?.difficulty ?? 'medium',
      retentionNumber: providerInfo.retentionPhone,
      bestTimeToCall: providerInfo.bestTimeToCall,
      tips: providerInfo.tips,
      commonOffers: providerInfo.typicalOffers,
      competitorPricing: providerInfo.competitorPricing,
      successRate: providerInfo.successRate,
      avgSavingsPercent: providerInfo.averageSavingsPercent,
      keyDepartment: extended?.keyDepartment ?? 'Customer Service / Retention',
      negotiationNotes: extended?.negotiationNotes ?? [],
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private getDefaultSuccessRate(billType: string): number {
    const rates: Record<string, number> = {
      internet: 70,
      cable: 72,
      phone: 58,
      insurance: 65,
      medical: 60,
      streaming: 45,
      utility: 50,
      utilities: 50,
      other: 50,
    };
    return rates[billType] ?? 50;
  }

  private buildNegotiationSteps(
    billType: string,
    provider: string,
    currentAmount: number,
    targetAmount: number,
    providerInfo: ProviderInfo | null,
  ): NegotiationStep[] {
    if (billType === 'medical') {
      return this.buildMedicalNegotiationSteps(provider, currentAmount, targetAmount);
    }

    const competitorMention =
      providerInfo?.competitorPricing &&
      providerInfo.competitorPricing.length > 0
        ? `${providerInfo.competitorPricing[0].competitor} at ${providerInfo.competitorPricing[0].price}`
        : 'competitors offering lower rates';

    return [
      {
        order: 1,
        title: 'Prepare Before Calling',
        description:
          'Gather your account information, recent bills, and competitor pricing. Write down your target price and key talking points.',
        script: '',
        notes: `Have your account number ready. Know your current plan details. Have competitor quotes open for reference. Target: $${targetAmount.toFixed(2)}/month.`,
      },
      {
        order: 2,
        title: 'Call and Request Retention',
        description: `Call ${provider} and navigate to the retention or loyalty department. Do not negotiate with the first representative.`,
        script: `"Hi, I have been a loyal ${provider} customer for [X years]. I would like to speak with someone in the retention or loyalty department about my account, please."`,
        notes: 'If asked why, say: "I am reviewing my options and considering changes to my service." This signals to the system that you may cancel, which routes you to retention.',
      },
      {
        order: 3,
        title: 'State Your Case',
        description:
          'Explain that you have been a loyal customer but your bill is too high. Be specific about what you want.',
        script: `"Thank you for helping me today. I have been a customer for [X years] and I have always paid on time. However, I have been reviewing my expenses and my current bill of $${currentAmount.toFixed(2)} per month is higher than what I am comfortable with. I have been looking at other options, including ${competitorMention}, and I was hoping we could work something out so I can stay with ${provider}."`,
        notes:
          'Be calm, polite, and firm. Do not be aggressive or threatening. The goal is to present yourself as a reasonable customer who wants to stay but needs a better price.',
      },
      {
        order: 4,
        title: 'Make Your Ask',
        description:
          'Request your specific target price. Anchor the negotiation with your desired amount.',
        script: `"Based on what I am seeing from other providers, I would like to get my bill down to around $${targetAmount.toFixed(2)} per month. Is there anything you can do to help me reach that number?"`,
        notes:
          'Let them respond. Do not fill the silence. If they offer something, consider it but do not accept immediately unless it meets your target.',
      },
      {
        order: 5,
        title: 'Counter Their Offer',
        description:
          'If the first offer is not sufficient, push back politely. Ask about unadvertised promotions.',
        script:
          '"I appreciate that offer, but it is still higher than what I was hoping for. I was expecting something closer to the new customer rate. Are there any unadvertised promotions or additional loyalty discounts available? I have been a great customer and I would really prefer to stay."',
        notes:
          'Mention specific competitor offers by name and price. Ask if they can match or beat those offers.',
      },
      {
        order: 6,
        title: 'Escalate If Needed',
        description:
          'If the agent cannot meet your target, ask for a supervisor or the cancellation department.',
        script:
          '"I appreciate your help, but this offer does not quite meet my needs. Could you please transfer me to a supervisor or someone with more authority on pricing? If we cannot work something out, I may need to consider canceling."',
        notes:
          'The cancellation or "save" team typically has the deepest discounts. Be prepared to actually cancel if necessary. Sometimes the best offer comes only after you confirm cancellation.',
      },
      {
        order: 7,
        title: 'Close the Deal',
        description:
          'Once you receive an acceptable offer, confirm all details and get a reference number.',
        script:
          '"That works for me, thank you. Can you please confirm the new monthly rate, when it takes effect, and how long this promotional price will last? Also, could I get a reference number and your name for my records?"',
        notes:
          'Write down the agent name, reference number, new rate, effective date, and expiration date. Set a calendar reminder to renegotiate before the promotional rate expires.',
      },
    ];
  }

  private buildMedicalNegotiationSteps(
    provider: string,
    currentAmount: number,
    targetAmount: number,
  ): NegotiationStep[] {
    return [
      {
        order: 1,
        title: 'Request an Itemized Bill',
        description:
          'Before negotiating, request a fully itemized bill with procedure codes (CPT codes) and descriptions.',
        script: `"I am calling about my bill for account [ACCOUNT NUMBER]. Before I discuss payment, I would like to request a fully itemized bill with all procedure codes, descriptions, and individual charges."`,
        notes:
          'Hospitals are required to provide an itemized bill. Review it carefully for errors, duplicate charges, or services you did not receive.',
      },
      {
        order: 2,
        title: 'Review for Errors',
        description:
          'Check the itemized bill against your records. Compare prices to Medicare rates.',
        script: '',
        notes:
          'Use the CMS Healthcare Price Transparency tool to compare billed amounts to Medicare rates. Look for: duplicate charges, incorrect procedure codes, charges for services not received, and unbundled charges.',
      },
      {
        order: 3,
        title: 'Ask About Self-Pay Rate',
        description: `Call ${provider} billing department and ask about the self-pay or cash-pay rate.`,
        script: `"I have reviewed my itemized bill totaling $${currentAmount.toFixed(2)}. I would like to know what the self-pay or uninsured rate would be for these services. I understand many facilities offer a significant discount for self-pay patients."`,
        notes:
          'Self-pay rates are typically 40-60% less than the billed amount. Under the No Surprises Act, hospitals must provide good-faith estimates.',
      },
      {
        order: 4,
        title: 'Request Financial Assistance',
        description:
          'Ask about the hospital or provider financial assistance or charity care program.',
        script:
          '"I am experiencing financial difficulty and would like to apply for your financial assistance program. Can you provide me with the application and tell me about the eligibility requirements?"',
        notes:
          'Most nonprofit hospitals are required to have charity care programs. Eligibility is typically based on income as a percentage of the federal poverty level (usually 200-400% FPL).',
      },
      {
        order: 5,
        title: 'Negotiate the Amount',
        description:
          'Make a specific offer based on your research and financial situation.',
        script: `"Based on my review of the itemized charges and comparison to standard rates, I believe a fair amount for these services would be approximately $${targetAmount.toFixed(2)}. I am prepared to pay this amount [today/in a structured payment plan]."`,
        notes:
          'Offering to pay immediately or in a short payment plan gives you more leverage. Start lower than your target to leave room for negotiation.',
      },
      {
        order: 6,
        title: 'Set Up Payment Plan',
        description:
          'If you cannot pay in full, negotiate a zero-interest payment plan.',
        script:
          '"I would like to set up a payment plan for the agreed amount. Can we arrange a zero-interest plan with monthly payments? I want to ensure this account stays in good standing and does not go to collections."',
        notes:
          'Get the payment plan terms in writing. Confirm there are no interest charges or fees. Make payments on time to avoid the bill being sent to collections.',
      },
      {
        order: 7,
        title: 'Get Everything in Writing',
        description:
          'Request written confirmation of any discounts, adjustments, or payment plans.',
        script:
          '"Thank you for working with me on this. Could you please send me written confirmation of the adjusted amount, the payment plan terms, and a reference number for this agreement?"',
        notes:
          'Keep all documentation. If the provider does not honor the agreement, you will need proof of what was discussed.',
      },
    ];
  }

  private buildKeyPhrases(
    billType: string,
    provider: string,
    currentAmount: number,
    targetAmount: number,
  ): string[] {
    if (billType === 'medical') {
      return MEDICAL_BILLING_KEY_PHRASES;
    }

    return [
      '"I have been a loyal customer for [X years] and have always paid on time."',
      '"I am considering switching to [competitor name] because they are offering a lower rate."',
      '"Can you check for any available promotions or loyalty discounts on my account?"',
      '"I would like to speak with the retention or loyalty department, please."',
      '"Are there any unadvertised promotional rates available for existing customers?"',
      `"I am currently paying $${currentAmount.toFixed(2)} per month, and I would like to get closer to $${targetAmount.toFixed(2)}."`,
      '"What is the best rate you can offer to keep me as a customer?"',
      `"I would prefer to stay with ${provider}, but the pricing needs to make sense for my budget."`,
      '"Can you match or beat what [competitor] is offering?"',
      '"If we cannot work something out today, I will need to start the cancellation process."',
    ];
  }

  private generateStandardEmailBody(
    provider: string,
    currentAmount: number,
    targetAmount: number,
    competitorLine: string,
    billType: string,
  ): string {
    return [
      `Dear ${provider} Customer Service,`,
      '',
      `I am writing as a long-term customer to request a review of my current ${billType} service rate. My account number is [YOUR ACCOUNT NUMBER], and I have been a loyal ${provider} customer for [X years/months].`,
      '',
      `I am currently paying $${currentAmount.toFixed(2)} per month for my ${billType} service. While I have always been satisfied with the quality of service, I have noticed that my current rate is significantly higher than what is available to new customers and from competing providers.`,
      '',
      competitorLine,
      '',
      `As a loyal customer who has consistently paid on time, I believe I deserve a competitive rate. I am requesting a rate adjustment to approximately $${targetAmount.toFixed(2)} per month, which would be more in line with current market pricing.`,
      '',
      `I value my relationship with ${provider} and would prefer to continue my service. However, if we are unable to reach a competitive rate, I will need to explore the alternatives available to me.`,
      '',
      'I would appreciate a response within 5 business days. You can reach me at [YOUR PHONE NUMBER] or via email at [YOUR EMAIL].',
      '',
      'Thank you for your consideration.',
      '',
      'Sincerely,',
      '[YOUR NAME]',
      'Account: [YOUR ACCOUNT NUMBER]',
      'Phone: [YOUR PHONE NUMBER]',
      'Customer since: [START DATE]',
    ].join('\n');
  }

  private generateMedicalEmailBody(
    provider: string,
    currentAmount: number,
    targetAmount: number,
  ): string {
    return [
      `Dear ${provider} Billing Department,`,
      '',
      `I am writing regarding my account [YOUR ACCOUNT NUMBER] with a current balance of $${currentAmount.toFixed(2)} for services received on [DATE OF SERVICE].`,
      '',
      'I am requesting the following:',
      '',
      '1. A fully itemized bill with all CPT procedure codes, descriptions, and individual charges.',
      '',
      "2. Information about your facility's financial assistance or charity care program and the application process.",
      '',
      '3. A review of my charges in comparison to standard Medicare rates for the same procedures.',
      '',
      `I have reviewed my explanation of benefits and believe there may be opportunities to adjust the billed amount. Based on my research of fair market rates for these services, I would like to discuss a potential adjustment to approximately $${targetAmount.toFixed(2)}.`,
      '',
      'I am committed to resolving this balance and am prepared to discuss payment options including a lump-sum payment at a reduced rate or a structured payment plan.',
      '',
      'Please contact me at [YOUR PHONE NUMBER] or reply to this email to discuss this matter. I would appreciate a response within 10 business days.',
      '',
      'Thank you for your attention to this matter.',
      '',
      'Sincerely,',
      '[YOUR NAME]',
      'Account: [YOUR ACCOUNT NUMBER]',
      'Date of Service: [DATE]',
      'Phone: [YOUR PHONE NUMBER]',
    ].join('\n');
  }
}
