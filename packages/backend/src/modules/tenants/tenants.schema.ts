import { pgTable, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const tenants = pgTable('tenants', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // subdomain identifier
  domain: text('custom_domain'), // custom domain mapping

  // Branding
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: text('primary_color').default('#10b981'), // emerald
  accentColor: text('accent_color').default('#f59e0b'), // amber
  appName: text('app_name').default('Finance Owl'),

  // Configuration
  features: text('features'), // JSON array of enabled features
  maxUsers: integer('max_users').default(100),
  plan: text('plan').notNull().default('free'), // free, pro, enterprise

  // Status
  status: text('status').notNull().default('active'), // active, suspended, trial
  trialEndsAt: timestamp('trial_ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // owner, admin, member
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueMembership: unique('tenant_member_unique').on(
      table.tenantId,
      table.userId,
    ),
  }),
);

// TypeScript types inferred from schema
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;
