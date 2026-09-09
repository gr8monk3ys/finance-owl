import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Injection token for the Stripe client.
 *
 * The client is a provider rather than a `new Stripe(...)` inside
 * BillingService so that the service's constructor is the whole test surface:
 * specs inject a fake and assert through the public interface instead of
 * reaching into a private field.
 */
export const STRIPE_CLIENT = 'STRIPE_CLIENT';

export const stripeProvider: Provider = {
  provide: STRIPE_CLIENT,
  useFactory: (configService: ConfigService): Stripe => {
    const logger = new Logger('StripeClient');
    const secretKey = configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      logger.warn('STRIPE_SECRET_KEY is not configured. Billing features will not work.');
    }

    return new Stripe(secretKey || 'sk_not_configured');
  },
  inject: [ConfigService],
};
