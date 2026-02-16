export interface ProviderInfo {
  name: string;
  category: string;
  retentionPhone: string;
  cancellationPhone: string;
  bestTimeToCall: string;
  averageSavingsPercent: number;
  successRate: number;
  typicalOffers: string[];
  tips: string[];
  competitorPricing: { competitor: string; price: string; details: string }[];
}

export const PROVIDER_DATABASE: Record<string, ProviderInfo> = {
  // ─── Internet / Cable ──────────────────────────────────────────────
  'comcast': {
    name: 'Comcast / Xfinity',
    category: 'internet',
    retentionPhone: '1-800-934-6489',
    cancellationPhone: '1-800-934-6489',
    bestTimeToCall: 'Tuesday-Thursday, 8-10 AM local time. Avoid Mondays and bill due dates.',
    averageSavingsPercent: 25,
    successRate: 72,
    typicalOffers: [
      '$20-40/month discount for 12-month promotional rate',
      'Free speed upgrade for 12 months',
      'Waived equipment rental fees for 6-12 months',
      'Bundle discount if adding mobile service',
      '$50-100 loyalty credit applied to account',
    ],
    tips: [
      'Ask to speak with the "retention" or "loyalty" department directly - they have authority to offer discounts.',
      'Mention you have been a loyal customer for X years and are considering switching to a competitor.',
      'Have a competitor quote ready (T-Mobile Home Internet, AT&T Fiber, or local ISP pricing).',
      'If the first offer is not good enough, politely say "I was hoping for something closer to what new customers get" and wait.',
      'Ask about unadvertised promotional rates - these exist but are not offered proactively.',
      'If they cannot lower the price, ask for a free speed upgrade or waived fees instead.',
      'Be prepared to actually cancel - sometimes the best offers come from the "save" team after you confirm cancellation.',
      'Call back and try a different agent if you do not get a good deal. Offers vary by representative.',
    ],
    competitorPricing: [
      { competitor: 'T-Mobile Home Internet', price: '$50/mo', details: 'Unlimited 5G home internet, no contract' },
      { competitor: 'AT&T Fiber', price: '$55/mo', details: '300 Mbps, no contract, no equipment fees' },
      { competitor: 'Verizon Fios', price: '$49.99/mo', details: '300 Mbps, no annual contract' },
    ],
  },

  'spectrum': {
    name: 'Spectrum (Charter)',
    category: 'internet',
    retentionPhone: '1-833-267-6094',
    cancellationPhone: '1-833-267-6094',
    bestTimeToCall: 'Tuesday-Thursday, 9-11 AM local time.',
    averageSavingsPercent: 20,
    successRate: 65,
    typicalOffers: [
      '$15-30/month discount for 12 months',
      'Free speed upgrade to next tier',
      'Bundle discount with mobile service ($29.99/line)',
      'Waived installation fee for service changes',
      '$50 retention credit',
    ],
    tips: [
      'Spectrum does not have contracts, so you can switch anytime - use this as leverage.',
      'Ask for their "retention pricing" which is lower than standard rates.',
      'Mention T-Mobile 5G Home Internet or local fiber options.',
      'If you have been a customer for 2+ years, emphasize your loyalty and ask for the new customer rate.',
      'Ask about their bundled mobile plans - sometimes bundling can reduce the total bill.',
      'Request to speak with a supervisor if the first agent cannot help.',
      'Try the online chat retention team if phone wait times are long.',
      'Note: Spectrum periodically raises rates. Call within 30 days of a price increase for best results.',
    ],
    competitorPricing: [
      { competitor: 'T-Mobile Home Internet', price: '$50/mo', details: 'Unlimited 5G, no contract' },
      { competitor: 'AT&T Fiber', price: '$55/mo', details: '300 Mbps fiber, price locked for 12 months' },
      { competitor: 'Starlink', price: '$120/mo', details: 'Satellite internet, no contract (rural alternative)' },
    ],
  },

  'att-internet': {
    name: 'AT&T Internet / Fiber',
    category: 'internet',
    retentionPhone: '1-800-288-2020',
    cancellationPhone: '1-800-288-2020',
    bestTimeToCall: 'Wednesday-Thursday, 8-10 AM local time.',
    averageSavingsPercent: 22,
    successRate: 68,
    typicalOffers: [
      '$10-25/month loyalty discount for 12 months',
      'Free speed upgrade',
      'Waived equipment and installation fees',
      'Bundle discount with AT&T Wireless',
      '$100 reward card for staying',
    ],
    tips: [
      'Press option to "cancel service" to reach the retention department faster.',
      'Mention you are comparing prices with Spectrum, T-Mobile, or local fiber.',
      'AT&T often has "loyalty offers" that are not advertised - ask about them specifically.',
      'If you have AT&T Wireless, ask about the combined discount for keeping both.',
      'Ask about their price-lock guarantee for fiber plans.',
      'After 12 months, call again before the promotional rate expires.',
      'Check if there are any government-subsidized programs (ACP) you may qualify for.',
      'Be firm but polite - AT&T retention agents have significant discount authority.',
    ],
    competitorPricing: [
      { competitor: 'Spectrum', price: '$49.99/mo', details: '300 Mbps, no contract' },
      { competitor: 'T-Mobile Home Internet', price: '$50/mo', details: 'Unlimited 5G' },
      { competitor: 'Google Fiber', price: '$70/mo', details: '1 Gbps fiber (where available)' },
    ],
  },

  'verizon-fios': {
    name: 'Verizon Fios',
    category: 'internet',
    retentionPhone: '1-800-837-4966',
    cancellationPhone: '1-800-837-4966',
    bestTimeToCall: 'Tuesday-Thursday, 9-11 AM.',
    averageSavingsPercent: 20,
    successRate: 70,
    typicalOffers: [
      '$10-20/month promotional discount',
      'Free router upgrade',
      'Mix & Match plan optimization',
      '$50-100 bill credit',
      'Free streaming service add-on (Disney+, Discovery+, etc.)',
    ],
    tips: [
      'Verizon Fios agents can offer "Mix & Match" plan adjustments that may lower your bill.',
      'If you have Verizon Wireless, ask about the combined discount.',
      'Mention competitor fiber pricing from AT&T or local providers.',
      'Ask specifically about "loyalty rewards" or "retention offers."',
      'Verizon sometimes offers free premium streaming services - ask about current promotions.',
      'Try the Verizon app chat feature for quicker access to retention offers.',
      'If your contract is ending, call 2 weeks before to negotiate the renewal rate.',
      'Ask about autopay and paperless billing discounts ($5-10/month).',
    ],
    competitorPricing: [
      { competitor: 'Optimum', price: '$40/mo', details: '300 Mbps fiber' },
      { competitor: 'T-Mobile Home Internet', price: '$50/mo', details: 'Unlimited 5G' },
      { competitor: 'AT&T Fiber', price: '$55/mo', details: '300 Mbps, price locked' },
    ],
  },

  'cox': {
    name: 'Cox Communications',
    category: 'internet',
    retentionPhone: '1-800-234-3993',
    cancellationPhone: '1-800-234-3993',
    bestTimeToCall: 'Tuesday-Thursday, 8-10 AM local time.',
    averageSavingsPercent: 22,
    successRate: 66,
    typicalOffers: [
      '$15-30/month discount for 12 months',
      'Data cap removal or upgrade',
      'Free speed tier upgrade',
      'Waived late fees and equipment charges',
      'Bundle discount with Cox Mobile',
    ],
    tips: [
      'Cox has a 1.25 TB data cap - ask about unlimited data add-on discounts or having the cap waived.',
      'Mention T-Mobile, AT&T, or any local fiber competitor.',
      'Ask for the "loyalty" or "retention" department by name.',
      'If you are a long-term customer, emphasize your history and ask for the best available rate.',
      'Cox Mobile launched recently - ask about bundle savings if you switch your phone plan.',
      'Try negotiating online through the Cox app chat feature.',
      'Ask about their "Starter" or lower-tier plans if you do not need maximum speeds.',
      'Request waiving any recent price increases retroactively.',
    ],
    competitorPricing: [
      { competitor: 'T-Mobile Home Internet', price: '$50/mo', details: 'Unlimited data, no contract' },
      { competitor: 'CenturyLink/Lumen', price: '$50/mo', details: 'Price for life on select plans' },
      { competitor: 'AT&T Fiber', price: '$55/mo', details: '300 Mbps fiber' },
    ],
  },

  'centurylink': {
    name: 'CenturyLink / Lumen / Quantum Fiber',
    category: 'internet',
    retentionPhone: '1-800-244-1111',
    cancellationPhone: '1-800-244-1111',
    bestTimeToCall: 'Tuesday-Thursday, 9 AM - 12 PM.',
    averageSavingsPercent: 18,
    successRate: 60,
    typicalOffers: [
      '"Price for Life" guarantee on select plans',
      '$10-20/month discount',
      'Free modem/router upgrade',
      'Speed upgrade at same price',
      'Waived activation and installation fees',
    ],
    tips: [
      'CenturyLink offers a "Price for Life" guarantee on some plans - ask about this specifically.',
      'If you are on DSL, ask about fiber availability in your area for a potential upgrade at a lower price.',
      'Mention T-Mobile or any local cable competitor.',
      'Ask about any current new-customer promotions and request the same rate.',
      'CenturyLink tends to have simpler pricing - focus on getting the lowest tier that meets your needs.',
      'Check if you qualify for any income-based discounts.',
      'Be aware that rebranding to Quantum Fiber may come with different plan options.',
      'Ask for a supervisor if the agent says they cannot offer any discounts.',
    ],
    competitorPricing: [
      { competitor: 'T-Mobile Home Internet', price: '$50/mo', details: 'Unlimited 5G' },
      { competitor: 'Comcast/Xfinity', price: '$35/mo', details: 'Performance Starter plan' },
      { competitor: 'Spectrum', price: '$49.99/mo', details: '300 Mbps, no contract' },
    ],
  },

  // ─── Phone / Wireless ─────────────────────────────────────────────
  'att-wireless': {
    name: 'AT&T Wireless',
    category: 'phone',
    retentionPhone: '1-800-331-0500',
    cancellationPhone: '1-800-331-0500',
    bestTimeToCall: 'Tuesday-Thursday, 8-10 AM local time.',
    averageSavingsPercent: 18,
    successRate: 60,
    typicalOffers: [
      '$10-15/line/month loyalty discount',
      'Free device upgrade with trade-in',
      'Waived activation fees',
      'Plan optimization to lower-cost tier with similar benefits',
      '$50-200 bill credit for staying',
    ],
    tips: [
      'Ask about military, first responder, teacher, or nurse discounts (up to 25% off).',
      'Check if your employer offers a corporate discount through AT&T (FAN discount).',
      'Mention T-Mobile or Verizon current promotional pricing.',
      'Ask to review your plan and see if there is a newer, cheaper plan with the same features.',
      'Multi-line discounts increase with more lines - see if adding/consolidating family lines saves money.',
      'Ask about AT&T Prepaid plans which can be significantly cheaper.',
      'If you have AT&T Fiber at home, ask about the combined discount.',
      'Autopay typically saves $5-10/month - make sure you are enrolled.',
    ],
    competitorPricing: [
      { competitor: 'T-Mobile Essentials', price: '$60/mo (1 line)', details: 'Unlimited talk/text/data' },
      { competitor: 'Visible (Verizon)', price: '$25/mo', details: 'Unlimited on Verizon network' },
      { competitor: 'Mint Mobile', price: '$15/mo', details: 'Unlimited on T-Mobile network' },
    ],
  },

  'verizon-wireless': {
    name: 'Verizon Wireless',
    category: 'phone',
    retentionPhone: '1-800-922-0204',
    cancellationPhone: '1-800-922-0204',
    bestTimeToCall: 'Tuesday-Thursday, 9-11 AM.',
    averageSavingsPercent: 15,
    successRate: 58,
    typicalOffers: [
      '$5-15/line loyalty discount',
      'Plan optimization to myPlan tiers',
      'Free streaming service add-on (Netflix, Disney+, etc.)',
      '$100-200 device trade-in bonus',
      'Waived upgrade and activation fees',
    ],
    tips: [
      'Verizon "myPlan" lets you pick add-ons - review what you are paying for and drop unused perks.',
      'Ask about employer corporate discounts - many companies have 15-22% off.',
      'Mention T-Mobile or AT&T pricing, especially their unlimited plans.',
      'If you have Verizon Fios at home, ask about the combined "One Unlimited" discount.',
      'Autopay with a debit card or bank account saves $10/month per line.',
      'Ask about military, student, or teacher discounts.',
      'Review your device payment plans - you may be paying for a phone that is already paid off.',
      'Consider Verizon Prepaid for significant savings if you do not need premium features.',
    ],
    competitorPricing: [
      { competitor: 'T-Mobile Go5G', price: '$75/mo (1 line)', details: 'Unlimited premium data' },
      { competitor: 'Mint Mobile', price: '$15/mo', details: 'Unlimited on T-Mobile network' },
      { competitor: 'US Mobile', price: '$25/mo', details: 'Unlimited on Verizon or T-Mobile network' },
    ],
  },

  'tmobile': {
    name: 'T-Mobile',
    category: 'phone',
    retentionPhone: '1-800-937-8997',
    cancellationPhone: '1-800-937-8997',
    bestTimeToCall: 'Tuesday-Thursday, 9-11 AM.',
    averageSavingsPercent: 15,
    successRate: 55,
    typicalOffers: [
      'Plan optimization to lower-cost tiers',
      'Free Netflix or streaming add-on',
      'Insider discount (20% off for life)',
      '$100-300 device trade-in credit',
      'Third line free promotion',
    ],
    tips: [
      'T-Mobile regularly runs "Insider" promotions (20% off for life) - ask if any are currently available.',
      'Ask about the "third line free" or "add a line free" promotions.',
      'T-Mobile includes Netflix on most plans - make sure you are using it and cancel your separate subscription.',
      'Check if your employer offers a T-Mobile corporate discount.',
      'Ask about military and first responder discounts (up to 50% off with Magenta Military).',
      'Review your plan: Go5G is cheaper than Go5G Plus if you do not need premium features.',
      'Mention AT&T or Verizon competitor pricing.',
      'Contact T-Force (T-Mobile support on Twitter/X) for faster resolution of billing issues.',
    ],
    competitorPricing: [
      { competitor: 'AT&T Unlimited', price: '$65/mo (1 line)', details: 'Unlimited Starter' },
      { competitor: 'Visible', price: '$25/mo', details: 'Unlimited on Verizon network' },
      { competitor: 'Cricket Wireless', price: '$30/mo', details: 'Unlimited on AT&T network' },
    ],
  },

  'sprint': {
    name: 'Sprint (now T-Mobile)',
    category: 'phone',
    retentionPhone: '1-800-937-8997',
    cancellationPhone: '1-800-937-8997',
    bestTimeToCall: 'Tuesday-Thursday, 9-11 AM.',
    averageSavingsPercent: 20,
    successRate: 62,
    typicalOffers: [
      'Migration to T-Mobile plan at promotional rate',
      'Legacy plan grandfathered pricing review',
      'Device upgrade credits',
      'Plan consolidation savings',
      'Free line promotions',
    ],
    tips: [
      'Sprint has merged with T-Mobile - you may get better pricing by switching to a T-Mobile plan.',
      'If you have a legacy Sprint plan with good features, make sure migration does not lose benefits.',
      'Ask about T-Mobile Tuesday perks and Netflix inclusion.',
      'Sprint customers are often eligible for special migration promotions.',
      'Review all lines on your plan - remove any unused lines or paid-off device installments.',
      'Ask about the T-Mobile Insider discount when migrating.',
      'Check if your Sprint plan includes any unused international or hotspot features you are paying for.',
      'Contact T-Force on social media for dedicated support during plan migration.',
    ],
    competitorPricing: [
      { competitor: 'AT&T Unlimited', price: '$65/mo (1 line)', details: 'Unlimited Starter plan' },
      { competitor: 'Visible', price: '$25/mo', details: 'Unlimited on Verizon network' },
      { competitor: 'Mint Mobile', price: '$15/mo', details: 'Unlimited on T-Mobile network' },
    ],
  },

  // ─── Insurance ─────────────────────────────────────────────────────
  'state-farm': {
    name: 'State Farm',
    category: 'insurance',
    retentionPhone: '1-800-782-8332',
    cancellationPhone: '1-800-782-8332',
    bestTimeToCall: 'Monday-Friday, 8 AM - 12 PM local time.',
    averageSavingsPercent: 20,
    successRate: 70,
    typicalOffers: [
      'Multi-policy bundle discount (auto + home: 15-25%)',
      'Safe driver discount review',
      'Increased deductible for lower premium',
      'Drive Safe & Save telematics discount (up to 30%)',
      'Good student or defensive driving course discount',
    ],
    tips: [
      'Get quotes from Geico, Progressive, and USAA before calling - have specific numbers ready.',
      'Ask your agent to review ALL available discounts - many people miss multi-policy, good driver, or safety feature discounts.',
      'Increasing your deductible from $500 to $1,000 can save 15-25% on premiums.',
      'Ask about the "Drive Safe & Save" program which monitors driving and rewards safe habits.',
      'Bundle your auto and home/renters insurance for maximum savings.',
      'Ask about discounts for: anti-theft devices, safety features, low mileage, good credit.',
      'Review your coverage limits annually - you may be over-insured on an older vehicle.',
      'Ask about paying in full annually vs. monthly - many insurers offer a 5-10% discount for annual payment.',
    ],
    competitorPricing: [
      { competitor: 'Geico', price: '15-20% lower', details: 'Often cheaper for clean driving records' },
      { competitor: 'Progressive', price: '10-15% lower', details: 'Snapshot program for good drivers' },
      { competitor: 'USAA', price: '20-30% lower', details: 'Military/veteran members only' },
    ],
  },

  'geico': {
    name: 'GEICO',
    category: 'insurance',
    retentionPhone: '1-800-841-3000',
    cancellationPhone: '1-800-841-3000',
    bestTimeToCall: 'Monday-Friday, 8 AM - 12 PM.',
    averageSavingsPercent: 18,
    successRate: 65,
    typicalOffers: [
      'Multi-policy discount',
      'Good driver discount',
      'Military/federal employee discount',
      'Defensive driving course discount',
      'Anti-theft device discount',
    ],
    tips: [
      'GEICO is already competitively priced, but still ask for a rate review.',
      'Get competing quotes from Progressive and State Farm to use as leverage.',
      'Ask about ALL available discounts: military, federal employee, professional organization, alumni.',
      'Ask about bundling with GEICO renters/homeowners or umbrella policy.',
      'Consider raising your deductible - GEICO makes it easy to see the premium difference online.',
      'Review your coverage: drop comprehensive/collision on cars worth less than $5,000.',
      'Ask about pay-in-full discount (5-10% savings for annual payment).',
      'Check if your employer has a corporate discount agreement with GEICO.',
    ],
    competitorPricing: [
      { competitor: 'State Farm', price: 'Comparable', details: 'Better bundle discounts' },
      { competitor: 'Progressive', price: '5-10% lower', details: 'Snapshot usage-based pricing' },
      { competitor: 'Root Insurance', price: '10-20% lower', details: 'App-based, usage-driven pricing' },
    ],
  },

  'progressive': {
    name: 'Progressive',
    category: 'insurance',
    retentionPhone: '1-800-776-4737',
    cancellationPhone: '1-800-776-4737',
    bestTimeToCall: 'Monday-Friday, 8 AM - 11 AM.',
    averageSavingsPercent: 18,
    successRate: 64,
    typicalOffers: [
      'Snapshot usage-based discount (up to 30%)',
      'Multi-policy bundle discount',
      'Homeowner discount (even without bundling)',
      'Continuous insurance discount',
      'Online quote or paperless discount',
    ],
    tips: [
      'Ask about the Snapshot program - if you are a safe driver, you can save up to 30%.',
      'Get quotes from GEICO and State Farm for comparison.',
      'Progressive shows competitor rates on their website - use this transparency to negotiate.',
      'Ask about the "Name Your Price" tool to find coverage within your budget.',
      'Multi-vehicle and multi-policy discounts can be significant.',
      'Check for pay-in-full, paperless, and autopay discounts.',
      'Progressive often has lower rates for drivers with accidents - use this if you have a less-than-perfect record.',
      'Ask about their home insurance bundle through ASI (American Strategic Insurance).',
    ],
    competitorPricing: [
      { competitor: 'GEICO', price: '5-10% lower', details: 'Often cheaper for clean records' },
      { competitor: 'State Farm', price: 'Comparable', details: 'Better for bundled policies' },
      { competitor: 'USAA', price: '15-25% lower', details: 'Military members only' },
    ],
  },

  'allstate': {
    name: 'Allstate',
    category: 'insurance',
    retentionPhone: '1-800-255-7828',
    cancellationPhone: '1-800-255-7828',
    bestTimeToCall: 'Monday-Friday, 9 AM - 12 PM.',
    averageSavingsPercent: 22,
    successRate: 68,
    typicalOffers: [
      'Drivewise safe driving discount (up to 40%)',
      'Multi-policy bundle discount (up to 25%)',
      'Safe driver bonus check',
      'New customer discount',
      'Allstate Rewards loyalty credits',
    ],
    tips: [
      'Allstate tends to be on the higher end - getting quotes from GEICO and Progressive gives strong leverage.',
      'Ask about the Drivewise program for significant usage-based discounts.',
      'Review your Allstate Rewards balance - you may have unclaimed credits.',
      'Ask your local agent to do a full discount review.',
      'Allstate offers "accident forgiveness" and "deductible rewards" - check if these are costing you extra.',
      'Consider bundling home and auto for the biggest discount.',
      'Ask about the pay-in-full discount and autopay discount.',
      'If rates went up, ask specifically what changed and request a re-quote based on current situation.',
    ],
    competitorPricing: [
      { competitor: 'GEICO', price: '15-25% lower', details: 'Generally lower rates' },
      { competitor: 'Progressive', price: '10-20% lower', details: 'Snapshot program savings' },
      { competitor: 'State Farm', price: '10-15% lower', details: 'Competitive with better bundle options' },
    ],
  },

  'usaa': {
    name: 'USAA',
    category: 'insurance',
    retentionPhone: '1-800-531-8722',
    cancellationPhone: '1-800-531-8722',
    bestTimeToCall: 'Monday-Friday, 8 AM - 11 AM CT.',
    averageSavingsPercent: 12,
    successRate: 55,
    typicalOffers: [
      'SafePilot usage-based discount',
      'Military installation discount',
      'Deployed service member discount',
      'Bundle savings review',
      'Annual mileage adjustment discount',
    ],
    tips: [
      'USAA already has very competitive rates for military members. Focus on optimizing coverage rather than price.',
      'Ask about SafePilot for additional usage-based savings.',
      'If you are deployed or moving to a military installation, special discounts apply.',
      'Review all coverage levels - USAA agents are generally helpful about right-sizing.',
      'Bundle all policies (auto, home, life) for maximum discount.',
      'Ask about the annual dividend - USAA sometimes returns money to members.',
      'Make sure all eligible family members are on the policy for multi-vehicle discounts.',
      'Consider their banking products too - sometimes bundling insurance with banking provides additional benefits.',
    ],
    competitorPricing: [
      { competitor: 'Armed Forces Insurance', price: 'Similar', details: 'Military-focused competitor' },
      { competitor: 'GEICO Military', price: '5-10% higher', details: 'Military discount but usually more than USAA' },
      { competitor: 'State Farm', price: '10-20% higher', details: 'General market pricing' },
    ],
  },

  // ─── Streaming ─────────────────────────────────────────────────────
  'netflix': {
    name: 'Netflix',
    category: 'streaming',
    retentionPhone: '1-866-579-7172',
    cancellationPhone: '1-866-579-7172',
    bestTimeToCall: 'Weekdays, 9 AM - 5 PM.',
    averageSavingsPercent: 30,
    successRate: 45,
    typicalOffers: [
      'Downgrade to Standard with Ads plan ($6.99/mo)',
      'Free month after cancellation attempt',
      'Pause subscription for 1-3 months',
      'Plan optimization to lower tier',
      'Partner bundle through T-Mobile or other carrier',
    ],
    tips: [
      'Netflix has limited negotiation options - focus on plan optimization instead.',
      'The ad-supported tier ($6.99/mo) is half the price with minimal ad interruption.',
      'Check if your phone carrier (T-Mobile, Verizon) includes Netflix free.',
      'Cancel and wait - Netflix sometimes sends a "come back" offer after 1-2 months.',
      'Share costs with family using the official household features.',
      'Review which plan you need: Standard with Ads, Standard, or Premium.',
      'Rotate streaming services monthly instead of paying for all simultaneously.',
      'Check if Netflix is available through your cable provider bundle at a discount.',
    ],
    competitorPricing: [
      { competitor: 'Hulu (with ads)', price: '$7.99/mo', details: 'Similar content library with ads' },
      { competitor: 'Amazon Prime Video', price: '$8.99/mo', details: 'Included with Prime membership' },
      { competitor: 'Apple TV+', price: '$9.99/mo', details: 'Original content, free trial with new devices' },
    ],
  },

  'hulu': {
    name: 'Hulu',
    category: 'streaming',
    retentionPhone: '1-888-265-6650',
    cancellationPhone: '1-888-265-6650',
    bestTimeToCall: 'Weekdays, 9 AM - 5 PM.',
    averageSavingsPercent: 35,
    successRate: 50,
    typicalOffers: [
      'Retention offer: $1.99/mo for 3 months',
      'Downgrade from no-ads to with-ads plan',
      'Free month added to account',
      'Bundle with Disney+ and ESPN+ for savings',
      'Student discount ($1.99/mo)',
    ],
    tips: [
      'Hulu is one of the most negotiable streaming services - start the cancellation flow online to trigger retention offers.',
      'The Disney Bundle (Hulu + Disney+ + ESPN+) is often cheaper than Hulu alone at full price.',
      'Students can get Hulu with ads for $1.99/month - verify if you qualify.',
      'Going through the cancel flow online often triggers a $1.99/month retention offer.',
      'If you have Verizon, check if Hulu is included in your plan.',
      'Sprint/T-Mobile customers may have free or discounted Hulu.',
      'Black Friday typically offers $0.99-1.99/mo annual deals - consider canceling and resubscribing.',
      'Consider the ad-supported plan - it is significantly cheaper and ad breaks are short.',
    ],
    competitorPricing: [
      { competitor: 'Netflix (with ads)', price: '$6.99/mo', details: 'Largest content library' },
      { competitor: 'Peacock Premium', price: '$7.99/mo', details: 'NBC/Universal content' },
      { competitor: 'Paramount+', price: '$5.99/mo', details: 'CBS and Paramount content' },
    ],
  },

  'disney-plus': {
    name: 'Disney+',
    category: 'streaming',
    retentionPhone: '1-888-905-7888',
    cancellationPhone: '1-888-905-7888',
    bestTimeToCall: 'Weekdays, 9 AM - 5 PM.',
    averageSavingsPercent: 30,
    successRate: 45,
    typicalOffers: [
      'Disney Bundle (Disney+ / Hulu / ESPN+)',
      'Ad-supported tier ($7.99/mo)',
      'Annual subscription discount (save ~15%)',
      'Free month retention offer',
      'Partner offers through Verizon or other carriers',
    ],
    tips: [
      'The Disney Bundle with Hulu and ESPN+ is the best value if you use multiple services.',
      'Switch to annual billing to save about 15% compared to monthly.',
      'Check if your Verizon plan includes Disney+ for free.',
      'The ad-supported tier was introduced at a lower price point - consider it if price-sensitive.',
      'Cancel and resubscribe to take advantage of returning customer promotions.',
      'Disney frequently partners with other services for promotional bundles.',
      'If you only watch occasionally, cancel and resubscribe when new Marvel/Star Wars content drops.',
      'Consider sharing with household members through the official profile features.',
    ],
    competitorPricing: [
      { competitor: 'Netflix (with ads)', price: '$6.99/mo', details: 'Broader content library' },
      { competitor: 'Apple TV+', price: '$9.99/mo', details: 'Family sharing included' },
      { competitor: 'Paramount+', price: '$5.99/mo', details: 'Similar family content' },
    ],
  },

  'hbo-max': {
    name: 'HBO Max / Max',
    category: 'streaming',
    retentionPhone: '1-855-442-6629',
    cancellationPhone: '1-855-442-6629',
    bestTimeToCall: 'Weekdays, 9 AM - 5 PM.',
    averageSavingsPercent: 30,
    successRate: 48,
    typicalOffers: [
      'Ad-supported tier ($9.99/mo)',
      'Annual billing discount (save 20%)',
      'Retention discount ($3-5/mo off for 3 months)',
      'Free month extension',
      'Bundle through cable provider',
    ],
    tips: [
      'Now rebranded as "Max" with tiered pricing - review which tier you actually need.',
      'Annual subscription saves about 20% compared to monthly.',
      'If you have AT&T Internet or DirecTV, check if Max is included in your plan.',
      'Going through the online cancellation flow sometimes triggers retention offers.',
      'The ad-supported tier has most of the same content at a lower price.',
      'Consider seasonal subscribing - sign up when new HBO shows premiere and cancel between seasons.',
      'Check if your cable/satellite provider offers Max as part of your TV package.',
      'Black Friday and holiday promotions frequently offer discounted annual plans.',
    ],
    competitorPricing: [
      { competitor: 'Netflix (with ads)', price: '$6.99/mo', details: 'Largest streaming library' },
      { competitor: 'Hulu (with ads)', price: '$7.99/mo', details: 'Similar premium content' },
      { competitor: 'Apple TV+', price: '$9.99/mo', details: 'Quality originals at lower price' },
    ],
  },

  'spotify': {
    name: 'Spotify',
    category: 'streaming',
    retentionPhone: 'Online support only',
    cancellationPhone: 'Online support only',
    bestTimeToCall: 'N/A - use online chat support.',
    averageSavingsPercent: 25,
    successRate: 40,
    typicalOffers: [
      'Student plan ($5.99/mo with Hulu & Showtime)',
      'Duo plan ($16.99/mo for 2 people)',
      'Family plan ($16.99/mo for up to 6 people)',
      'Free trial extensions after cancellation',
      'Annual plan discount',
    ],
    tips: [
      'Spotify Premium Family ($16.99/mo for 6 accounts) is the best per-person value.',
      'Students get Premium plus Hulu and Showtime for $5.99/mo.',
      'If you cancel, Spotify often sends discount offers via email within 2-4 weeks.',
      'Check if your employer or health insurance offers Spotify as a wellness benefit.',
      'Consider the Duo plan if you live with a partner ($8.50 each vs $11.99 each).',
      'Use the free tier with ads if you mainly listen at home (you can use desktop without shuffle).',
      'Look for prepaid annual card deals - retailers sometimes sell them at a discount.',
      'Apple Music and YouTube Music offer competitive alternatives - mention considering a switch.',
    ],
    competitorPricing: [
      { competitor: 'Apple Music', price: '$10.99/mo', details: 'Individual plan, lossless audio included' },
      { competitor: 'YouTube Music', price: '$10.99/mo', details: 'Includes YouTube Premium' },
      { competitor: 'Amazon Music Unlimited', price: '$9.99/mo', details: '$8.99 for Prime members' },
    ],
  },

  'apple-music': {
    name: 'Apple Music',
    category: 'streaming',
    retentionPhone: '1-800-275-2273',
    cancellationPhone: '1-800-275-2273',
    bestTimeToCall: 'Weekdays, 9 AM - 5 PM.',
    averageSavingsPercent: 20,
    successRate: 40,
    typicalOffers: [
      'Student plan ($5.99/mo)',
      'Apple One bundle (Music + TV+ + Arcade + iCloud)',
      'Family plan ($16.99/mo for up to 6 people)',
      'Free trial extensions (1-3 months)',
      'Annual subscription savings',
    ],
    tips: [
      'Apple One bundle ($19.95/mo) includes Music, TV+, Arcade, and iCloud+ - may be cheaper than separate subscriptions.',
      'Student pricing ($5.99/mo) includes Apple TV+ free.',
      'New Apple device purchases often come with free Apple Music trials (3-6 months).',
      'Family plan ($16.99/mo for 6 people) is the best per-person value.',
      'Check if your carrier (Verizon, T-Mobile) includes Apple Music or Apple One.',
      'Annual billing saves about 15% compared to monthly.',
      'If you cancel, Apple sometimes offers 1-3 free months to come back.',
      'Consider switching to Spotify or YouTube Music for comparison - mention this when contacting support.',
    ],
    competitorPricing: [
      { competitor: 'Spotify Premium', price: '$11.99/mo', details: 'Larger music library, better algorithms' },
      { competitor: 'YouTube Premium', price: '$13.99/mo', details: 'Includes ad-free YouTube + Music' },
      { competitor: 'Amazon Music Unlimited', price: '$9.99/mo', details: 'Cheaper for Prime members' },
    ],
  },

  // ─── Utilities ─────────────────────────────────────────────────────
  'utilities-general': {
    name: 'Utility Company (General)',
    category: 'utilities',
    retentionPhone: 'Check your utility bill for phone number',
    cancellationPhone: 'Check your utility bill for phone number',
    bestTimeToCall: 'Monday-Friday, 8-10 AM.',
    averageSavingsPercent: 15,
    successRate: 50,
    typicalOffers: [
      'Budget billing / equal payment plan',
      'Time-of-use rate plan (off-peak savings)',
      'Income-based assistance programs (LIHEAP)',
      'Energy efficiency rebates and credits',
      'Paperless and autopay discounts',
    ],
    tips: [
      'Ask about "budget billing" or "equal payment plans" to smooth out seasonal spikes.',
      'Many utilities offer time-of-use rates - shift heavy usage (laundry, dishwasher) to off-peak hours for 20-40% savings.',
      'Check if you qualify for LIHEAP (Low Income Home Energy Assistance Program) or other assistance.',
      'Ask about energy efficiency programs - many utilities offer free home energy audits.',
      'Inquire about rebates for smart thermostats, LED bulbs, or Energy Star appliances.',
      'In deregulated energy markets, you can shop for a different energy supplier at a lower rate.',
      'Review your rate plan annually - utilities sometimes introduce new, lower-cost options.',
      'Ask about senior citizen, military, or disability discount programs.',
    ],
    competitorPricing: [
      { competitor: 'Community Solar', price: '5-15% savings', details: 'Subscribe to a local solar farm' },
      { competitor: 'Alternative Suppliers', price: '10-20% savings', details: 'Available in deregulated markets' },
      { competitor: 'Rooftop Solar', price: '50-100% savings', details: 'Long-term investment, net metering credits' },
    ],
  },
};

