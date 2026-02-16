export interface CatalogProduct {
  name: string;
  provider: string;
  type:
    | 'credit_card'
    | 'savings_account'
    | 'checking_account'
    | 'personal_loan'
    | 'auto_loan'
    | 'mortgage'
    | 'investment_account';
  description: string;
  annualFee: number | null;
  interestRate: number | null;
  rewardType: 'cashback' | 'points' | 'miles' | null;
  features: string[];
  idealFor: string[];
  applyUrl: string;
}

export const PRODUCT_CATALOG: CatalogProduct[] = [
  // ── Credit Cards ──────────────────────────────────────────────────
  {
    name: 'Chase Sapphire Preferred',
    provider: 'Chase',
    type: 'credit_card',
    description:
      'Premium travel rewards card with 2x points on travel and dining, plus a generous sign-up bonus.',
    annualFee: 95,
    interestRate: 21.49,
    rewardType: 'points',
    features: [
      '2x points on travel and dining',
      '60,000 point sign-up bonus',
      'No foreign transaction fees',
      'Trip cancellation insurance',
      'Points transferable to airline partners',
    ],
    idealFor: ['high_travel_spending', 'dining_spending', 'points_maximizer'],
    applyUrl: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred',
  },
  {
    name: 'Chase Sapphire Reserve',
    provider: 'Chase',
    type: 'credit_card',
    description:
      'Ultra-premium travel card with 3x points on travel and dining, Priority Pass lounge access, and $300 travel credit.',
    annualFee: 550,
    interestRate: 22.49,
    rewardType: 'points',
    features: [
      '3x points on travel and dining',
      '$300 annual travel credit',
      'Priority Pass lounge access',
      'Global Entry / TSA PreCheck credit',
      '10x points on hotels and car rentals via Chase',
    ],
    idealFor: ['very_high_travel_spending', 'premium_traveler', 'lounge_access'],
    applyUrl: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve',
  },
  {
    name: 'Discover it Cash Back',
    provider: 'Discover',
    type: 'credit_card',
    description:
      'Rotating 5% categories card with first-year cashback match, effectively doubling all rewards.',
    annualFee: 0,
    interestRate: 17.24,
    rewardType: 'cashback',
    features: [
      '5% cashback on rotating quarterly categories',
      '1% on all other purchases',
      'First-year cashback match',
      'No annual fee',
      'Free FICO score',
    ],
    idealFor: ['no_annual_fee', 'cashback_maximizer', 'first_credit_card'],
    applyUrl: 'https://www.discover.com/credit-cards/cash-back/',
  },
  {
    name: 'Citi Double Cash',
    provider: 'Citi',
    type: 'credit_card',
    description:
      'Simple flat-rate 2% cashback on everything: 1% when you buy, 1% when you pay.',
    annualFee: 0,
    interestRate: 18.24,
    rewardType: 'cashback',
    features: [
      '2% cashback on all purchases',
      'No annual fee',
      'No rotating categories to track',
      '0% intro APR on balance transfers',
      'Citi Entertainment access',
    ],
    idealFor: ['simple_rewards', 'no_annual_fee', 'general_spending'],
    applyUrl: 'https://www.citi.com/credit-cards/citi-double-cash-credit-card',
  },
  {
    name: 'Capital One Venture X',
    provider: 'Capital One',
    type: 'credit_card',
    description:
      'Premium travel card with 2x miles on everything, lounge access, and $300 travel portal credit.',
    annualFee: 395,
    interestRate: 21.99,
    rewardType: 'miles',
    features: [
      '2x miles on all purchases',
      '10x miles on hotels and rental cars via Capital One Travel',
      '$300 annual travel credit',
      'Capital One Lounge and Priority Pass access',
      '10,000 anniversary mile bonus',
    ],
    idealFor: ['travel_spending', 'premium_traveler', 'miles_collector'],
    applyUrl: 'https://www.capitalone.com/credit-cards/venture-x/',
  },
  {
    name: 'Blue Cash Preferred',
    provider: 'American Express',
    type: 'credit_card',
    description:
      'Best-in-class 6% cashback on groceries and streaming, ideal for families.',
    annualFee: 95,
    interestRate: 19.24,
    rewardType: 'cashback',
    features: [
      '6% cashback at US supermarkets (up to $6k/yr)',
      '6% on select US streaming',
      '3% on transit and US gas stations',
      '1% on other purchases',
      '$250 statement credit after qualifying spend',
    ],
    idealFor: ['high_grocery_spending', 'family_spending', 'streaming_services'],
    applyUrl: 'https://www.americanexpress.com/us/credit-cards/card/blue-cash-preferred/',
  },
  {
    name: 'Citi Custom Cash',
    provider: 'Citi',
    type: 'credit_card',
    description:
      'Automatically earns 5% cashback on your top eligible spending category each billing cycle.',
    annualFee: 0,
    interestRate: 19.24,
    rewardType: 'cashback',
    features: [
      '5% on top eligible category each cycle (up to $500)',
      '1% on all other purchases',
      'No annual fee',
      '0% intro APR for 15 months',
      'Automatic category detection',
    ],
    idealFor: ['no_annual_fee', 'cashback_maximizer', 'category_spending'],
    applyUrl: 'https://www.citi.com/credit-cards/citi-custom-cash-credit-card',
  },
  {
    name: 'Chase Freedom Unlimited',
    provider: 'Chase',
    type: 'credit_card',
    description:
      'Solid all-around card with 1.5% on everything and elevated rates on dining and drugstores.',
    annualFee: 0,
    interestRate: 20.49,
    rewardType: 'cashback',
    features: [
      '1.5% cashback on all purchases',
      '3% on dining and drugstores',
      '5% on travel via Chase',
      '0% intro APR for 15 months',
      'No annual fee',
    ],
    idealFor: ['no_annual_fee', 'general_spending', 'first_credit_card'],
    applyUrl: 'https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited',
  },

  // ── High-Yield Savings Accounts ───────────────────────────────────
  {
    name: 'Marcus by Goldman Sachs High-Yield Savings',
    provider: 'Goldman Sachs',
    type: 'savings_account',
    description:
      'Competitive high-yield savings with no minimum deposit and no monthly fees.',
    annualFee: null,
    interestRate: 4.4,
    rewardType: null,
    features: [
      '4.40% APY',
      'No minimum deposit',
      'No monthly fees',
      'FDIC insured',
      'Easy online management',
    ],
    idealFor: ['high_savings_balance', 'emergency_fund', 'low_savings_rate'],
    applyUrl: 'https://www.marcus.com/us/en/savings/high-yield-savings',
  },
  {
    name: 'Ally Bank Online Savings',
    provider: 'Ally Bank',
    type: 'savings_account',
    description:
      'Full-featured online savings with competitive rates and savings buckets for goal tracking.',
    annualFee: null,
    interestRate: 4.25,
    rewardType: null,
    features: [
      '4.25% APY',
      'No minimum balance',
      'No monthly maintenance fees',
      'Savings buckets for goals',
      'FDIC insured',
      '24/7 customer support',
    ],
    idealFor: ['high_savings_balance', 'goal_saver', 'emergency_fund'],
    applyUrl: 'https://www.ally.com/bank/online-savings-account/',
  },
  {
    name: 'Discover Online Savings',
    provider: 'Discover',
    type: 'savings_account',
    description:
      'High-yield savings with no fees and automatic savings tools built in.',
    annualFee: null,
    interestRate: 4.25,
    rewardType: null,
    features: [
      '4.25% APY',
      'No minimum balance',
      'No fees',
      'FDIC insured',
      'Automatic savings tools',
    ],
    idealFor: ['high_savings_balance', 'emergency_fund', 'simple_savings'],
    applyUrl: 'https://www.discover.com/online-banking/savings-account/',
  },
  {
    name: 'Wealthfront Cash Account',
    provider: 'Wealthfront',
    type: 'savings_account',
    description:
      'Tech-forward cash account with high APY and seamless integration with investment accounts.',
    annualFee: null,
    interestRate: 4.5,
    rewardType: null,
    features: [
      '4.50% APY',
      'FDIC insured up to $8M through partner banks',
      'No fees',
      'Free transfers',
      'Autopilot auto-saving feature',
    ],
    idealFor: ['tech_savvy', 'high_savings_balance', 'investment_integration'],
    applyUrl: 'https://www.wealthfront.com/cash',
  },

  // ── Checking Accounts ─────────────────────────────────────────────
  {
    name: 'SoFi Checking and Savings',
    provider: 'SoFi',
    type: 'checking_account',
    description:
      'Combined checking and savings with high APY and no account fees.',
    annualFee: null,
    interestRate: 4.0,
    rewardType: null,
    features: [
      'Up to 4.00% APY',
      'No account fees',
      'Free ATM network (55,000+)',
      'Early direct deposit',
      'FDIC insured',
    ],
    idealFor: ['no_fee_checking', 'direct_deposit', 'high_checking_balance'],
    applyUrl: 'https://www.sofi.com/banking/',
  },

  // ── Investment / Brokerage Accounts ───────────────────────────────
  {
    name: 'Fidelity Individual Brokerage',
    provider: 'Fidelity',
    type: 'investment_account',
    description:
      'Full-service brokerage with $0 commissions, fractional shares, and extensive research tools.',
    annualFee: null,
    interestRate: null,
    rewardType: null,
    features: [
      '$0 commission stock/ETF trades',
      'Fractional shares',
      'No account minimums',
      'Extensive research tools',
      'Retirement planning tools',
    ],
    idealFor: ['new_investor', 'active_trader', 'retirement_planning'],
    applyUrl: 'https://www.fidelity.com/open-account/overview',
  },
  {
    name: 'Charles Schwab Brokerage',
    provider: 'Charles Schwab',
    type: 'investment_account',
    description:
      'Trusted brokerage with $0 commissions, Schwab Intelligent Portfolios, and excellent customer service.',
    annualFee: null,
    interestRate: null,
    rewardType: null,
    features: [
      '$0 commission stock/ETF trades',
      'Schwab Intelligent Portfolios (robo-advisor)',
      'No account minimums',
      'Schwab Stock Slices (fractional)',
      'Extensive branch network',
    ],
    idealFor: ['new_investor', 'retirement_planning', 'wants_branch_access'],
    applyUrl: 'https://www.schwab.com/brokerage',
  },
  {
    name: 'Vanguard Brokerage',
    provider: 'Vanguard',
    type: 'investment_account',
    description:
      'Pioneer in low-cost index fund investing with a long-term, buy-and-hold philosophy.',
    annualFee: null,
    interestRate: null,
    rewardType: null,
    features: [
      '$0 commission stock/ETF trades',
      'Industry-lowest expense ratios',
      'Vanguard Personal Advisor Services',
      'Client-owned structure',
      'Focus on long-term investing',
    ],
    idealFor: ['passive_investor', 'index_fund_investor', 'retirement_planning'],
    applyUrl: 'https://investor.vanguard.com/accounts-plans/brokerage',
  },

  // ── Personal Loans ────────────────────────────────────────────────
  {
    name: 'SoFi Personal Loan',
    provider: 'SoFi',
    type: 'personal_loan',
    description:
      'Competitive personal loans with no origination fees and unemployment protection.',
    annualFee: null,
    interestRate: 8.99,
    rewardType: null,
    features: [
      'No origination fees',
      'No prepayment penalties',
      'Unemployment protection',
      'Autopay discount',
      'Loan amounts $5k-$100k',
    ],
    idealFor: ['debt_consolidation', 'good_credit', 'large_purchase'],
    applyUrl: 'https://www.sofi.com/personal-loans/',
  },
];
