CREATE TABLE "billing_customers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "billing_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"description" text,
	"invoice_url" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feature" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "current_balance" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "available_balance" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "credit_limit" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "net_worth_history" ALTER COLUMN "assets" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "net_worth_history" ALTER COLUMN "liabilities" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "net_worth_history" ALTER COLUMN "net_worth" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "budget_periods" ALTER COLUMN "budgeted_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "budget_periods" ALTER COLUMN "spent_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "budget_periods" ALTER COLUMN "rollover_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "rollover_cap" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "recurring_transactions" ALTER COLUMN "estimated_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "transaction_splits" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "investment_holdings" ALTER COLUMN "quantity" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "investment_holdings" ALTER COLUMN "cost_basis" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "investment_holdings" ALTER COLUMN "institution_value" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "investment_transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "investment_transactions" ALTER COLUMN "quantity" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "investment_transactions" ALTER COLUMN "price" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "investment_transactions" ALTER COLUMN "fees" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "securities" ALTER COLUMN "close_price" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "security_prices" ALTER COLUMN "price" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_contributions" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_goals" ALTER COLUMN "target_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_goals" ALTER COLUMN "current_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "subscription_plans" ALTER COLUMN "monthly_price" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "subscription_plans" ALTER COLUMN "yearly_price" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_analysis" ALTER COLUMN "average_monthly_income" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_analysis" ALTER COLUMN "average_monthly_expenses" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_analysis" ALTER COLUMN "average_surplus" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_rules" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_rules" ALTER COLUMN "round_up_to" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "savings_transfers" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "round_up_configs" ALTER COLUMN "round_to" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "round_up_configs" ALTER COLUMN "max_daily_round_up" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "round_up_transactions" ALTER COLUMN "original_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "round_up_transactions" ALTER COLUMN "rounded_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "round_up_transactions" ALTER COLUMN "round_up_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "unclaimed_results" ALTER COLUMN "reported_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "product_recommendations" ALTER COLUMN "annual_fee" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "bill_negotiations" ALTER COLUMN "current_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "bill_negotiations" ALTER COLUMN "target_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "bill_negotiations" ALTER COLUMN "negotiated_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "bill_negotiations" ALTER COLUMN "annual_savings" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "total_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "purchase_price" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "current_estimate" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "property_value_history" ALTER COLUMN "estimated_value" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "vehicle_value_history" ALTER COLUMN "estimated_value" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "purchase_price" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "current_estimate" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "credit_profiles" ALTER COLUMN "total_debt" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "credit_profiles" ALTER COLUMN "available_credit" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "financial_health_goals" ALTER COLUMN "target_value" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "financial_health_goals" ALTER COLUMN "current_value" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "challenge_entries" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "challenges" ALTER COLUMN "target_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "challenges" ALTER COLUMN "current_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "year_reviews" ALTER COLUMN "total_income" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "year_reviews" ALTER COLUMN "total_spending" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "year_reviews" ALTER COLUMN "total_saved" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "year_reviews" ALTER COLUMN "average_transaction" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "year_reviews" ALTER COLUMN "biggest_purchase" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "tax_documents" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "tax_summaries" ALTER COLUMN "estimated_income" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "tax_summaries" ALTER COLUMN "estimated_deductions" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "tax_summaries" ALTER COLUMN "estimated_taxable_income" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "tax_summaries" ALTER COLUMN "estimated_federal_tax" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "tax_summaries" ALTER COLUMN "estimated_state_tax" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "benchmark_data" ALTER COLUMN "average_spending" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "financial_products" ALTER COLUMN "annual_fee" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "referral_codes" ALTER COLUMN "total_earnings" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "referrals" ALTER COLUMN "reward_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "negotiation_attempts" ALTER COLUMN "original_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "negotiation_attempts" ALTER COLUMN "target_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "negotiation_attempts" ALTER COLUMN "negotiated_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "negotiation_attempts" ALTER COLUMN "annual_savings" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "envelope_transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "envelopes" ALTER COLUMN "budgeted_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "envelopes" ALTER COLUMN "spent_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "envelopes" ALTER COLUMN "target_amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "banking_accounts" ALTER COLUMN "balance" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "banking_transfers" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "interest_payments" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;