/**
 * Normalize a provider name to a key in the PROVIDER_DATABASE.
 */
export function normalizeProviderKey(provider: string): string | null {
  const lower = provider.toLowerCase().trim();

  const aliases: Record<string, string> = {
    'xfinity': 'comcast',
    'comcast': 'comcast',
    'comcast/xfinity': 'comcast',
    'comcast xfinity': 'comcast',
    'spectrum': 'spectrum',
    'charter': 'spectrum',
    'charter spectrum': 'spectrum',
    'at&t internet': 'att-internet',
    'att internet': 'att-internet',
    'at&t fiber': 'att-internet',
    'att fiber': 'att-internet',
    'verizon fios': 'verizon-fios',
    'fios': 'verizon-fios',
    'cox': 'cox',
    'cox communications': 'cox',
    'centurylink': 'centurylink',
    'lumen': 'centurylink',
    'quantum fiber': 'centurylink',
    'at&t wireless': 'att-wireless',
    'att wireless': 'att-wireless',
    'at&t mobile': 'att-wireless',
    'at&t': 'att-wireless',
    'att': 'att-wireless',
    'verizon wireless': 'verizon-wireless',
    'verizon': 'verizon-wireless',
    'verizon mobile': 'verizon-wireless',
    't-mobile': 'tmobile',
    'tmobile': 'tmobile',
    't mobile': 'tmobile',
    'sprint': 'sprint',
    'state farm': 'state-farm',
    'statefarm': 'state-farm',
    'geico': 'geico',
    'progressive': 'progressive',
    'allstate': 'allstate',
    'usaa': 'usaa',
    'netflix': 'netflix',
    'hulu': 'hulu',
    'disney+': 'disney-plus',
    'disney plus': 'disney-plus',
    'disneyplus': 'disney-plus',
    'hbo max': 'hbo-max',
    'hbo': 'hbo-max',
    'max': 'hbo-max',
    'spotify': 'spotify',
    'apple music': 'apple-music',
    'applemusic': 'apple-music',
    'utilities': 'utilities-general',
    'utility': 'utilities-general',
    'electric': 'utilities-general',
    'gas': 'utilities-general',
    'water': 'utilities-general',
    'power': 'utilities-general',
  };

  if (aliases[lower]) {
    return aliases[lower];
  }

  // Try partial match
  for (const [alias, key] of Object.entries(aliases)) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return key;
    }
  }

  return null;
}

/**
 * Get all known categories.
 */
export function getProviderCategories(): string[] {
  return ['internet', 'cable', 'phone', 'insurance', 'streaming', 'utilities', 'other'];
}

/**
 * Get all providers organized by category.
 */
export function getProvidersByCategory(): Record<string, { key: string; name: string }[]> {
  const result: Record<string, { key: string; name: string }[]> = {};

  for (const [key, info] of Object.entries(PROVIDER_DATABASE)) {
    if (!result[info.category]) {
      result[info.category] = [];
    }
    result[info.category].push({ key, name: info.name });
  }

  return result;
}
