<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button, Modal, Input } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Wizard state
	let showOpenAccount = $state(false);
	let wizardStep = $state(1);
	let accountType = $state<'checking' | 'savings'>('savings');

	// Transfer modal
	let showTransfer = $state(false);
	let transferType = $state<'internal' | 'external'>('internal');

	// Active tab
	let activeTab = $state<'overview' | 'transfers' | 'interest'>('overview');

	// Derived
	const accounts = $derived(data.accounts);
	const summary = $derived(data.summary);
	const transfers = $derived(data.transfers);
	const interest = $derived(data.interest);
	const rates = $derived(data.rates);
	const fdic = $derived(data.fdic);

	const bestSavingsRate = $derived(() => {
		if (!rates || rates.length === 0) return 4.5;
		return Math.max(...rates.map((r: any) => (r.savings?.apy ?? 0) * 100));
	});

	const bestCheckingRate = $derived(() => {
		if (!rates || rates.length === 0) return 0.1;
		return Math.max(...rates.map((r: any) => (r.checking?.apy ?? 0) * 100));
	});

	function fmt(cents: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(cents / 100);
	}

	function fmtDollars(dollars: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(dollars);
	}

	function fmtPct(decimal: number): string {
		return `${(decimal * 100).toFixed(2)}%`;
	}

	function fmtDate(dateStr: string): string {
		if (!dateStr) return '--';
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function statusBadge(status: string): string {
		const colors: Record<string, string> = {
			active: 'background: var(--color-success-muted); color: var(--color-success)',
			pending: 'background: var(--color-warning-muted); color: var(--color-warning)',
			processing: 'background: var(--color-info-muted); color: var(--color-info)',
			completed: 'background: var(--color-success-muted); color: var(--color-success)',
			failed: 'background: var(--color-error-muted); color: var(--color-error)',
			returned: 'background: var(--color-error-muted); color: var(--color-error)',
			frozen: 'background: var(--color-warning-muted); color: var(--color-warning)',
			closed: 'background: var(--surface-3); color: var(--text-3)'
		};
		return colors[status] || 'background: var(--surface-3); color: var(--text-2)';
	}

	function resetWizard() {
		wizardStep = 1;
		accountType = 'savings';
		showOpenAccount = false;
	}
</script>

<svelte:head>
	<title>Banking | Finance Owl</title>
</svelte:head>

<div class="banking-page">
	<!-- Page Header -->
	<header class="page-header">
		<div class="header-content">
			<div>
				<h1>Banking</h1>
				<p class="subtitle">High-yield savings & checking accounts</p>
			</div>
			<div class="header-actions">
				<Button variant="primary" onclick={() => (showOpenAccount = true)}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 5v14m-7-7h14" />
					</svg>
					Open Account
				</Button>
			</div>
		</div>
	</header>

	<!-- FDIC Badge -->
	<div class="fdic-banner">
		<div class="fdic-icon">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
			</svg>
		</div>
		<div class="fdic-text">
			<strong>FDIC Insured</strong> up to {fdic.maxCoverageFormatted} per depositor
		</div>
		<a href={fdic.learnMoreUrl} target="_blank" rel="noopener noreferrer" class="fdic-link">
			Learn more
		</a>
	</div>

	<!-- Balance Summary Cards -->
	<div class="summary-grid">
		<Card>
			<div class="summary-card">
				<div class="summary-label">Total Balance</div>
				<div class="summary-value">{fmt(summary.totalBalance)}</div>
				<div class="summary-meta">{summary.accountCount} account{summary.accountCount !== 1 ? 's' : ''}</div>
			</div>
		</Card>
		<Card>
			<div class="summary-card">
				<div class="summary-label">Checking</div>
				<div class="summary-value">{fmt(summary.checkingBalance)}</div>
				<div class="summary-meta">{bestCheckingRate()}% APY</div>
			</div>
		</Card>
		<Card>
			<div class="summary-card">
				<div class="summary-label">Savings</div>
				<div class="summary-value savings">{fmt(summary.savingsBalance)}</div>
				<div class="summary-meta apy-highlight">{bestSavingsRate()}% APY</div>
			</div>
		</Card>
		<Card>
			<div class="summary-card">
				<div class="summary-label">Interest Earned (YTD)</div>
				<div class="summary-value interest">{fmt(interest.thisYear)}</div>
				<div class="summary-meta">{fmt(interest.thisMonth)} this month</div>
			</div>
		</Card>
	</div>

	<!-- Tab Navigation -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'overview'}
			onclick={() => (activeTab = 'overview')}
		>
			Accounts
		</button>
		<button
			class="tab"
			class:active={activeTab === 'transfers'}
			onclick={() => (activeTab = 'transfers')}
		>
			Transfers
		</button>
		<button
			class="tab"
			class:active={activeTab === 'interest'}
			onclick={() => (activeTab = 'interest')}
		>
			Interest
		</button>
	</div>

	<!-- Tab Content -->
	{#if activeTab === 'overview'}
		<div class="accounts-section">
			{#if accounts.length === 0}
				<Card>
					<div class="empty-state">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
							<path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
						</svg>
						<h3>No Banking Accounts</h3>
						<p>Open a high-yield savings or checking account to get started.</p>
						<Button variant="primary" onclick={() => (showOpenAccount = true)}>
							Open Your First Account
						</Button>
					</div>
				</Card>
			{:else}
				<div class="accounts-list">
					{#each accounts as account}
						<Card>
							<div class="account-card">
								<div class="account-header">
									<div class="account-type-badge" class:savings={account.type === 'savings'} class:checking={account.type === 'checking'}>
										{#if account.type === 'savings'}
											<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" />
											</svg>
										{:else}
											<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
											</svg>
										{/if}
										<span>{account.type === 'savings' ? 'Savings' : 'Checking'}</span>
									</div>
									<span class="status-badge" style={statusBadge(account.status)}>
										{account.status}
									</span>
								</div>
								<div class="account-balance">{fmt(account.balance)}</div>
								<div class="account-details">
									<div class="detail">
										<span class="detail-label">APY</span>
										<span class="detail-value apy">{fmtPct(account.apy || 0)}</span>
									</div>
									<div class="detail">
										<span class="detail-label">Routing</span>
										<span class="detail-value">{account.routingNumber || '----'}</span>
									</div>
									<div class="detail">
										<span class="detail-label">Account</span>
										<span class="detail-value">****{account.accountNumberMask || '----'}</span>
									</div>
									{#if account.bankName}
										<div class="detail">
											<span class="detail-label">Bank</span>
											<span class="detail-value">{account.bankName}</span>
										</div>
									{/if}
								</div>
								{#if account.fdicInsured}
									<div class="fdic-badge-small">
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
										</svg>
										FDIC Insured
									</div>
								{/if}
								<div class="account-actions">
									<Button size="sm" variant="secondary" onclick={() => (showTransfer = true)}>
										Transfer
									</Button>
								</div>
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	{:else if activeTab === 'transfers'}
		<div class="transfers-section">
			<div class="section-header">
				<h2>Transfer History</h2>
				<Button variant="secondary" size="sm" onclick={() => (showTransfer = true)}>
					New Transfer
				</Button>
			</div>
			{#if transfers.length === 0}
				<Card>
					<div class="empty-state">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
							<path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
						</svg>
						<h3>No Transfers Yet</h3>
						<p>Move money between accounts or send to an external bank.</p>
					</div>
				</Card>
			{:else}
				<div class="transfers-list">
					{#each transfers as transfer}
						<Card>
							<div class="transfer-row">
								<div class="transfer-info">
									<div class="transfer-amount">{fmt(transfer.amount)}</div>
									{#if transfer.memo}
										<div class="transfer-memo">{transfer.memo}</div>
									{/if}
									<div class="transfer-date">{fmtDate(transfer.createdAt)}</div>
								</div>
								<div class="transfer-status">
									<span class="status-badge" style={statusBadge(transfer.status)}>
										{transfer.status}
									</span>
									{#if transfer.estimatedArrival}
										<div class="transfer-eta">Est. {fmtDate(transfer.estimatedArrival)}</div>
									{/if}
								</div>
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	{:else if activeTab === 'interest'}
		<div class="interest-section">
			<div class="interest-summary-cards">
				<Card>
					<div class="interest-card">
						<div class="interest-label">Total Earned (All Time)</div>
						<div class="interest-value">{fmt(interest.totalEarned)}</div>
					</div>
				</Card>
				<Card>
					<div class="interest-card">
						<div class="interest-label">This Year</div>
						<div class="interest-value">{fmt(interest.thisYear)}</div>
					</div>
				</Card>
				<Card>
					<div class="interest-card">
						<div class="interest-label">This Month</div>
						<div class="interest-value">{fmt(interest.thisMonth)}</div>
					</div>
				</Card>
			</div>

			{#if interest.byAccount && interest.byAccount.length > 0}
				<h3 class="subsection-title">By Account</h3>
				<div class="interest-by-account">
					{#each interest.byAccount as acct}
						<Card>
							<div class="interest-account-row">
								<div>
									<span class="account-type-label">{acct.accountType === 'savings' ? 'Savings' : 'Checking'}</span>
									<span class="apy-label">{fmtPct(acct.apy || 0)} APY</span>
								</div>
								<div class="interest-earned">{fmt(acct.totalEarned)}</div>
							</div>
						</Card>
					{/each}
				</div>
			{/if}

			<!-- Current Rates -->
			<h3 class="subsection-title">Current Rates</h3>
			<div class="rates-grid">
				{#each rates as rate}
					<Card>
						<div class="rate-card">
							<div class="rate-provider">{rate.provider === 'default' ? 'Finance Owl' : rate.provider}</div>
							<div class="rate-row">
								<span>Savings APY</span>
								<span class="rate-value">{(rate.savings.apy * 100).toFixed(2)}%</span>
							</div>
							<div class="rate-row">
								<span>Checking APY</span>
								<span class="rate-value">{(rate.checking.apy * 100).toFixed(2)}%</span>
							</div>
							{#if rate.savings.isVariable}
								<div class="rate-note">Variable rate, subject to change</div>
							{/if}
						</div>
					</Card>
				{/each}
			</div>

			{#if interest.payments && interest.payments.length > 0}
				<h3 class="subsection-title">Recent Payments</h3>
				<div class="payments-list">
					{#each interest.payments as payment}
						<div class="payment-row">
							<span class="payment-period">{payment.period}</span>
							<span class="payment-amount">{fmt(payment.amount)}</span>
							<span class="payment-date">{payment.paidAt ? fmtDate(payment.paidAt) : 'Pending'}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Account Opening Wizard Modal -->
<Modal bind:open={showOpenAccount} title="Open Banking Account" onclose={resetWizard}>
	<form method="POST" action="?/openAccount" use:enhance={() => {
		return async ({ update }) => {
			await update();
			resetWizard();
		};
	}}>
		{#if form?.error}
			<div class="form-error">{form.error}</div>
		{/if}

		{#if wizardStep === 1}
			<!-- Step 1: Choose account type -->
			<div class="wizard-step">
				<h3>Choose Account Type</h3>
				<p class="wizard-description">Select the type of account you'd like to open.</p>

				<div class="account-type-options">
					<button
						type="button"
						class="type-option"
						class:selected={accountType === 'savings'}
						onclick={() => (accountType = 'savings')}
					>
						<div class="type-icon savings">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" />
							</svg>
						</div>
						<div class="type-name">High-Yield Savings</div>
						<div class="type-rate">{bestSavingsRate()}% APY</div>
						<div class="type-desc">Earn more on your savings with a competitive rate.</div>
					</button>
					<button
						type="button"
						class="type-option"
						class:selected={accountType === 'checking'}
						onclick={() => (accountType = 'checking')}
					>
						<div class="type-icon checking">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
							</svg>
						</div>
						<div class="type-name">Checking</div>
						<div class="type-rate">{bestCheckingRate()}% APY</div>
						<div class="type-desc">Everyday spending with no monthly fees.</div>
					</button>
				</div>

				<input type="hidden" name="type" value={accountType} />

				<div class="wizard-actions">
					<Button variant="secondary" onclick={resetWizard}>Cancel</Button>
					<Button variant="primary" onclick={() => (wizardStep = 2)}>Continue</Button>
				</div>
			</div>
		{:else if wizardStep === 2}
			<!-- Step 2: Personal information -->
			<div class="wizard-step">
				<h3>Personal Information</h3>
				<p class="wizard-description">We need this to verify your identity (KYC).</p>

				<input type="hidden" name="type" value={accountType} />

				<div class="form-grid">
					<div class="form-field full-width">
						<label for="fullName">Full Legal Name</label>
						<input type="text" id="fullName" name="fullName" required placeholder="John Doe" />
					</div>
					<div class="form-field">
						<label for="email">Email</label>
						<input type="email" id="email" name="email" required placeholder="john@example.com" />
					</div>
					<div class="form-field">
						<label for="phone">Phone (optional)</label>
						<input type="tel" id="phone" name="phone" placeholder="+1 555-123-4567" />
					</div>
					<div class="form-field">
						<label for="dateOfBirth">Date of Birth</label>
						<input type="date" id="dateOfBirth" name="dateOfBirth" required />
					</div>
					<div class="form-field">
						<label for="ssn">SSN (Last 4)</label>
						<input type="password" id="ssn" name="ssn" required maxlength="4" placeholder="1234" />
					</div>
				</div>

				<div class="wizard-actions">
					<Button variant="secondary" onclick={() => (wizardStep = 1)}>Back</Button>
					<Button variant="primary" onclick={() => (wizardStep = 3)}>Continue</Button>
				</div>
			</div>
		{:else if wizardStep === 3}
			<!-- Step 3: Address -->
			<div class="wizard-step">
				<h3>Mailing Address</h3>
				<p class="wizard-description">Your residential address for account verification.</p>

				<input type="hidden" name="type" value={accountType} />

				<div class="form-grid">
					<div class="form-field full-width">
						<label for="street">Street Address</label>
						<input type="text" id="street" name="street" required placeholder="123 Main St" />
					</div>
					<div class="form-field">
						<label for="city">City</label>
						<input type="text" id="city" name="city" required placeholder="New York" />
					</div>
					<div class="form-field">
						<label for="state">State</label>
						<input type="text" id="state" name="state" required maxlength="2" placeholder="NY" />
					</div>
					<div class="form-field">
						<label for="postalCode">Zip Code</label>
						<input type="text" id="postalCode" name="postalCode" required maxlength="10" placeholder="10001" />
					</div>
				</div>

				<div class="disclosure-box">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					<span>{fdic.disclosure}</span>
				</div>

				<div class="wizard-actions">
					<Button variant="secondary" onclick={() => (wizardStep = 2)}>Back</Button>
					<Button variant="primary" type="submit">Open Account</Button>
				</div>
			</div>
		{/if}
	</form>
</Modal>

<!-- Transfer Modal -->
<Modal bind:open={showTransfer} title="Transfer Money" onclose={() => (showTransfer = false)}>
	<form method="POST" action="?/initiateTransfer" use:enhance={() => {
		return async ({ update }) => {
			await update();
			showTransfer = false;
		};
	}}>
		{#if form?.error}
			<div class="form-error">{form.error}</div>
		{/if}

		<div class="form-grid">
			<div class="form-field full-width">
				<label for="transferFrom">From Account</label>
				<select id="transferFrom" name="fromAccountId" required>
					<option value="">Select source account</option>
					{#each accounts.filter((a: any) => a.status === 'active') as acct}
						<option value={acct.id}>
							{acct.type === 'savings' ? 'Savings' : 'Checking'} (****{acct.accountNumberMask}) - {fmt(acct.balance)}
						</option>
					{/each}
				</select>
			</div>

			<div class="form-field full-width">
				<span>Transfer Type</span>
				<div class="radio-group">
					<label class="radio-label">
						<input type="radio" name="transferType" value="internal" bind:group={transferType} />
						Between my accounts
					</label>
					<label class="radio-label">
						<input type="radio" name="transferType" value="external" bind:group={transferType} />
						External bank (ACH)
					</label>
				</div>
			</div>

			{#if transferType === 'internal'}
				<div class="form-field full-width">
					<label for="transferTo">To Account</label>
					<select id="transferTo" name="toAccountId" required>
						<option value="">Select destination account</option>
						{#each accounts.filter((a: any) => a.status === 'active') as acct}
							<option value={acct.id}>
								{acct.type === 'savings' ? 'Savings' : 'Checking'} (****{acct.accountNumberMask})
							</option>
						{/each}
					</select>
				</div>
			{:else}
				<input type="hidden" name="toAccountId" value="external" />
				<div class="form-field">
					<label for="routingNumber">Routing Number</label>
					<input type="text" id="routingNumber" name="routingNumber" required maxlength="9" placeholder="021000021" />
				</div>
				<div class="form-field">
					<label for="accountNumber">Account Number</label>
					<input type="text" id="accountNumber" name="accountNumber" required placeholder="123456789" />
				</div>
			{/if}

			<div class="form-field">
				<label for="transferAmount">Amount ($)</label>
				<input type="number" id="transferAmount" name="amount" required min="0.01" step="0.01" placeholder="100.00" />
			</div>
			<div class="form-field">
				<label for="transferMemo">Memo (optional)</label>
				<input type="text" id="transferMemo" name="memo" placeholder="Rent payment" />
			</div>
		</div>

		<div class="wizard-actions">
			<Button variant="secondary" onclick={() => (showTransfer = false)}>Cancel</Button>
			<Button variant="primary" type="submit">Send Transfer</Button>
		</div>
	</form>
</Modal>

<style>
	.banking-page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.page-header {
		margin-bottom: 0.25rem;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-1);
		margin: 0;
	}

	.subtitle {
		color: var(--text-3);
		margin: 0.25rem 0 0 0;
		font-size: 0.9rem;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	/* FDIC Banner */
	.fdic-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface-2);
		border: 1px solid var(--border-1);
		border-radius: 0.75rem;
		font-size: 0.85rem;
	}

	.fdic-icon {
		color: var(--color-success);
		flex-shrink: 0;
	}

	.fdic-text {
		color: var(--text-2);
		flex: 1;
	}

	.fdic-text strong {
		color: var(--text-1);
	}

	.fdic-link {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
		white-space: nowrap;
	}

	.fdic-link:hover {
		text-decoration: underline;
	}

	/* Summary Grid */
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}

	.summary-card {
		padding: 0.25rem;
	}

	.summary-label {
		font-size: 0.8rem;
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.summary-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-1);
	}

	.summary-value.savings {
		color: var(--color-success);
	}

	.summary-value.interest {
		color: var(--color-primary);
	}

	.summary-meta {
		font-size: 0.8rem;
		color: var(--text-3);
		margin-top: 0.25rem;
	}

	.summary-meta.apy-highlight {
		color: var(--color-success);
		font-weight: 600;
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border-1);
	}

	.tab {
		padding: 0.75rem 1.25rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-3);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--text-1);
	}

	.tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	/* Accounts */
	.accounts-list {
		display: grid;
		gap: 1rem;
	}

	.account-card {
		padding: 0.25rem;
	}

	.account-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.account-type-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.account-type-badge.savings {
		color: var(--color-success);
	}

	.account-type-badge.checking {
		color: var(--color-primary);
	}

	.status-badge {
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.account-balance {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 1rem;
	}

	.account-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.75rem;
		padding: 0.75rem 0;
		border-top: 1px solid var(--border-1);
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.detail-label {
		font-size: 0.75rem;
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-value {
		font-size: 0.9rem;
		color: var(--text-1);
		font-weight: 500;
	}

	.detail-value.apy {
		color: var(--color-success);
		font-weight: 700;
	}

	.fdic-badge-small {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.75rem;
		padding: 0.2rem 0.5rem;
		background: var(--color-success-muted, rgba(34, 197, 94, 0.1));
		color: var(--color-success);
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.account-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-1);
	}

	/* Transfers */
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header h2 {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-1);
		margin: 0;
	}

	.transfers-list {
		display: grid;
		gap: 0.5rem;
	}

	.transfer-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.25rem;
	}

	.transfer-amount {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-1);
	}

	.transfer-memo {
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.transfer-date {
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.transfer-status {
		text-align: right;
	}

	.transfer-eta {
		font-size: 0.75rem;
		color: var(--text-3);
		margin-top: 0.25rem;
	}

	/* Interest */
	.interest-summary-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
	}

	.interest-card {
		padding: 0.25rem;
		text-align: center;
	}

	.interest-label {
		font-size: 0.8rem;
		color: var(--text-3);
		margin-bottom: 0.5rem;
	}

	.interest-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.subsection-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-1);
		margin: 1.25rem 0 0.75rem 0;
	}

	.interest-by-account {
		display: grid;
		gap: 0.5rem;
	}

	.interest-account-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem;
	}

	.account-type-label {
		font-weight: 600;
		color: var(--text-1);
		margin-right: 0.75rem;
	}

	.apy-label {
		font-size: 0.8rem;
		color: var(--color-success);
		font-weight: 500;
	}

	.interest-earned {
		font-weight: 700;
		color: var(--color-primary);
	}

	/* Rates */
	.rates-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}

	.rate-card {
		padding: 0.25rem;
	}

	.rate-provider {
		font-weight: 600;
		color: var(--text-1);
		text-transform: capitalize;
		margin-bottom: 0.75rem;
	}

	.rate-row {
		display: flex;
		justify-content: space-between;
		padding: 0.35rem 0;
		font-size: 0.9rem;
		color: var(--text-2);
	}

	.rate-value {
		font-weight: 700;
		color: var(--color-success);
	}

	.rate-note {
		font-size: 0.75rem;
		color: var(--text-3);
		margin-top: 0.5rem;
		font-style: italic;
	}

	/* Payments list */
	.payments-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.payment-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem 0.75rem;
		background: var(--surface-2);
		border-radius: 0.5rem;
		font-size: 0.85rem;
	}

	.payment-period {
		font-weight: 500;
		color: var(--text-1);
		min-width: 80px;
	}

	.payment-amount {
		font-weight: 700;
		color: var(--color-primary);
		flex: 1;
	}

	.payment-date {
		color: var(--text-3);
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 1rem;
		text-align: center;
	}

	.empty-state h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-1);
	}

	.empty-state p {
		margin: 0;
		color: var(--text-3);
		font-size: 0.9rem;
		max-width: 360px;
	}

	/* Form / Wizard */
	.wizard-step {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.wizard-step h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-1);
	}

	.wizard-description {
		color: var(--text-3);
		font-size: 0.9rem;
		margin: 0;
	}

	.account-type-options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.type-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.25rem;
		background: var(--surface-2);
		border: 2px solid var(--border-1);
		border-radius: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: center;
	}

	.type-option:hover {
		border-color: var(--color-primary);
	}

	.type-option.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-muted, rgba(99, 102, 241, 0.08));
	}

	.type-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.type-icon.savings {
		background: var(--color-success-muted, rgba(34, 197, 94, 0.1));
		color: var(--color-success);
	}

	.type-icon.checking {
		background: var(--color-primary-muted, rgba(99, 102, 241, 0.08));
		color: var(--color-primary);
	}

	.type-name {
		font-weight: 600;
		color: var(--text-1);
	}

	.type-rate {
		font-weight: 700;
		color: var(--color-success);
		font-size: 1.1rem;
	}

	.type-desc {
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-field.full-width {
		grid-column: 1 / -1;
	}

	.form-field label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-2);
	}

	.form-field input,
	.form-field select {
		padding: 0.6rem 0.75rem;
		background: var(--surface-2);
		border: 1px solid var(--border-1);
		border-radius: 0.5rem;
		color: var(--text-1);
		font-size: 0.9rem;
	}

	.form-field input:focus,
	.form-field select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-muted, rgba(99, 102, 241, 0.2));
	}

	.radio-group {
		display: flex;
		gap: 1.5rem;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
		color: var(--text-2);
		cursor: pointer;
	}

	.disclosure-box {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--surface-2);
		border: 1px solid var(--border-1);
		border-radius: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-3);
		line-height: 1.4;
	}

	.disclosure-box svg {
		flex-shrink: 0;
		color: var(--color-success);
		margin-top: 0.1rem;
	}

	.wizard-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-1);
	}

	.form-error {
		padding: 0.6rem 0.75rem;
		background: var(--color-error-muted, rgba(239, 68, 68, 0.1));
		color: var(--color-error);
		border-radius: 0.5rem;
		font-size: 0.85rem;
		font-weight: 500;
	}

	@media (max-width: 640px) {
		.banking-page {
			padding: 1rem;
		}

		.summary-grid {
			grid-template-columns: 1fr 1fr;
		}

		.account-type-options {
			grid-template-columns: 1fr;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.form-field.full-width {
			grid-column: 1;
		}

		.fdic-banner {
			flex-wrap: wrap;
		}
	}
</style>
