/**
 * Stripe Product & Price Setup Script
 *
 * Creates the Finance Owl products and recurring prices used by the app's
 * current billing model.
 * This script is idempotent -- it checks if products already exist before creating them.
 *
 * Usage:
 *   npx tsx packages/backend/scripts/setup-stripe-products.ts
 *
 * Requires STRIPE_SECRET_KEY in the environment (or .env file in project root).
 */

import Stripe from 'stripe';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Load .env if present
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf-8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.startsWith('sk_test_...')) {
  console.error(
    'ERROR: STRIPE_SECRET_KEY is not set or is a placeholder.\n' +
      'Set it in your environment or in a .env file at the project root.',
  );
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// ---------------------------------------------------------------------------
// Product & Price Definitions
// ---------------------------------------------------------------------------

interface PlanConfig {
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: {
    monthly?: number; // in cents
    yearly?: number; // in cents
  };
}

const PLANS: PlanConfig[] = [
  {
    name: 'Finance Owl Free',
    description:
      'Basic personal finance tracking. 2 linked accounts, manual transactions, basic budgets.',
    metadata: { tier: 'free' },
    prices: {},
  },
  {
    name: 'Finance Owl Pro',
    description:
      'Unlimited accounts, subscription tracking, bill negotiation, smart savings, investment tracking, and advanced reports.',
    metadata: { tier: 'pro' },
    prices: {
      monthly: 999, // $9.99
      yearly: 9999, // $99.99
    },
  },
  {
    name: 'Finance Owl Premium',
    description:
      'Everything in Pro plus household sharing, advisor access, API access, and dedicated support.',
    metadata: { tier: 'premium' },
    prices: {
      monthly: 1999, // $19.99
      yearly: 19999, // $199.99
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findExistingProduct(
  name: string,
): Promise<Stripe.Product | null> {
  const products = await stripe.products.list({ limit: 100, active: true });
  return products.data.find((p) => p.name === name) ?? null;
}

async function findExistingPrice(
  productId: string,
  interval: 'month' | 'year',
  unitAmount: number,
): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({
    product: productId,
    limit: 100,
    active: true,
  });
  return (
    prices.data.find(
      (p) =>
        p.recurring?.interval === interval && p.unit_amount === unitAmount,
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Finance Owl -- Stripe Product & Price Setup');
  console.log('==========================================\n');

  const results: Record<string, string> = {};

  for (const plan of PLANS) {
    console.log(`Processing: ${plan.name}`);

    // Find or create product
    let product = await findExistingProduct(plan.name);
    if (product) {
      console.log(`  Product already exists: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: plan.metadata,
      });
      console.log(`  Created product: ${product.id}`);
    }

    // Create prices
    if (plan.prices.monthly) {
      let price = await findExistingPrice(
        product.id,
        'month',
        plan.prices.monthly,
      );
      if (price) {
        console.log(`  Monthly price already exists: ${price.id}`);
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.prices.monthly,
          currency: 'usd',
          recurring: { interval: 'month' },
          metadata: plan.metadata,
        });
        console.log(`  Created monthly price: ${price.id}`);
      }
      const tier = plan.metadata.tier.toUpperCase();
      results[`STRIPE_PRICE_${tier}_MONTHLY`] = price.id;
    }

    if (plan.prices.yearly) {
      let price = await findExistingPrice(
        product.id,
        'year',
        plan.prices.yearly,
      );
      if (price) {
        console.log(`  Yearly price already exists: ${price.id}`);
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.prices.yearly,
          currency: 'usd',
          recurring: { interval: 'year' },
          metadata: plan.metadata,
        });
        console.log(`  Created yearly price: ${price.id}`);
      }
      const tier = plan.metadata.tier.toUpperCase();
      results[`STRIPE_PRICE_${tier}_YEARLY`] = price.id;
    }

    console.log('');
  }

  // Output summary
  console.log('==========================================');
  console.log('Setup complete! Add these to your .env:\n');
  for (const [key, value] of Object.entries(results)) {
    console.log(`${key}=${value}`);
  }
  console.log('\n==========================================');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
