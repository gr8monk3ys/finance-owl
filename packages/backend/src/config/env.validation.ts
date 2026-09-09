import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MinLength,
  validateSync,
  IsUrl,
  Matches,
} from 'class-validator';
import { STRIPE_PRICE_SLOTS } from '../modules/billing/stripe-prices';

/**
 * Durations accepted by `ms`, the parser both `@nestjs/jwt` and `AuthService`
 * use for the JWT expiries. A unit is required: bare numbers mean milliseconds
 * to `ms` but seconds to `jsonwebtoken`, and that ambiguity is not worth
 * shipping.
 */
export const MS_DURATION_PATTERN =
  /^\d+(?:\.\d+)?\s*(?:ms|msecs?|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?|y|yrs?|years?)$/i;

const durationMessage = (name: string) =>
  `${name} must be a duration with a unit, e.g. 30s, 15m, 2h, 7d or 1w`;

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty({ message: 'JWT_SECRET is required' })
  @MinLength(32, {
    message:
      'JWT_SECRET must be at least 32 characters for adequate security. Generate with: openssl rand -base64 48',
  })
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_REFRESH_SECRET is required' })
  @MinLength(32, {
    message:
      'JWT_REFRESH_SECRET must be at least 32 characters for adequate security. Generate with: openssl rand -base64 48',
  })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty({ message: 'ENCRYPTION_KEY is required' })
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message: 'ENCRYPTION_KEY must be a 64-character hex string',
  })
  ENCRYPTION_KEY!: string;

  @IsString()
  @IsNotEmpty({ message: 'ENCRYPTION_MASTER_SECRET is required' })
  @MinLength(32, {
    message:
      'ENCRYPTION_MASTER_SECRET must be at least 32 characters. Generate with: openssl rand -base64 48',
  })
  ENCRYPTION_MASTER_SECRET!: string;

  @IsString()
  @IsNotEmpty({
    message:
      'DATABASE_URL is required (e.g. postgresql://postgres:postgres@localhost:5432/finance_owl)',
  })
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty({ message: 'FRONTEND_URL is required for CORS configuration in production' })
  FRONTEND_URL!: string;

  @IsOptional()
  @IsString()
  @Matches(MS_DURATION_PATTERN, { message: durationMessage('JWT_ACCESS_EXPIRY') })
  JWT_ACCESS_EXPIRY?: string;

  @IsOptional()
  @IsString()
  @Matches(MS_DURATION_PATTERN, { message: durationMessage('JWT_REFRESH_EXPIRY') })
  JWT_REFRESH_EXPIRY?: string;

  @IsOptional()
  @IsString()
  PLAID_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  PLAID_SECRET?: string;

  @IsOptional()
  @IsString()
  PLAID_ENV?: string;

  @IsString()
  @IsNotEmpty({ message: 'REDIS_URL is required for job queues in production' })
  REDIS_URL!: string;

  @IsOptional()
  @IsString()
  OLLAMA_URL?: string;

  @IsOptional()
  @IsString()
  CHROMADB_URL?: string;

  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @IsOptional()
  @IsString()
  SENTRY_RELEASE?: string;

  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Billing is opt-in: with no STRIPE_SECRET_KEY the app boots without it.
 * Once it is set, every Stripe price must be configured too — an unset
 * STRIPE_PRICE_* used to make the webhook fail to map a price back to a plan,
 * which silently downgraded a paying customer to `free`. Fail at boot instead.
 */
function validateStripeConfig(config: Record<string, unknown>): string[] {
  if (!readString(config.STRIPE_SECRET_KEY)) {
    return [];
  }

  const errors: string[] = [];

  if (!readString(config.STRIPE_WEBHOOK_SECRET)) {
    errors.push(
      'STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set — webhook signatures cannot be verified without it',
    );
  }

  const seen = new Map<string, string>();

  for (const slot of STRIPE_PRICE_SLOTS) {
    const priceId = readString(config[slot.envVar]);

    if (!priceId) {
      errors.push(
        `${slot.envVar} is required when STRIPE_SECRET_KEY is set: without it the ${slot.plan} ${slot.interval}ly price cannot be mapped back to a plan, and paying customers on that price are treated as unknown`,
      );
      continue;
    }

    if (!priceId.startsWith('price_')) {
      errors.push(`${slot.envVar} must be a Stripe price ID starting with "price_"`);
      continue;
    }

    const clash = seen.get(priceId);
    if (clash) {
      errors.push(
        `${slot.envVar} and ${clash} are set to the same Stripe price ID; a price must map to exactly one plan and interval`,
      );
    } else {
      seen.set(priceId, slot.envVar);
    }
  }

  return errors;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  const messages = [
    ...errors.flatMap((err) => Object.values(err.constraints || {})),
    ...validateStripeConfig(config),
  ];

  if (messages.length > 0) {
    throw new Error(`Environment validation failed:\n  - ${messages.join('\n  - ')}`);
  }

  return validatedConfig;
}
