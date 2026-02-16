<script lang="ts">
	import { Card, Button, Modal, Input } from '$components/ui';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Modal states
	let showAddScore = $state(false);
	let showSimulator = $state(false);
	let showDispute = $state(false);
	let selectedScenario = $state<string | null>(null);
	let simulationResult = $state<any>(null);
	let simulatingLoading = $state(false);
	let disputeLoading = $state(false);

	// Form states for Add Score
	let newScore = $state(700);
	let newSource = $state('manual');
	let newScoreType = $state('vantage3');

	// Form states for simulator params
	let simCurrentUtil = $state(30);
	let simTargetUtil = $state(10);

	// Score color helper
	function getScoreColor(score: number): string {
		if (score >= 800) return '#15803d'; // dark green
		if (score >= 740) return '#22c55e'; // green
		if (score >= 670) return '#eab308'; // yellow
		if (score >= 580) return '#f97316'; // orange
		return '#ef4444'; // red
	}

	function getScoreLabel(score: number): string {
		if (score >= 800) return 'Excellent';
		if (score >= 740) return 'Very Good';
		if (score >= 670) return 'Good';
		if (score >= 580) return 'Fair';
		return 'Poor';
	}

	// SVG gauge helpers
	function getGaugeArc(score: number): string {
		const min = 300;
		const max = 850;
		const pct = (score - min) / (max - min);
		const angle = pct * 180;
		const rad = (angle * Math.PI) / 180;
		const r = 90;
		const cx = 100;
		const cy = 100;
		const x = cx + r * Math.cos(Math.PI - rad);
		const y = cy - r * Math.sin(Math.PI - rad);
		const largeArc = angle > 180 ? 1 : 0;
		return `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`;
	}

	function getGaugeNeedleAngle(score: number): number {
		const min = 300;
		const max = 850;
		const pct = (score - min) / (max - min);
		return -90 + pct * 180;
	}

	// Factor display helpers
	function getFactorLabel(factor: string): string {
		const labels: Record<string, string> = {
			payment_history: 'Payment History',
			credit_utilization: 'Credit Utilization',
			credit_age: 'Credit Age',
			total_accounts: 'Total Accounts',
			hard_inquiries: 'Hard Inquiries',
			derogatory_marks: 'Derogatory Marks'
		};
		return labels[factor] || factor;
	}

	function getFactorIcon(factor: string): string {
		const icons: Record<string, string> = {
			payment_history: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
			credit_utilization: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
			credit_age: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
			total_accounts: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
			hard_inquiries: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
			derogatory_marks: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
		};
		return icons[factor] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
	}

	function getFactorWeight(factor: string): string {
		const weights: Record<string, string> = {
			payment_history: '40%',
			credit_utilization: '20%',
			credit_age: '21%',
			total_accounts: '11%',
			hard_inquiries: '5%',
			derogatory_marks: '3%'
		};
		return weights[factor] || '';
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'good':
				return 'text-green-400 bg-green-400/10 border-green-400/30';
			case 'fair':
				return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
			case 'poor':
				return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
			case 'needs_work':
				return 'text-red-400 bg-red-400/10 border-red-400/30';
			default:
				return 'text-surface-400 bg-surface-400/10 border-surface-400/30';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'good':
				return 'Good';
			case 'fair':
				return 'Fair';
			case 'poor':
				return 'Poor';
			case 'needs_work':
				return 'Needs Work';
			default:
				return status;
		}
	}

	function getImpactLabel(impact: string): string {
		switch (impact) {
			case 'high':
				return 'High Impact';
			case 'medium':
				return 'Medium Impact';
			case 'low':
				return 'Low Impact';
			default:
				return impact;
		}
	}

	// Scenario info
	const scenarios = [
		{
			id: 'open_credit_card',
			label: 'Open a Credit Card',
			description: 'See how opening a new credit card could affect your score.',
			icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'
		},
		{
			id: 'pay_down_debt',
			label: 'Pay Down Debt',
			description: 'Estimate the score boost from reducing your balances.',
			icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
			hasParams: true
		},
		{
			id: 'close_account',
			label: 'Close an Account',
			description: 'Understand the impact of closing a credit account.',
			icon: 'M6 18L18 6M6 6l12 12'
		},
		{
			id: 'late_payment',
			label: 'Late Payment',
			description: 'See the impact of a 30+ day late payment.',
			icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
		},
		{
			id: 'increase_credit_limit',
			label: 'Increase Credit Limit',
			description: 'See how a higher credit limit could help your utilization.',
			icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
			hasParams: true
		},
		{
			id: 'apply_for_mortgage',
			label: 'Apply for Mortgage',
			description: 'Understand the hard inquiry impact of mortgage shopping.',
			icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
		}
	];

	function openSimulator(scenarioId: string) {
		selectedScenario = scenarioId;
		simulationResult = null;
		showSimulator = true;
	}

	function closeSimulator() {
		showSimulator = false;
		selectedScenario = null;
		simulationResult = null;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatAlertDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Chart data
	const historyLabels = $derived(
		(data.history || []).map((h: any) => {
			const d = new Date(h.reportDate + 'T00:00:00');
			return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
		})
	);
	const historyData = $derived((data.history || []).map((h: any) => h.score));

	// Handle form result for simulation
	$effect(() => {
		if (form && 'simulation' in form && form.simulation) {
			simulationResult = form.simulation;
		}
	});

	// Reactively update score when form succeeds
	$effect(() => {
		if (form && 'success' in form && form.success) {
			showAddScore = false;
		}
	});

	// Reactively close dispute modal when filed
	$effect(() => {
		if (form && 'disputeFiled' in form && form.disputeFiled) {
			showDispute = false;
		}
	});

	// Dispute reason labels
	function getDisputeReasonLabel(reason: string): string {
		const labels: Record<string, string> = {
			not_mine: 'Not My Account',
			incorrect_balance: 'Incorrect Balance',
			incorrect_status: 'Incorrect Status',
			incorrect_date: 'Incorrect Date',
			other: 'Other'
		};
		return labels[reason] || reason;
	}

	function getDisputeStatusColor(status: string): string {
		switch (status) {
			case 'submitted':
				return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
			case 'under_review':
				return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
			case 'resolved':
				return 'text-green-400 bg-green-400/10 border-green-400/30';
			case 'rejected':
				return 'text-red-400 bg-red-400/10 border-red-400/30';
			default:
				return 'text-surface-400 bg-surface-400/10 border-surface-400/30';
		}
	}
</script>

<svelte:head>
	<title>Credit Score - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Credit Score</h2>
			<p class="mt-1 text-sm text-surface-400">
				Track your credit score, understand key factors, and simulate scenarios
			</p>
		</div>
		<Button onclick={() => (showAddScore = true)} size="sm">
			<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
			Add Score
		</Button>
	</div>

	<!-- Error -->
	{#if form && 'error' in form && form.error}
		<div class="flex items-center gap-3 rounded-lg bg-red-900/50 p-4 text-sm text-red-300">
			<svg class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{form.error}
		</div>
	{/if}

	<!-- Info banner -->
	<div class="rounded-lg border border-primary-500/20 bg-primary-500/5 px-4 py-3">
		<div class="flex items-start gap-3">
			<svg
				class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<div>
				<p class="text-sm font-medium text-primary-300">
					Connect your credit bureau for automatic updates
				</p>
				<p class="mt-0.5 text-xs text-primary-400/70">
					Credit bureau integration is coming soon. For now, you can manually enter your
					score from your bank or credit card provider and use the simulator to explore
					what-if scenarios.
				</p>
			</div>
		</div>
	</div>

	{#if data.score}
		<!-- Score display and history row -->
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Score gauge -->
			<Card>
				<div class="flex flex-col items-center py-4">
					<h3 class="mb-4 text-lg font-semibold text-white">Current Score</h3>

					<!-- Gauge visualization -->
					<div class="relative">
						<svg width="200" height="120" viewBox="0 0 200 120">
							<!-- Background arc -->
							<path
								d="M 10 100 A 90 90 0 0 1 190 100"
								fill="none"
								stroke="#334155"
								stroke-width="12"
								stroke-linecap="round"
							/>
							<!-- Score arc -->
							<path
								d={getGaugeArc(data.score.score)}
								fill="none"
								stroke={getScoreColor(data.score.score)}
								stroke-width="12"
								stroke-linecap="round"
							/>
							<!-- Needle -->
							<g transform="translate(100, 100) rotate({getGaugeNeedleAngle(data.score.score)})">
								<line
									x1="0"
									y1="0"
									x2="0"
									y2="-75"
									stroke="white"
									stroke-width="2"
									stroke-linecap="round"
								/>
								<circle cx="0" cy="0" r="4" fill="white" />
							</g>
							<!-- Min/Max labels -->
							<text x="10" y="115" fill="#64748b" font-size="11" text-anchor="start"
								>300</text
							>
							<text x="190" y="115" fill="#64748b" font-size="11" text-anchor="end"
								>850</text
							>
						</svg>
					</div>

					<p
						class="mt-2 text-4xl font-bold"
						style="color: {getScoreColor(data.score.score)}"
					>
						{data.score.score}
					</p>
					<p class="mt-1 text-sm font-medium" style="color: {getScoreColor(data.score.score)}">
						{getScoreLabel(data.score.score)}
					</p>

					<div class="mt-3 flex items-center gap-4 text-xs text-surface-400">
						<span>Source: {data.score.source}</span>
						<span>Type: {data.score.scoreType.toUpperCase()}</span>
						<span>Updated: {formatDate(data.score.reportDate)}</span>
					</div>
				</div>
			</Card>

			<!-- Score history chart -->
			<Card>
				<h3 class="text-lg font-semibold text-white">Score History</h3>
				{#if data.history && data.history.length > 1}
					<div class="mt-4">
						{#await import('$lib/components/charts/LineChart.svelte') then { default: LineChart }}
							<LineChart
								labels={historyLabels}
								datasets={[
									{
										label: 'Credit Score',
										data: historyData,
										borderColor: getScoreColor(data.score.score),
										fill: true
									}
								]}
								height={200}
								currency={false}
							/>
						{/await}
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<svg
							class="h-12 w-12 text-surface-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
							/>
						</svg>
						<p class="mt-3 text-sm text-surface-400">
							Add more scores to see your history chart
						</p>
					</div>
				{/if}
			</Card>
		</div>

		<!-- Credit factors -->
		<div>
			<h3 class="mb-4 text-lg font-semibold text-white">Credit Factors</h3>
			{#if data.score.factors && data.score.factors.length > 0}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.score.factors as factor}
						<Card>
							<div class="flex items-start gap-3">
								<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-700">
									<svg
										class="h-5 w-5 text-surface-300"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="1.5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d={getFactorIcon(factor.factor)}
										/>
									</svg>
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center justify-between">
										<p class="text-sm font-medium text-white">
											{getFactorLabel(factor.factor)}
										</p>
										<span
											class="rounded-full border px-2 py-0.5 text-xs font-medium {getStatusColor(
												factor.status
											)}"
										>
											{getStatusLabel(factor.status)}
										</span>
									</div>
									<p class="mt-1 text-sm text-surface-300">{factor.value}</p>
									<div class="mt-2 flex items-center gap-2">
										<span class="text-xs text-surface-500">
											{getImpactLabel(factor.impact)}
										</span>
										<span class="text-xs text-surface-600">|</span>
										<span class="text-xs text-surface-500">
											Weight: {getFactorWeight(factor.factor)}
										</span>
									</div>
								</div>
							</div>
						</Card>
					{/each}
				</div>
			{:else}
				<Card>
					<p class="py-4 text-center text-sm text-surface-400">
						No factor data available. Add a score with factor details to see the
						breakdown.
					</p>
				</Card>
			{/if}
		</div>
	{:else}
		<!-- Empty state -->
		<Card>
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600/15">
					<svg
						class="h-8 w-8 text-primary-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
						/>
					</svg>
				</div>
				<p class="mt-4 text-lg font-semibold text-white">No credit score on file</p>
				<p class="mt-1 text-sm text-surface-500">
					Add your credit score to start tracking changes and run what-if simulations.
				</p>
				<div class="mt-5">
					<Button onclick={() => (showAddScore = true)}>Add Your First Score</Button>
				</div>
			</div>
		</Card>
	{/if}

	<!-- Credit Report Summary -->
	{#if data.report}
		<div>
			<h3 class="mb-4 text-lg font-semibold text-white">Credit Report Summary</h3>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<div class="text-center">
						<p class="text-xs text-surface-400">Total Accounts</p>
						<p class="mt-1 text-2xl font-bold text-white">{data.report.summary?.totalAccounts ?? 0}</p>
						<p class="mt-0.5 text-xs text-surface-500">
							{data.report.summary?.openAccounts ?? 0} open / {data.report.summary?.closedAccounts ?? 0} closed
						</p>
					</div>
				</Card>
				<Card>
					<div class="text-center">
						<p class="text-xs text-surface-400">Credit Utilization</p>
						<p class="mt-1 text-2xl font-bold {(data.report.summary?.utilization ?? 0) <= 30 ? 'text-green-400' : (data.report.summary?.utilization ?? 0) <= 50 ? 'text-yellow-400' : 'text-red-400'}">
							{data.report.summary?.utilization ?? 0}%
						</p>
						<p class="mt-0.5 text-xs text-surface-500">of total credit limit</p>
					</div>
				</Card>
				<Card>
					<div class="text-center">
						<p class="text-xs text-surface-400">Hard Inquiries (12mo)</p>
						<p class="mt-1 text-2xl font-bold text-white">{data.report.summary?.hardInquiriesLast12Months ?? 0}</p>
						<p class="mt-0.5 text-xs text-surface-500">recent inquiries</p>
					</div>
				</Card>
				<Card>
					<div class="text-center">
						<p class="text-xs text-surface-400">Oldest Account</p>
						<p class="mt-1 text-2xl font-bold text-white">{data.report.summary?.oldestAccountAge ?? 'N/A'}</p>
						<p class="mt-0.5 text-xs text-surface-500">account age</p>
					</div>
				</Card>
			</div>

			{#if data.report.accounts && data.report.accounts.length > 0}
				<div class="mt-4">
					<Card padding="none">
						<div class="divide-y divide-surface-700">
							{#each data.report.accounts.slice(0, 5) as account}
								<div class="flex items-center justify-between px-6 py-3">
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-white">{account.accountName}</p>
										<p class="text-xs text-surface-400">
											{account.accountType.replace('_', ' ')} &middot; Opened {account.openedDate}
										</p>
									</div>
									<div class="text-right">
										<p class="text-sm font-medium text-white">
											${(account.balance || 0).toLocaleString()}
										</p>
										{#if account.creditLimit}
											<p class="text-xs text-surface-500">
												/ ${account.creditLimit.toLocaleString()} limit
											</p>
										{/if}
									</div>
									<span class="ml-3 rounded-full border px-2 py-0.5 text-xs font-medium
										{account.status === 'open' ? 'text-green-400 bg-green-400/10 border-green-400/30' :
										 account.status === 'closed' ? 'text-surface-400 bg-surface-400/10 border-surface-400/30' :
										 'text-red-400 bg-red-400/10 border-red-400/30'}">
										{account.status}
									</span>
								</div>
							{/each}
						</div>
					</Card>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Disputes Section -->
	<div>
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h3 class="text-lg font-semibold text-white">Disputes</h3>
				<p class="mt-0.5 text-sm text-surface-400">File and track credit report disputes</p>
			</div>
			<Button onclick={() => (showDispute = true)} size="sm" variant="secondary">
				<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				File Dispute
			</Button>
		</div>

		{#if data.disputes && data.disputes.length > 0}
			<Card padding="none">
				<div class="divide-y divide-surface-700">
					{#each data.disputes as dispute}
						<div class="flex items-start gap-3 px-6 py-4">
							<div class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-700">
								<svg class="h-4 w-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm text-white">{dispute.description}</p>
								<p class="mt-1 text-xs text-surface-500">
									{formatAlertDate(dispute.createdAt)}
								</p>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{:else}
			<Card>
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<svg class="h-10 w-10 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="mt-3 text-sm text-surface-400">No disputes filed</p>
					<p class="mt-1 text-xs text-surface-500">
						If you find inaccurate information on your credit report, file a dispute to get it corrected.
					</p>
				</div>
			</Card>
		{/if}
	</div>

	<!-- Score Simulator -->
	<div>
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-white">Score Simulator</h3>
			<p class="mt-1 text-sm text-surface-400">
				Explore how different financial actions could affect your credit score.
			</p>
		</div>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each scenarios as scenario}
				<button
					class="rounded-xl border border-surface-700 bg-surface-800 p-5 text-left transition hover:border-primary-500/40 hover:bg-surface-700/80"
					onclick={() => openSimulator(scenario.id)}
				>
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-600/20"
						>
							<svg
								class="h-5 w-5 text-primary-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d={scenario.icon}
								/>
							</svg>
						</div>
						<div>
							<p class="text-sm font-medium text-white">{scenario.label}</p>
							<p class="mt-1 text-xs text-surface-400">{scenario.description}</p>
						</div>
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Credit alerts -->
	{#if data.alerts && data.alerts.length > 0}
		<div>
			<h3 class="mb-4 text-lg font-semibold text-white">Credit Alerts</h3>
			<Card padding="none">
				<div class="divide-y divide-surface-700">
					{#each data.alerts as alert}
						<div class="flex items-start gap-3 px-6 py-4">
							<div
								class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full
								{alert.alertType === 'score_change'
									? 'bg-blue-500/20'
									: alert.alertType === 'hard_inquiry'
										? 'bg-yellow-500/20'
										: alert.alertType === 'derogatory_mark'
											? 'bg-red-500/20'
											: alert.alertType === 'monitoring_enrolled'
												? 'bg-green-500/20'
												: 'bg-surface-700'}"
							>
								<svg
									class="h-4 w-4
									{alert.alertType === 'score_change'
										? 'text-blue-400'
										: alert.alertType === 'hard_inquiry'
											? 'text-yellow-400'
											: alert.alertType === 'derogatory_mark'
												? 'text-red-400'
												: alert.alertType === 'monitoring_enrolled'
													? 'text-green-400'
													: 'text-surface-400'}"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									{#if alert.alertType === 'score_change'}
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
										/>
									{:else if alert.alertType === 'monitoring_enrolled'}
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
										/>
									{:else}
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
										/>
									{/if}
								</svg>
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm text-white">{alert.description}</p>
								{#if alert.previousValue && alert.newValue}
									<p class="mt-0.5 text-xs text-surface-400">
										{alert.previousValue} &rarr; {alert.newValue}
									</p>
								{/if}
								<p class="mt-1 text-xs text-surface-500">
									{formatAlertDate(alert.createdAt)}
								</p>
							</div>
							{#if !alert.isRead}
								<form method="POST" action="?/markAlertRead" use:enhance class="flex-shrink-0">
									<input type="hidden" name="alertId" value={alert.id} />
									<button
										type="submit"
										class="group flex items-center gap-1 rounded-full px-2 py-1 text-xs text-primary-400 transition hover:bg-primary-500/10"
										title="Mark as read"
									>
										<span class="h-2 w-2 rounded-full bg-primary-500"></span>
									</button>
								</form>
							{/if}
						</div>
					{/each}
				</div>
			</Card>
		</div>
	{/if}
</div>

<!-- Add Score Modal -->
<Modal open={showAddScore} onclose={() => (showAddScore = false)} title="Add Credit Score">
	<form method="POST" action="?/addScore" use:enhance>
		<div class="space-y-4">
			<Input
				id="score"
				name="score"
				label="Credit Score"
				type="number"
				min={300}
				max={850}
				value={newScore}
				required
			/>

			<div>
				<label for="source" class="block text-sm font-medium text-surface-300">Source</label>
				<select
					id="source"
					name="source"
					bind:value={newSource}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					<option value="manual">Manual Entry</option>
					<option value="transunion">TransUnion</option>
					<option value="equifax">Equifax</option>
					<option value="experian">Experian</option>
				</select>
			</div>

			<div>
				<label for="scoreType" class="block text-sm font-medium text-surface-300"
					>Score Type</label
				>
				<select
					id="scoreType"
					name="scoreType"
					bind:value={newScoreType}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					<option value="vantage3">VantageScore 3.0</option>
					<option value="fico8">FICO 8</option>
					<option value="fico9">FICO 9</option>
				</select>
			</div>

			<!-- Optional factors -->
			<details class="rounded-lg border border-surface-700">
				<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-surface-300">
					Add Credit Factors (optional)
				</summary>
				<div class="space-y-3 border-t border-surface-700 px-4 py-4">
					{#each [
						{ name: 'payment_history', label: 'Payment History', placeholder: 'e.g. 100%' },
						{ name: 'credit_utilization', label: 'Credit Utilization', placeholder: 'e.g. 25%' },
						{ name: 'credit_age', label: 'Credit Age', placeholder: 'e.g. 5 years' },
						{ name: 'total_accounts', label: 'Total Accounts', placeholder: 'e.g. 8' },
						{ name: 'hard_inquiries', label: 'Hard Inquiries', placeholder: 'e.g. 2' },
						{ name: 'derogatory_marks', label: 'Derogatory Marks', placeholder: 'e.g. 0' }
					] as factorField}
						<div class="grid grid-cols-2 gap-2">
							<Input
								id={`factor_${factorField.name}_value`}
								name={`factor_${factorField.name}_value`}
								label={factorField.label}
								placeholder={factorField.placeholder}
							/>
							<div>
								<label
									for={`factor_${factorField.name}_status`}
									class="block text-sm font-medium text-surface-300">Status</label
								>
								<select
									id={`factor_${factorField.name}_status`}
									name={`factor_${factorField.name}_status`}
									class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									<option value="">-- Select --</option>
									<option value="good">Good</option>
									<option value="fair">Fair</option>
									<option value="poor">Poor</option>
									<option value="needs_work">Needs Work</option>
								</select>
							</div>
						</div>
					{/each}
				</div>
			</details>

			{#if form && 'error' in form && form.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="secondary" type="button" onclick={() => (showAddScore = false)}>
					Cancel
				</Button>
				<Button type="submit">Save Score</Button>
			</div>
		</div>
	</form>
</Modal>

<!-- File Dispute Modal -->
<Modal open={showDispute} onclose={() => (showDispute = false)} title="File a Credit Dispute">
	<form
		method="POST"
		action="?/fileDispute"
		use:enhance={() => {
			disputeLoading = true;
			return async ({ result, update }) => {
				disputeLoading = false;
				if (result.type === 'success' && result.data && 'disputeFiled' in result.data) {
					showDispute = false;
				}
				await update();
			};
		}}
	>
		<div class="space-y-4">
			<Input
				id="accountId"
				name="accountId"
				label="Account / Tradeline ID"
				placeholder="Enter the account or tradeline ID to dispute"
				required
			/>

			<div>
				<label for="reason" class="block text-sm font-medium text-surface-300">Reason</label>
				<select
					id="reason"
					name="reason"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					<option value="">-- Select a reason --</option>
					<option value="not_mine">Not My Account</option>
					<option value="incorrect_balance">Incorrect Balance</option>
					<option value="incorrect_status">Incorrect Status</option>
					<option value="incorrect_date">Incorrect Date</option>
					<option value="other">Other</option>
				</select>
			</div>

			<div>
				<label for="explanation" class="block text-sm font-medium text-surface-300">Explanation</label>
				<textarea
					id="explanation"
					name="explanation"
					required
					rows="4"
					placeholder="Describe the inaccuracy in detail..."
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				></textarea>
			</div>

			{#if form && 'error' in form && form.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="secondary" type="button" onclick={() => (showDispute = false)}>
					Cancel
				</Button>
				<Button type="submit" loading={disputeLoading}>Submit Dispute</Button>
			</div>
		</div>
	</form>
</Modal>

<!-- Simulator Modal -->
<Modal
	open={showSimulator}
	onclose={closeSimulator}
	title={selectedScenario
		? scenarios.find((s) => s.id === selectedScenario)?.label || 'Simulate'
		: 'Simulate'}
>
	{#if selectedScenario}
		{@const scenarioInfo = scenarios.find((s) => s.id === selectedScenario)}
		<div class="space-y-4">
			<p class="text-sm text-surface-300">{scenarioInfo?.description}</p>

			{#if !simulationResult}
				<form
					method="POST"
					action="?/simulate"
					use:enhance={() => {
						simulatingLoading = true;
						return async ({ result, update }) => {
							simulatingLoading = false;
							if (result.type === 'success' && result.data && 'simulation' in result.data) {
								simulationResult = result.data.simulation;
							} else {
								await update();
							}
						};
					}}
				>
					<input type="hidden" name="scenario" value={selectedScenario} />

					{#if scenarioInfo?.hasParams && (selectedScenario === 'pay_down_debt' || selectedScenario === 'increase_credit_limit')}
						<div class="space-y-3 rounded-lg border border-surface-700 p-4">
							<div>
								<label
									for="currentUtilization"
									class="block text-sm font-medium text-surface-300"
								>
									Current Utilization (%)
								</label>
								<input
									type="range"
									id="currentUtilization"
									name="currentUtilization"
									min="0"
									max="100"
									bind:value={simCurrentUtil}
									class="mt-2 w-full accent-primary-500"
								/>
								<p class="mt-1 text-right text-sm text-surface-400">
									{simCurrentUtil}%
								</p>
							</div>
							<div>
								<label
									for="targetUtilization"
									class="block text-sm font-medium text-surface-300"
								>
									Target Utilization (%)
								</label>
								<input
									type="range"
									id="targetUtilization"
									name="targetUtilization"
									min="0"
									max="100"
									bind:value={simTargetUtil}
									class="mt-2 w-full accent-primary-500"
								/>
								<p class="mt-1 text-right text-sm text-surface-400">
									{simTargetUtil}%
								</p>
							</div>
						</div>
					{/if}

					<div class="mt-4 flex justify-end gap-3">
						<Button variant="secondary" type="button" onclick={closeSimulator}>
							Cancel
						</Button>
						<Button type="submit" loading={simulatingLoading}>Run Simulation</Button>
					</div>
				</form>
			{:else}
				<!-- Simulation results -->
				<div class="space-y-4">
					<!-- Score before/after -->
					<div class="flex items-center justify-center gap-6 rounded-lg bg-surface-700/50 p-6">
						<div class="text-center">
							<p class="text-xs text-surface-400">Current</p>
							<p
								class="text-3xl font-bold"
								style="color: {getScoreColor(simulationResult.currentScore)}"
							>
								{simulationResult.currentScore}
							</p>
						</div>
						<div class="text-center">
							<svg
								class="h-6 w-6 text-surface-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M14 5l7 7m0 0l-7 7m7-7H3"
								/>
							</svg>
						</div>
						<div class="text-center">
							<p class="text-xs text-surface-400">Estimated</p>
							<p
								class="text-3xl font-bold"
								style="color: {getScoreColor(simulationResult.estimatedNewScore)}"
							>
								{simulationResult.estimatedNewScore}
							</p>
						</div>
					</div>

					<!-- Score change badge -->
					<div class="flex items-center justify-center">
						<span
							class="rounded-full px-4 py-1.5 text-sm font-semibold
							{simulationResult.scoreChange > 0
								? 'bg-green-400/10 text-green-400'
								: simulationResult.scoreChange < 0
									? 'bg-red-400/10 text-red-400'
									: 'bg-surface-700 text-surface-300'}"
						>
							{simulationResult.scoreChange > 0
								? '+'
								: ''}{simulationResult.scoreChange} points
						</span>
					</div>

					<!-- Confidence -->
					<div class="flex items-center justify-center gap-2">
						<span class="text-xs text-surface-500">Confidence:</span>
						<span
							class="rounded-full px-2 py-0.5 text-xs font-medium
							{simulationResult.confidence === 'high'
								? 'bg-green-400/10 text-green-400'
								: simulationResult.confidence === 'medium'
									? 'bg-yellow-400/10 text-yellow-400'
									: 'bg-orange-400/10 text-orange-400'}"
						>
							{simulationResult.confidence.charAt(0).toUpperCase() +
								simulationResult.confidence.slice(1)}
						</span>
					</div>

					<!-- Affected factors -->
					{#if simulationResult.factorsAffected && simulationResult.factorsAffected.length > 0}
						<div class="space-y-2">
							<p class="text-sm font-medium text-surface-300">Factors Affected</p>
							{#each simulationResult.factorsAffected as affected}
								<div
									class="flex items-center justify-between rounded-lg bg-surface-700/50 px-4 py-2.5"
								>
									<span class="text-sm text-white">
										{getFactorLabel(affected.factor)}
									</span>
									<div class="flex items-center gap-2">
										<span
											class="rounded-full border px-2 py-0.5 text-xs {getStatusColor(
												affected.currentStatus
											)}"
										>
											{getStatusLabel(affected.currentStatus)}
										</span>
										<svg
											class="h-3 w-3 text-surface-500"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M14 5l7 7m0 0l-7 7m7-7H3"
											/>
										</svg>
										<span
											class="rounded-full border px-2 py-0.5 text-xs {getStatusColor(
												affected.projectedStatus
											)}"
										>
											{getStatusLabel(affected.projectedStatus)}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Explanation -->
					<div class="rounded-lg border border-surface-700 bg-surface-700/30 p-4">
						<p class="text-sm text-surface-300">{simulationResult.explanation}</p>
					</div>

					<div class="flex justify-end pt-2">
						<Button variant="secondary" onclick={closeSimulator}>Close</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</Modal>
