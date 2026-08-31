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
  JWT_ACCESS_EXPIRY?: string;

  @IsOptional()
  @IsString()
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
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors.flatMap((err) => Object.values(err.constraints || {})).join('\n  - ');
    throw new Error(`Environment validation failed:\n  - ${messages}`);
  }

  return validatedConfig;
}
