# Finance Owl

Privacy-first, self-hosted personal finance manager: it links bank accounts, categorizes transactions, tracks budgets and subscriptions, and lets a household share a view of its money.

## Language

### Banking

**Aggregator**:
A third-party service that connects to banks on the user's behalf: `plaid`, `mx` or `finicity`. Every Aggregator sits behind the `BankAggregatorProvider` interface.
_Avoid_: Bank provider, data provider

**Plaid Item**:
One user's connection to one institution through Plaid, holding the encrypted access token, the sync cursor and the connection status (`active`, `error`, `login_required`).
_Avoid_: Link, connection, bank login

**Account**:
A financial account of one user: checking, savings, credit card, investment, loan, mortgage or other. Synced from a Plaid Item or entered by hand (`isManual`).
_Avoid_: Bank account, wallet

**Transaction**:
A single movement of money on an Account, dated `YYYY-MM-DD` and possibly `pending`. Either synced from an Aggregator or entered by hand.
_Avoid_: Payment, entry, expense

**Transaction Split**:
A portion of a Transaction assigned to its own Category, optionally attributed to a Household Member.
_Avoid_: Sub-transaction, line item

**Transaction Flag**:
A Household Member's request that another member review a Transaction; it is `open` until `resolved`.
_Avoid_: Report, dispute

### Categorization

**Category**:
A label for what a Transaction was spent on. Categories form a tree through `parentId`; system Categories (`isSystem`) have no owner and user Categories belong to one user.
_Avoid_: Tag, label, bucket

**Categorization Source**:
How a Transaction got its Category: `user`, `rule`, `plaid`, `ai` or `manual`.
_Avoid_: Category origin

**Categorization Rule**:
A user-defined match (merchant, description, amount range or regex) with a priority that assigns a Category to matching Transactions.
_Avoid_: Auto-rule, filter

**Categorization Correction**:
A record that a user moved a merchant's Transaction from one Category to another, kept so later categorization can learn from it.
_Avoid_: Override, fix

### Budgeting

**Budget**:
A spending limit for a period, either `category` (one Category and its children) or `overall` (all spending).
_Avoid_: Limit, envelope

**Budget Period**:
One concrete window of a Budget (start and end date) with its budgeted, spent and rollover amounts.
_Avoid_: Cycle, month

**Rollover**:
Unspent Budget amount carried into the next Budget Period, bounded by the optional `rolloverCap`.
_Avoid_: Carry-over, surplus

**Alert Threshold**:
A percentage of a Budget (for example 50, 90, 100, 110) at which a Budget Alert fires.
_Avoid_: Warning level

**Budget Alert**:
The record that a Budget crossed an Alert Threshold in a given Budget Period.
_Avoid_: Notification (a Notification is the message delivered to the user)

**Savings Goal**:
A target amount the user is saving toward.
_Avoid_: Fund, pot

### Subscriptions

**Subscription**:
A recurring charge detected from Transaction history, with a billing frequency, a confidence level (`high`, `medium`, `low`) and a subscription category such as streaming or software.
_Avoid_: Recurring bill, membership

**Cancellation Catalog**:
The single table of provider cancellation playbooks (method, URL, phone, difficulty, tips) used to guide cancelling a Subscription.
_Avoid_: Provider database

### Households

**Household**:
A group of users who share selected Accounts, owned by one user and joinable by invite code.
_Avoid_: Family, team, workspace

**Household Member**:
A user's membership in a Household with a role: `owner`, `editor` or `viewer`.
_Avoid_: Participant

**Shared Account**:
An Account a Household Member has made visible to the whole Household.
_Avoid_: Joint account
