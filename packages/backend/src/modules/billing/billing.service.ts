import { Injectable, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import {
  subscriptionPlans,
  userSubscriptions,
  billingCustomers,
  invoices,
  usageTracking,
} from './billing.schema';
import * as usersSchema from '../../database/schema/users';
import {
  type PlanTier,
  PLAN_FEATURES,
  FEATURE_PLAN_MAP,
  PLAN_TIER_ORDER,
  PLANS,
  canAccessFeature,
  isAtLeastPlan,
  getPlanLimits,
} from './plans';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubscriptionInfo {
  planName: PlanTier;
  planDisplayName: string;
  status: string;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  features: string[];
  limits: ReturnType<typeof getPlanLimits>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe;

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not configured. Billing features will not work.');
    }
    this.stripe = new Stripe(secretKey || 'sk_not_configured');
  }

  // -------------------------------------------------------------------------
  // Plans
  // -------------------------------------------------------------------------

  async getPlans() {
    const plans = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, 1));

    if (plans.length === 0) {
      return this.seedDefaultPlans();
    }

    return plans.map((plan) => ({
      ...plan,
      features: JSON.parse(plan.features),
    }));
  }

  // -------------------------------------------------------------------------
  // Customer management
  // -------------------------------------------------------------------------

  /**
   * Create a Stripe customer for a user and persist the mapping.
   * If a customer already exists, returns the existing Stripe customer ID.
   */
  async createCustomer(userId: string, email: string, name?: string): Promise<string> {
    const [existing] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);

    if (existing) {
      return existing.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email,
      name: name || undefined,
      metadata: { userId },
    });

    await this.db.insert(billingCustomers).values({
      userId,
      stripeCustomerId: customer.id,
    });

    this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);

    return customer.id;
  }

  /**
   * Creates a Stripe customer for a user by looking up their email/name from the DB.
   * Convenience method for the registration flow.
   */
  async createCustomerForUser(userId: string): Promise<string> {
    const [existing] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);

    if (existing) {
      return existing.stripeCustomerId;
    }

    const [user] = await this.db
      .select({ email: usersSchema.users.email, name: usersSchema.users.name })
      .from(usersSchema.users)
      .where(eq(usersSchema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.createCustomer(userId, user.email, user.name ?? undefined);
  }

  /**
   * Syncs user email/name changes to Stripe.
   */
  async syncCustomerDetails(
    userId: string,
    update: { email?: string; name?: string },
  ): Promise<void> {
    const [customer] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);

    if (!customer) return;

    const stripeUpdate: Stripe.CustomerUpdateParams = {};
    if (update.email) stripeUpdate.email = update.email;
    if (update.name) stripeUpdate.name = update.name;

    if (Object.keys(stripeUpdate).length > 0) {
      await this.stripe.customers.update(customer.stripeCustomerId, stripeUpdate);
      await this.db
        .update(billingCustomers)
        .set({ updatedAt: new Date() })
        .where(eq(billingCustomers.id, customer.id));
    }
  }

  // -------------------------------------------------------------------------
  // Checkout flow
  // -------------------------------------------------------------------------

  /**
   * Create a Stripe Checkout Session for a subscription purchase.
   */
  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string | null; sessionId: string }> {
    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId);

    // Validate that the price ID looks reasonable
    if (!priceId || !priceId.startsWith('price_')) {
      throw new BadRequestException(
        'Invalid price ID. Expected a Stripe price ID starting with "price_".',
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      allow_promotion_codes: true,
    });

    return { url: session.url, sessionId: session.id };
  }

  /**
   * Create a checkout session using a plan ID from the database
   * (resolves the Stripe price ID from config).
   */
  async createCheckoutSessionByPlan(
    userId: string,
    planId: string,
    interval: 'month' | 'year',
  ): Promise<{ url: string | null; sessionId: string }> {
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.name === 'free') {
      throw new BadRequestException('Cannot checkout for the free plan');
    }

    const priceId = this.getStripePriceId(plan.name, interval);
    if (!priceId) {
      throw new BadRequestException('Stripe price not configured for this plan and interval');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    return this.createCheckoutSession(
      userId,
      priceId,
      `${frontendUrl}/settings/billing?success=true`,
      `${frontendUrl}/settings/billing?canceled=true`,
    );
  }

  // -------------------------------------------------------------------------
  // Customer Portal
  // -------------------------------------------------------------------------

  /**
   * Create a Stripe Customer Portal session for self-serve subscription management.
   */
  async createPortalSession(userId: string, returnUrl?: string): Promise<{ url: string }> {
    const stripeCustomerId = await this.resolveStripeCustomerId(userId);

    if (!stripeCustomerId) {
      throw new BadRequestException('No billing account found. Please subscribe first.');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || `${frontendUrl}/settings/billing`,
    });

    return { url: session.url };
  }

  // -------------------------------------------------------------------------
  // Webhook handling
  // -------------------------------------------------------------------------

  /**
   * Process an incoming Stripe webhook event.
   * Verifies the signature, then dispatches to the appropriate handler.
   */
  async handleWebhook(body: Buffer, signature: string): Promise<{ received: true }> {
    const webhookSecret = this.configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  // -------------------------------------------------------------------------
  // Subscription queries
  // -------------------------------------------------------------------------

  /**
   * Get the current subscription info for a user.
   * Returns plan name, status, renewal date, cancellation state, features, and limits.
   */
  async getSubscription(userId: string): Promise<SubscriptionInfo> {
    const [subscription] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      return this.buildSubscriptionInfo('free', 'active', null, null, null, false);
    }

    const planName = (subscription.plan as PlanTier) || 'free';

    // If not active/trialing, treat as free for feature gating
    const effectivePlan =
      subscription.status === 'active' || subscription.status === 'trialing' ? planName : 'free';

    return this.buildSubscriptionInfo(
      effectivePlan,
      subscription.status,
      subscription.stripeSubscriptionId ?? null,
      subscription.currentPeriodStart ?? null,
      subscription.currentPeriodEnd ?? null,
      subscription.cancelAtPeriodEnd === 1,
    );
  }

  /**
   * Get the raw subscription record from the database.
   */
  async getUserSubscription(userId: string) {
    const [subscription] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      const plans = await this.getPlans();
      const freePlan = plans.find((p: { name: string }) => p.name === 'free');
      return {
        plan: freePlan || { name: 'free', features: PLAN_FEATURES.free },
        status: 'active' as const,
        cancelAtPeriodEnd: 0,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
    }

    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription.planId))
      .limit(1);

    return {
      ...subscription,
      plan: plan
        ? { ...plan, features: JSON.parse(plan.features) }
        : { name: 'free', features: PLAN_FEATURES.free },
    };
  }

  // -------------------------------------------------------------------------
  // Cancel / Resume
  // -------------------------------------------------------------------------

  /**
   * Cancel a subscription. If atPeriodEnd is true, the subscription stays active
   * until the current billing period ends. If false, cancels immediately.
   */
  async cancelSubscription(
    userId: string,
    atPeriodEnd: boolean = true,
  ): Promise<{ canceled: true; effectiveDate: string | null }> {
    const [subscription] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found to cancel.');
    }

    if (subscription.status === 'canceled') {
      throw new BadRequestException('Subscription is already canceled.');
    }

    let effectiveDate: string | null = null;

    if (atPeriodEnd) {
      // Cancel at period end: subscription stays active until renewal date
      const updated = await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await this.db
        .update(userSubscriptions)
        .set({
          cancelAtPeriodEnd: 1,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, subscription.id));

      effectiveDate = updated.cancel_at
        ? new Date(updated.cancel_at * 1000).toISOString()
        : subscription.currentPeriodEnd;

      this.logger.log(`Subscription for user ${userId} scheduled for cancellation at period end`);
    } else {
      // Cancel immediately
      await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

      const plans = await this.getPlans();
      const freePlan = plans.find((p: { name: string }) => p.name === 'free');

      await this.db
        .update(userSubscriptions)
        .set({
          status: 'canceled',
          plan: 'free',
          planId: freePlan?.id ?? subscription.planId,
          stripeSubscriptionId: null,
          stripePriceId: null,
          cancelAtPeriodEnd: 0,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, subscription.id));

      effectiveDate = new Date().toISOString();

      this.logger.log(`Subscription for user ${userId} canceled immediately`);
    }

    return { canceled: true, effectiveDate };
  }

  /**
   * Resume a subscription that was marked for cancellation at period end.
   * Only works if the subscription is still active (cancel_at_period_end = true).
   */
  async resumeSubscription(userId: string): Promise<{ resumed: true }> {
    const [subscription] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found.');
    }

    if (subscription.cancelAtPeriodEnd !== 1) {
      throw new BadRequestException('Subscription is not scheduled for cancellation.');
    }

    if (subscription.status === 'canceled') {
      throw new BadRequestException(
        'Cannot resume a fully canceled subscription. Please create a new subscription.',
      );
    }

    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await this.db
      .update(userSubscriptions)
      .set({
        cancelAtPeriodEnd: 0,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, subscription.id));

    this.logger.log(`Subscription for user ${userId} resumed`);

    return { resumed: true };
  }

  // -------------------------------------------------------------------------
  // Feature gating
  // -------------------------------------------------------------------------

  async isPremium(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return subscription.planName !== 'free';
  }

  /**
   * Check if a user can access a specific feature.
   */
  async canAccess(userId: string, feature: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return canAccessFeature(subscription.planName, feature);
  }

  async getFeatureAccess(userId: string, feature: string): Promise<boolean> {
    return this.canAccess(userId, feature);
  }

  /**
   * Check if a user has at least the given plan tier.
   */
  async hasMinimumPlan(userId: string, requiredPlan: PlanTier): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return isAtLeastPlan(subscription.planName, requiredPlan);
  }

  async getUserFeatures(userId: string): Promise<{
    plan: string;
    features: string[];
    limits: Record<string, number | string>;
  }> {
    const subscription = await this.getSubscription(userId);
    const planName = subscription.planName;
    const features = PLAN_FEATURES[planName] || PLAN_FEATURES.free;
    const planLimits = getPlanLimits(planName);

    const limits: Record<string, number | string> = {
      ai_chat_daily:
        planLimits.aiChatMessagesPerDay === -1 ? 'unlimited' : planLimits.aiChatMessagesPerDay,
      linked_accounts:
        planLimits.maxLinkedAccounts === -1 ? 'unlimited' : planLimits.maxLinkedAccounts,
      api_requests_per_minute: planLimits.apiRequestsPerMinute,
      transaction_history_months:
        planLimits.transactionHistoryMonths === -1
          ? 'unlimited'
          : planLimits.transactionHistoryMonths,
    };

    if (planLimits.householdMembers > 0) {
      limits['household_members'] = planLimits.householdMembers;
    }

    return { plan: planName, features, limits };
  }

  // -------------------------------------------------------------------------
  // Usage tracking
  // -------------------------------------------------------------------------

  async checkLinkedAccountLimit(
    userId: string,
    currentCount: number,
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const subscription = await this.getSubscription(userId);
    const limits = getPlanLimits(subscription.planName);

    if (limits.maxLinkedAccounts === -1) {
      return { allowed: true, limit: -1, current: currentCount };
    }

    return {
      allowed: currentCount < limits.maxLinkedAccounts,
      limit: limits.maxLinkedAccounts,
      current: currentCount,
    };
  }

  async trackUsage(userId: string, feature: string, increment: number = 1): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const [existing] = await this.db
      .select()
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.userId, userId),
          eq(usageTracking.feature, feature),
          eq(usageTracking.periodStart, periodStart),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(usageTracking)
        .set({
          count: existing.count + increment,
          updatedAt: new Date(),
        })
        .where(eq(usageTracking.id, existing.id));
    } else {
      await this.db.insert(usageTracking).values({
        userId,
        feature,
        count: increment,
        periodStart,
        periodEnd,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Invoice queries
  // -------------------------------------------------------------------------

  async getUserInvoices(userId: string) {
    return this.db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(invoices.createdAt);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildSubscriptionInfo(
    planName: PlanTier,
    status: string,
    stripeSubscriptionId: string | null,
    currentPeriodStart: string | null,
    currentPeriodEnd: string | null,
    cancelAtPeriodEnd: boolean,
  ): SubscriptionInfo {
    const planDef = PLANS[planName] || PLANS.free;
    return {
      planName,
      planDisplayName: planDef.displayName,
      status,
      stripeSubscriptionId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      features: planDef.features,
      limits: planDef.limits,
    };
  }

  private async seedDefaultPlans() {
    const defaults = [
      {
        name: 'free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: JSON.stringify(PLAN_FEATURES.free),
      },
      {
        name: 'pro',
        stripePriceId: this.configService.get<string>('STRIPE_PRICE_PRO_MONTHLY') || null,
        monthlyPrice: PLANS.pro.monthlyPrice,
        yearlyPrice: PLANS.pro.yearlyPrice,
        features: JSON.stringify(PLAN_FEATURES.pro),
      },
      {
        name: 'premium',
        stripePriceId: this.configService.get<string>('STRIPE_PRICE_PREMIUM_MONTHLY') || null,
        monthlyPrice: PLANS.premium.monthlyPrice,
        yearlyPrice: PLANS.premium.yearlyPrice,
        features: JSON.stringify(PLAN_FEATURES.premium),
      },
    ];

    for (const plan of defaults) {
      await this.db.insert(subscriptionPlans).values(plan);
    }

    const plans = await this.db.select().from(subscriptionPlans);
    return plans.map((p) => ({
      ...p,
      features: JSON.parse(p.features),
    }));
  }

  private getStripePriceId(planName: string, interval: 'month' | 'year'): string | undefined {
    const envMap: Record<string, string> = {
      pro_month: 'STRIPE_PRICE_PRO_MONTHLY',
      pro_year: 'STRIPE_PRICE_PRO_YEARLY',
      premium_month: 'STRIPE_PRICE_PREMIUM_MONTHLY',
      premium_year: 'STRIPE_PRICE_PREMIUM_YEARLY',
    };

    const envKey = envMap[`${planName}_${interval}`];
    if (!envKey) return undefined;

    return this.configService.get<string>(envKey);
  }

  private async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const [billingCustomer] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);

    if (billingCustomer) {
      return billingCustomer.stripeCustomerId;
    }

    // Check legacy subscription record
    const [existing] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (existing?.stripeCustomerId) {
      await this.db.insert(billingCustomers).values({
        userId,
        stripeCustomerId: existing.stripeCustomerId,
      });
      return existing.stripeCustomerId;
    }

    return this.createCustomerForUser(userId);
  }

  private async resolveStripeCustomerId(userId: string): Promise<string | null> {
    const [billingCustomer] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);

    if (billingCustomer) {
      return billingCustomer.stripeCustomerId;
    }

    const [subscription] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    return subscription?.stripeCustomerId ?? null;
  }

  /**
   * Extract period dates from a Stripe subscription.
   */
  private getSubscriptionPeriodDates(sub: Stripe.Subscription): {
    periodStart: string;
    periodEnd: string | null;
  } {
    const periodStart = new Date(sub.start_date * 1000).toISOString();
    const periodEnd = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null;

    return { periodStart, periodEnd };
  }

  /**
   * Resolve plan name from a Stripe subscription's price ID.
   */
  private resolvePlanNameFromPrice(priceId: string): PlanTier {
    const proMonthly = this.configService.get<string>('STRIPE_PRICE_PRO_MONTHLY');
    const proYearly = this.configService.get<string>('STRIPE_PRICE_PRO_YEARLY');
    const premiumMonthly = this.configService.get<string>('STRIPE_PRICE_PREMIUM_MONTHLY');
    const premiumYearly = this.configService.get<string>('STRIPE_PRICE_PREMIUM_YEARLY');

    if (priceId === proMonthly || priceId === proYearly) {
      return 'pro';
    }
    if (priceId === premiumMonthly || priceId === premiumYearly) {
      return 'premium';
    }
    return 'free';
  }

  // -------------------------------------------------------------------------
  // Webhook handlers
  // -------------------------------------------------------------------------

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;

    if (!userId) {
      this.logger.warn('Checkout session missing userId metadata');
      return;
    }

    const stripeSubscriptionId = session.subscription as string;
    const stripeCustomerId = session.customer as string;

    const stripeSubscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

    const { periodStart, periodEnd } = this.getSubscriptionPeriodDates(stripeSubscription);

    const stripePriceId = stripeSubscription.items?.data?.[0]?.price?.id ?? null;

    const planName = stripePriceId ? this.resolvePlanNameFromPrice(stripePriceId) : 'pro';

    // Resolve plan ID from database
    const plans = await this.getPlans();
    const matchingPlan = plans.find((p: { name: string }) => p.name === planName);
    const planId = matchingPlan?.id;

    // Ensure billing_customers record exists
    const [existingCustomer] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);

    if (!existingCustomer) {
      await this.db.insert(billingCustomers).values({
        userId,
        stripeCustomerId,
      });
    }

    // Upsert user subscription
    const [existing] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    const subscriptionData = {
      planId: planId || existing?.planId || '',
      plan: planName,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      status: stripeSubscription.status === 'active' ? 'active' : 'trialing',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end ? 1 : 0,
    };

    if (existing) {
      await this.db
        .update(userSubscriptions)
        .set({ ...subscriptionData, updatedAt: new Date() })
        .where(eq(userSubscriptions.userId, userId));
    } else {
      await this.db.insert(userSubscriptions).values({ userId, ...subscriptionData });
    }

    this.logger.log(`Subscription activated for user ${userId}, plan ${planName}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const [existing] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (!existing) {
      this.logger.warn(`No local subscription found for Stripe subscription ${subscription.id}`);
      return;
    }

    const statusMap: Record<string, string> = {
      active: 'active',
      past_due: 'past_due',
      canceled: 'canceled',
      trialing: 'trialing',
      unpaid: 'past_due',
      incomplete: 'past_due',
      incomplete_expired: 'canceled',
      paused: 'canceled',
    };

    const { periodStart, periodEnd } = this.getSubscriptionPeriodDates(subscription);

    const currentPriceId = subscription.items?.data?.[0]?.price?.id ?? null;
    let planUpdate: PlanTier | undefined;
    if (currentPriceId) {
      planUpdate = this.resolvePlanNameFromPrice(currentPriceId);
    }

    const updateData: Record<string, unknown> = {
      status: statusMap[subscription.status] || 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ? 1 : 0,
      updatedAt: new Date(),
    };

    if (currentPriceId) {
      updateData.stripePriceId = currentPriceId;
    }
    if (planUpdate) {
      updateData.plan = planUpdate;
    }

    await this.db
      .update(userSubscriptions)
      .set(updateData)
      .where(eq(userSubscriptions.id, existing.id));

    this.logger.log(
      `Subscription updated for user ${existing.userId}: ${subscription.status}${planUpdate ? `, plan: ${planUpdate}` : ''}`,
    );
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const [existing] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (!existing) {
      this.logger.warn(`No local subscription found for Stripe subscription ${subscription.id}`);
      return;
    }

    const plans = await this.getPlans();
    const freePlan = plans.find((p: { name: string }) => p.name === 'free');

    if (freePlan) {
      await this.db
        .update(userSubscriptions)
        .set({
          planId: freePlan.id,
          plan: 'free',
          status: 'canceled',
          stripeSubscriptionId: null,
          stripePriceId: null,
          cancelAtPeriodEnd: 0,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, existing.id));
    }

    this.logger.log(`Subscription canceled for user ${existing.userId}`);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (!customerId) return;

    const userId = await this.resolveUserIdFromCustomer(customerId);
    if (!userId) {
      this.logger.warn(`No user found for Stripe customer ${customerId} on payment success`);
      return;
    }

    const amountPaid = (invoice.amount_paid ?? 0) / 100;

    // Idempotency check
    const [existingInvoice] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, invoice.id))
      .limit(1);

    if (!existingInvoice) {
      await this.db.insert(invoices).values({
        userId,
        stripeInvoiceId: invoice.id,
        amount: amountPaid,
        currency: invoice.currency ?? 'usd',
        status: 'paid',
        description: invoice.lines?.data?.[0]?.description ?? 'Subscription payment',
        invoiceUrl: invoice.hosted_invoice_url ?? null,
        paidAt: new Date(),
      });
    }

    this.logger.log(`Payment succeeded for user ${userId}: $${amountPaid}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (!customerId) return;

    const [existing] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeCustomerId, customerId))
      .limit(1);

    if (!existing) {
      this.logger.warn(`No local subscription found for Stripe customer ${customerId}`);
      return;
    }

    // Mark subscription as past_due
    await this.db
      .update(userSubscriptions)
      .set({
        status: 'past_due',
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, existing.id));

    // Record failed invoice
    const [existingInvoice] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, invoice.id))
      .limit(1);

    if (!existingInvoice) {
      await this.db.insert(invoices).values({
        userId: existing.userId,
        stripeInvoiceId: invoice.id,
        amount: (invoice.amount_due ?? 0) / 100,
        currency: invoice.currency ?? 'usd',
        status: 'open',
        description: 'Failed payment',
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      });
    }

    this.logger.warn(`Payment failed for user ${existing.userId}`);
  }

  private async handleTrialWillEnd(subscription: Stripe.Subscription) {
    const [existing] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (!existing) {
      this.logger.warn(
        `No local subscription found for Stripe subscription ${subscription.id} (trial ending)`,
      );
      return;
    }

    this.logger.log(
      `Trial ending soon for user ${existing.userId}, subscription ${subscription.id}`,
    );
  }

  private async resolveUserIdFromCustomer(stripeCustomerId: string): Promise<string | null> {
    const [billingCustomer] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
      .limit(1);

    if (billingCustomer) {
      return billingCustomer.userId;
    }

    const [sub] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);

    return sub?.userId ?? null;
  }
}
