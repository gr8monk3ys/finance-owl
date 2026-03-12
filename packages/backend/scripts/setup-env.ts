/**
 * Environment Setup Helper
 *
 * Interactive CLI that generates a .env file from .env.example.
 * Automatically generates secure random values for secrets and validates
 * required vs optional environment variables.
 *
 * Usage:
 *   npx tsx scripts/setup-env.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnvVar {
  key: string;
  defaultValue: string;
  comment: string;
  required: boolean;
  autoGenerate?: 'jwt_secret' | 'encryption_key';
  category: string;
}

// ---------------------------------------------------------------------------
// Environment variable definitions
// ---------------------------------------------------------------------------

const ENV_CATEGORIES: Record<string, { label: string; description: string }> = {
  database: {
    label: 'Database (PostgreSQL)',
    description: 'Required for the application to start.',
  },
  auth: {
    label: 'Authentication',
    description: 'JWT secrets are auto-generated. Must be at least 32 characters.',
  },
  encryption: {
    label: 'Encryption',
    description: 'Used to encrypt Plaid tokens and TOTP secrets at rest.',
  },
  plaid: {
    label: 'Plaid (Bank Linking)',
    description: 'Required for connecting bank accounts. Sign up at https://dashboard.plaid.com',
  },
  redis: {
    label: 'Redis (BullMQ)',
    description: 'Required for background job processing.',
  },
  frontend: {
    label: 'Frontend / CORS',
    description: 'The URL of your frontend application.',
  },
  stripe: {
    label: 'Stripe Billing',
    description: 'Required for subscription billing. Sign up at https://dashboard.stripe.com',
  },
  email: {
    label: 'Email (SMTP)',
    description: 'Required for sending notifications, password resets, etc.',
  },
  webauthn: {
    label: 'WebAuthn (Passkeys)',
    description: 'Configuration for passwordless authentication.',
  },
  ai: {
    label: 'AI Services',
    description: 'Optional. AI features degrade gracefully without these.',
  },
  monitoring: {
    label: 'Monitoring (Sentry)',
    description: 'Optional. Error tracking. Sign up at https://sentry.io',
  },
};

const ENV_VARS: EnvVar[] = [
  // Database
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:5432/finance_owl',
    comment: 'PostgreSQL connection string',
    required: true,
    category: 'database',
  },

  // Auth
  {
    key: 'JWT_SECRET',
    defaultValue: '',
    comment: 'JWT signing secret (min 32 chars)',
    required: true,
    autoGenerate: 'jwt_secret',
    category: 'auth',
  },
  {
    key: 'JWT_REFRESH_SECRET',
    defaultValue: '',
    comment: 'JWT refresh token secret (min 32 chars)',
    required: true,
    autoGenerate: 'jwt_secret',
    category: 'auth',
  },
  {
    key: 'JWT_ACCESS_EXPIRY',
    defaultValue: '15m',
    comment: 'Access token expiry',
    required: false,
    category: 'auth',
  },
  {
    key: 'JWT_REFRESH_EXPIRY',
    defaultValue: '7d',
    comment: 'Refresh token expiry',
    required: false,
    category: 'auth',
  },

  // Encryption
  {
    key: 'ENCRYPTION_KEY',
    defaultValue: '',
    comment: 'AES-256 encryption key (64 hex chars)',
    required: true,
    autoGenerate: 'encryption_key',
    category: 'encryption',
  },

  // Plaid
  {
    key: 'PLAID_CLIENT_ID',
    defaultValue: '',
    comment: 'Plaid API client ID',
    required: false,
    category: 'plaid',
  },
  {
    key: 'PLAID_SECRET',
    defaultValue: '',
    comment: 'Plaid API secret',
    required: false,
    category: 'plaid',
  },
  {
    key: 'PLAID_ENV',
    defaultValue: 'sandbox',
    comment: 'Plaid environment (sandbox, development, production)',
    required: false,
    category: 'plaid',
  },

  // Redis
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:6379',
    comment: 'Redis connection string',
    required: true,
    category: 'redis',
  },

  // Frontend
  {
    key: 'FRONTEND_URL',
    defaultValue: 'http://localhost:3000',
    comment: 'Frontend URL for CORS',
    required: true,
    category: 'frontend',
  },
  {
    key: 'PORT',
    defaultValue: '80',
    comment: 'Backend server port',
    required: false,
    category: 'frontend',
  },

  // Stripe
  {
    key: 'STRIPE_SECRET_KEY',
    defaultValue: '',
    comment: 'Stripe secret key',
    required: false,
    category: 'stripe',
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    defaultValue: '',
    comment: 'Stripe webhook signing secret',
    required: false,
    category: 'stripe',
  },

  // Email
  {
    key: 'SMTP_HOST',
    defaultValue: 'smtp.gmail.com',
    comment: 'SMTP host',
    required: false,
    category: 'email',
  },
  {
    key: 'SMTP_PORT',
    defaultValue: '587',
    comment: 'SMTP port',
    required: false,
    category: 'email',
  },
  {
    key: 'SMTP_USER',
    defaultValue: '',
    comment: 'SMTP username',
    required: false,
    category: 'email',
  },
  {
    key: 'SMTP_PASS',
    defaultValue: '',
    comment: 'SMTP password',
    required: false,
    category: 'email',
  },
  {
    key: 'SMTP_FROM',
    defaultValue: 'Finance Owl <noreply@financeowl.com>',
    comment: 'From address for emails',
    required: false,
    category: 'email',
  },

  // WebAuthn
  {
    key: 'WEBAUTHN_RP_NAME',
    defaultValue: 'Finance Owl',
    comment: 'WebAuthn relying party name',
    required: false,
    category: 'webauthn',
  },
  {
    key: 'WEBAUTHN_RP_ID',
    defaultValue: 'localhost',
    comment: 'WebAuthn relying party ID',
    required: false,
    category: 'webauthn',
  },
  {
    key: 'WEBAUTHN_ORIGIN',
    defaultValue: 'http://localhost:3000',
    comment: 'WebAuthn origin',
    required: false,
    category: 'webauthn',
  },

  // AI
  {
    key: 'OLLAMA_URL',
    defaultValue: 'http://localhost:11434',
    comment: 'Ollama AI server URL',
    required: false,
    category: 'ai',
  },
  {
    key: 'CHROMADB_URL',
    defaultValue: 'http://localhost:8000',
    comment: 'ChromaDB vector database URL',
    required: false,
    category: 'ai',
  },

  // Monitoring
  {
    key: 'SENTRY_DSN',
    defaultValue: '',
    comment: 'Sentry DSN for error tracking',
    required: false,
    category: 'monitoring',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateJwtSecret(): string {
  return crypto.randomBytes(48).toString('base64');
}

function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateValue(type: EnvVar['autoGenerate']): string {
  switch (type) {
    case 'jwt_secret':
      return generateJwtSecret();
    case 'encryption_key':
      return generateEncryptionKey();
    default:
      return '';
  }
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Main setup function
// ---------------------------------------------------------------------------
async function setup(): Promise<void> {
  console.log('');
  console.log('  Finance Owl -- Environment Setup');
  console.log('  ==========================================');
  console.log('');
  console.log('  This will generate a .env file with your configuration.');
  console.log('  Press Enter to accept defaults shown in [brackets].');
  console.log('  Secrets will be auto-generated where applicable.');
  console.log('');

  const projectRoot = path.resolve(__dirname, '../../..');
  const envPath = path.join(projectRoot, '.env');

  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await prompt(rl, '  A .env file already exists. Overwrite? (y/N): ');
    rl.close();
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('  Setup cancelled.');
      process.exit(0);
    }
    console.log('');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const envLines: string[] = [
    '# ===========================================',
    '# Finance Owl Environment Configuration',
    `# Generated on ${new Date().toISOString().slice(0, 10)}`,
    '# ===========================================',
    '',
  ];

  const values = new Map<string, string>();
  let currentCategory = '';

  for (const envVar of ENV_VARS) {
    // Print category header when category changes
    if (envVar.category !== currentCategory) {
      currentCategory = envVar.category;
      const cat = ENV_CATEGORIES[currentCategory];
      if (cat) {
        console.log(`  --- ${cat.label} ---`);
        console.log(`  ${cat.description}`);
        console.log('');

        envLines.push(`# ${cat.label}`);
      }
    }

    let value: string;

    if (envVar.autoGenerate) {
      // Auto-generate secrets
      value = generateValue(envVar.autoGenerate);
      console.log(`  ${envVar.key}: [auto-generated]`);
    } else if (envVar.required) {
      // Prompt for required variables
      const defaultDisplay = envVar.defaultValue
        ? ` [${envVar.defaultValue}]`
        : '';
      const answer = await prompt(rl, `  ${envVar.key}${defaultDisplay}: `);
      value = answer || envVar.defaultValue;
    } else {
      // Use defaults for optional variables
      value = envVar.defaultValue;
      if (value) {
        console.log(`  ${envVar.key}: ${value} (default)`);
      } else {
        console.log(`  ${envVar.key}: (empty, configure later)`);
      }
    }

    values.set(envVar.key, value);
    envLines.push(`${envVar.key}=${value}`);

    // Add blank line between categories
    const nextVar = ENV_VARS[ENV_VARS.indexOf(envVar) + 1];
    if (nextVar && nextVar.category !== envVar.category) {
      envLines.push('');
      console.log('');
    }
  }

  rl.close();

  // Write .env file
  const envContent = envLines.join('\n') + '\n';
  fs.writeFileSync(envPath, envContent, 'utf-8');

  // Print summary
  console.log('');
  console.log('  ==========================================');
  console.log(`  .env file written to: ${envPath}`);
  console.log('  ==========================================');
  console.log('');

  // Print which services need external setup
  const externalServices: Array<{ name: string; url: string; envKeys: string[] }> = [];

  if (!values.get('PLAID_CLIENT_ID')) {
    externalServices.push({
      name: 'Plaid (Bank Linking)',
      url: 'https://dashboard.plaid.com',
      envKeys: ['PLAID_CLIENT_ID', 'PLAID_SECRET'],
    });
  }

  if (!values.get('STRIPE_SECRET_KEY')) {
    externalServices.push({
      name: 'Stripe (Billing)',
      url: 'https://dashboard.stripe.com',
      envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    });
  }

  if (!values.get('SMTP_USER')) {
    externalServices.push({
      name: 'SMTP (Email)',
      url: 'Use any SMTP provider (Gmail, SendGrid, Mailgun, etc.)',
      envKeys: ['SMTP_USER', 'SMTP_PASS'],
    });
  }

  if (!values.get('SENTRY_DSN')) {
    externalServices.push({
      name: 'Sentry (Error Tracking)',
      url: 'https://sentry.io',
      envKeys: ['SENTRY_DSN'],
    });
  }

  if (externalServices.length > 0) {
    console.log('  The following services need external setup:');
    console.log('');
    for (const svc of externalServices) {
      console.log(`    ${svc.name}`);
      console.log(`      Sign up: ${svc.url}`);
      console.log(`      Set:     ${svc.envKeys.join(', ')}`);
      console.log('');
    }
  }

  // Validate required variables
  const missing: string[] = [];
  for (const envVar of ENV_VARS) {
    if (envVar.required && !values.get(envVar.key)) {
      missing.push(envVar.key);
    }
  }

  if (missing.length > 0) {
    console.log('  WARNING: The following required variables are empty:');
    for (const key of missing) {
      console.log(`    - ${key}`);
    }
    console.log('');
    console.log('  The application may not start correctly until these are set.');
  } else {
    console.log('  All required variables are configured.');
  }

  console.log('');
  console.log('  Next steps:');
  console.log('    1. Start PostgreSQL and Redis (docker-compose up -d)');
  console.log('    2. Run migrations: pnpm --filter @finance-owl/backend db:migrate');
  console.log('    3. Seed the database: pnpm --filter @finance-owl/backend db:seed');
  console.log('    4. Start the app: pnpm dev');
  console.log('');
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
