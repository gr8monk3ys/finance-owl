CREATE TABLE "budget_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"budget_id" text NOT NULL,
	"user_id" text NOT NULL,
	"threshold_percent" integer NOT NULL,
	"actual_percent" numeric(7, 2) NOT NULL,
	"period_start" text NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "investment_holdings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "investment_transactions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "securities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "security_prices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_alerts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_factors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_scores" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "breach_checks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "breaches" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "password_exposures" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "savings_analysis" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "savings_rules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "savings_transfers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "round_up_configs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "round_up_transactions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unclaimed_results" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unclaimed_searches" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_recommendations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bill_negotiations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negotiation_scripts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "article_progress" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "receipts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "properties" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_value_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_value_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_export_requests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "privacy_consents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exchange_rates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_currency_preferences" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_simulations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_health_goals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_health_scores" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "challenge_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "challenges" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "year_reviews" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tax_documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tax_summaries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "benchmark_data" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "benchmark_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_products" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_clicks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referral_codes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referrals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "advisor_access_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "advisor_shares" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "community_posts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "post_likes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "post_replies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negotiation_attempts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negotiation_scripts_store" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "envelope_transactions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "envelopes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "banking_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "banking_transfers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interest_payments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "investment_holdings" CASCADE;--> statement-breakpoint
DROP TABLE "investment_transactions" CASCADE;--> statement-breakpoint
DROP TABLE "securities" CASCADE;--> statement-breakpoint
DROP TABLE "security_prices" CASCADE;--> statement-breakpoint
DROP TABLE "credit_alerts" CASCADE;--> statement-breakpoint
DROP TABLE "credit_factors" CASCADE;--> statement-breakpoint
DROP TABLE "credit_scores" CASCADE;--> statement-breakpoint
DROP TABLE "breach_checks" CASCADE;--> statement-breakpoint
DROP TABLE "breaches" CASCADE;--> statement-breakpoint
DROP TABLE "password_exposures" CASCADE;--> statement-breakpoint
DROP TABLE "savings_analysis" CASCADE;--> statement-breakpoint
DROP TABLE "savings_rules" CASCADE;--> statement-breakpoint
DROP TABLE "savings_transfers" CASCADE;--> statement-breakpoint
DROP TABLE "round_up_configs" CASCADE;--> statement-breakpoint
DROP TABLE "round_up_transactions" CASCADE;--> statement-breakpoint
DROP TABLE "unclaimed_results" CASCADE;--> statement-breakpoint
DROP TABLE "unclaimed_searches" CASCADE;--> statement-breakpoint
DROP TABLE "product_recommendations" CASCADE;--> statement-breakpoint
DROP TABLE "bill_negotiations" CASCADE;--> statement-breakpoint
DROP TABLE "negotiation_scripts" CASCADE;--> statement-breakpoint
DROP TABLE "article_progress" CASCADE;--> statement-breakpoint
DROP TABLE "receipts" CASCADE;--> statement-breakpoint
DROP TABLE "properties" CASCADE;--> statement-breakpoint
DROP TABLE "property_value_history" CASCADE;--> statement-breakpoint
DROP TABLE "vehicle_value_history" CASCADE;--> statement-breakpoint
DROP TABLE "vehicles" CASCADE;--> statement-breakpoint
DROP TABLE "data_deletion_requests" CASCADE;--> statement-breakpoint
DROP TABLE "data_export_requests" CASCADE;--> statement-breakpoint
DROP TABLE "privacy_consents" CASCADE;--> statement-breakpoint
DROP TABLE "exchange_rates" CASCADE;--> statement-breakpoint
DROP TABLE "user_currency_preferences" CASCADE;--> statement-breakpoint
DROP TABLE "credit_profiles" CASCADE;--> statement-breakpoint
DROP TABLE "credit_simulations" CASCADE;--> statement-breakpoint
DROP TABLE "financial_health_goals" CASCADE;--> statement-breakpoint
DROP TABLE "financial_health_scores" CASCADE;--> statement-breakpoint
DROP TABLE "challenge_entries" CASCADE;--> statement-breakpoint
DROP TABLE "challenges" CASCADE;--> statement-breakpoint
DROP TABLE "year_reviews" CASCADE;--> statement-breakpoint
DROP TABLE "tax_documents" CASCADE;--> statement-breakpoint
DROP TABLE "tax_summaries" CASCADE;--> statement-breakpoint
DROP TABLE "benchmark_data" CASCADE;--> statement-breakpoint
DROP TABLE "benchmark_profiles" CASCADE;--> statement-breakpoint
DROP TABLE "financial_products" CASCADE;--> statement-breakpoint
DROP TABLE "product_clicks" CASCADE;--> statement-breakpoint
DROP TABLE "referral_codes" CASCADE;--> statement-breakpoint
DROP TABLE "referrals" CASCADE;--> statement-breakpoint
DROP TABLE "advisor_access_logs" CASCADE;--> statement-breakpoint
DROP TABLE "advisor_shares" CASCADE;--> statement-breakpoint
DROP TABLE "community_posts" CASCADE;--> statement-breakpoint
DROP TABLE "post_likes" CASCADE;--> statement-breakpoint
DROP TABLE "post_replies" CASCADE;--> statement-breakpoint
DROP TABLE "negotiation_attempts" CASCADE;--> statement-breakpoint
DROP TABLE "negotiation_scripts_store" CASCADE;--> statement-breakpoint
DROP TABLE "envelope_transactions" CASCADE;--> statement-breakpoint
DROP TABLE "envelopes" CASCADE;--> statement-breakpoint
DROP TABLE "tenant_members" CASCADE;--> statement-breakpoint
DROP TABLE "tenants" CASCADE;--> statement-breakpoint
DROP TABLE "banking_accounts" CASCADE;--> statement-breakpoint
DROP TABLE "banking_transfers" CASCADE;--> statement-breakpoint
DROP TABLE "interest_payments" CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "read" DROP DEFAULT;--> statement-breakpoint
UPDATE "notifications" SET "read" = 'false' WHERE "read" IS NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "read" SET DATA TYPE boolean USING "read"::boolean;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "read" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "read" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "severity" text DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_url" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "household_id" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "budget_type" text DEFAULT 'category' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "alert_thresholds" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "start_date" text;--> statement-breakpoint
ALTER TABLE "budget_alerts" ADD CONSTRAINT "budget_alerts_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_alerts" ADD CONSTRAINT "budget_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;