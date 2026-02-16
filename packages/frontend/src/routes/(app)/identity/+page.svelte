<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Spinner } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let passwordInput = $state('');
	let passwordResult = $state<{ exposed: boolean; exposureCount: number } | null>(null);
	let isHashing = $state(false);
	let isRunningCheck = $state(false);
	let showAcknowledged = $state(false);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			if ((form as any).passwordResult) {
				passwordResult = (form as any).passwordResult;
			}
			isRunningCheck = false;
		}
		if (form?.error) {
			isRunningCheck = false;
		}
	});

	function fmtDate(date: string | null): string {
		if (!date) return '--';
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function timeAgo(date: string | null): string {
		if (!date) return 'Never';
		const d = new Date(date);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));
		if (hours < 1) return 'Just now';
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		return fmtDate(date);
	}

	function severityColor(severity: string): string {
		switch (severity) {
			case 'critical':
				return 'text-red-400';
			case 'high':
				return 'text-orange-400';
			case 'medium':
				return 'text-yellow-400';
			case 'low':
				return 'text-blue-400';
			default:
				return 'text-green-400';
		}
	}

	function severityBg(severity: string): string {
		switch (severity) {
			case 'critical':
				return 'bg-red-500/15 border-red-500/25';
			case 'high':
				return 'bg-orange-500/15 border-orange-500/25';
			case 'medium':
				return 'bg-yellow-500/15 border-yellow-500/25';
			case 'low':
				return 'bg-blue-500/15 border-blue-500/25';
			default:
				return 'bg-green-500/15 border-green-500/25';
		}
	}

	function severityLabel(severity: string): string {
		switch (severity) {
			case 'critical':
				return 'Critical';
			case 'high':
				return 'High Risk';
			case 'medium':
				return 'Medium Risk';
			case 'low':
				return 'Low Risk';
			default:
				return 'No Breaches';
		}
	}

	function severityIcon(severity: string): string {
		switch (severity) {
			case 'critical':
			case 'high':
				return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
			case 'medium':
				return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
			default:
				return 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z';
		}
	}

	function isCriticalDataClass(dc: string): boolean {
		const critical = [
			'Passwords',
			'Credit cards',
			'Bank account numbers',
			'Financial investments',
			'Income levels',
			'Credit status information',
			'Social security numbers'
		];
		return critical.includes(dc);
	}

	async function hashPassword(): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(passwordInput);
		const hashBuffer = await crypto.subtle.digest('SHA-1', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
	}

	let sha1Hidden = $state('');

	const unacknowledgedBreaches = $derived(
		(data.breaches ?? []).filter((b: any) => !b.isAcknowledged)
	);
	const acknowledgedBreaches = $derived(
		(data.breaches ?? []).filter((b: any) => b.isAcknowledged)
	);

	// Password exposure count from breaches
	const passwordExposureCount = $derived(
		(data.summary.dataTypesExposed ?? []).includes('Passwords') ? data.summary.totalBreaches : 0
	);

	// Sort breaches by date for timeline
	const breachTimeline = $derived(
		[...(data.breaches ?? [])].sort(
			(a: any, b: any) =>
				new Date(b.breachDate || 0).getTime() - new Date(a.breachDate || 0).getTime()
		)
	);
</script>

<svelte:head>
	<title>Identity Monitoring - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Identity Monitoring</h2>
			<p class="mt-1 text-sm text-surface-400">
				Monitor your email addresses for data breaches and check password security
			</p>
		</div>
		<form
			method="POST"
			action="?/runCheck"
			use:enhance={() => {
				isRunningCheck = true;
				return async ({ update }) => {
					await update();
				};
			}}
		>
			<Button type="submit" loading={isRunningCheck} disabled={isRunningCheck}>
				<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
				Run Check Now
			</Button>
		</form>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="flex items-center gap-3 rounded-lg bg-red-900/50 p-4 text-sm text-red-300">
			<svg class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{form.error}
		</div>
	{/if}

	<!-- Summary Cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl {data.summary.totalBreaches > 0 ? 'bg-red-500/15' : 'bg-green-500/15'}">
					<svg class="h-5 w-5 {data.summary.totalBreaches > 0 ? 'text-red-400' : 'text-green-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>
				<div>
					<p class="text-xs text-surface-400">Total Breaches</p>
					<p class="text-2xl font-bold {data.summary.totalBreaches > 0 ? 'text-red-400' : 'text-green-400'}">
						{data.summary.totalBreaches}
					</p>
				</div>
			</div>
		</Card>

		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-700">
					<svg class="h-5 w-5 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
					</svg>
				</div>
				<div>
					<p class="text-xs text-surface-400">Monitored Emails</p>
					<p class="text-2xl font-bold text-white">{data.monitoredEmails.length}</p>
				</div>
			</div>
		</Card>

		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl {passwordExposureCount > 0 ? 'bg-orange-500/15' : 'bg-green-500/15'}">
					<svg class="h-5 w-5 {passwordExposureCount > 0 ? 'text-orange-400' : 'text-green-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
					</svg>
				</div>
				<div>
					<p class="text-xs text-surface-400">Password Exposures</p>
					<p class="text-2xl font-bold {passwordExposureCount > 0 ? 'text-orange-400' : 'text-green-400'}">
						{passwordExposureCount}
					</p>
				</div>
			</div>
		</Card>

		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl {severityBg(data.summary.severity)}">
					<svg class="h-5 w-5 {severityColor(data.summary.severity)}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d={severityIcon(data.summary.severity)} />
					</svg>
				</div>
				<div>
					<p class="text-xs text-surface-400">Severity</p>
					<p class="text-lg font-bold {severityColor(data.summary.severity)}">
						{severityLabel(data.summary.severity)}
					</p>
				</div>
			</div>
		</Card>
	</div>

	<!-- Data Types Exposed -->
	{#if data.summary.dataTypesExposed.length > 0}
		<Card>
			<h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-400">
				Exposed Data Types
			</h3>
			<div class="flex flex-wrap gap-2">
				{#each data.summary.dataTypesExposed as dataType}
					<span
						class="rounded-lg border px-2.5 py-1 text-xs font-medium
						{isCriticalDataClass(dataType) ? 'bg-red-900/30 text-red-300 border-red-700/30' : 'bg-surface-700 text-surface-300 border-surface-600'}"
					>
						{#if isCriticalDataClass(dataType)}
							<svg class="mr-1 inline h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						{/if}
						{dataType}
					</span>
				{/each}
			</div>
		</Card>
	{/if}

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Left column: Breaches + Email Monitoring -->
		<div class="lg:col-span-2 space-y-6">
			<!-- Unacknowledged Breaches -->
			{#if unacknowledgedBreaches.length > 0}
				<div>
					<h3 class="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
						Unacknowledged Breaches
						<span class="rounded-full bg-red-900/50 px-2.5 py-0.5 text-sm font-medium text-red-300">
							{unacknowledgedBreaches.length}
						</span>
					</h3>
					<div class="space-y-3">
						{#each unacknowledgedBreaches as breach}
							{@const dataClasses = Array.isArray(breach.dataClasses) ? breach.dataClasses : []}
							{@const hasCritical = dataClasses.some((dc: string) => isCriticalDataClass(dc))}
							<Card>
								<div class="flex items-start justify-between gap-4">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="h-2.5 w-2.5 rounded-full {hasCritical ? 'bg-red-400' : 'bg-orange-400'}"></span>
											<p class="font-semibold text-white">{breach.breachName}</p>
											{#if hasCritical}
												<span class="rounded-lg border border-red-500/25 bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-300">
													CRITICAL
												</span>
											{/if}
										</div>

										<div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-400">
											<span>Breach date: {fmtDate(breach.breachDate)}</span>
											{#if breach.email}
												<span>Email: {breach.email}</span>
											{/if}
										</div>

										{#if breach.breachDescription}
											<p class="mt-2 text-sm leading-relaxed text-surface-300">
												{@html breach.breachDescription}
											</p>
										{/if}

										{#if dataClasses.length > 0}
											<div class="mt-3 flex flex-wrap gap-1.5">
												{#each dataClasses as dc}
													<span
														class="rounded-lg border px-2 py-0.5 text-xs
														{isCriticalDataClass(dc) ? 'bg-red-900/30 text-red-300 border-red-700/30' : 'bg-surface-700 text-surface-400 border-surface-600'}"
													>
														{dc}
													</span>
												{/each}
											</div>
										{/if}
									</div>

									<form method="POST" action="?/acknowledge" use:enhance>
										<input type="hidden" name="id" value={breach.id} />
										<Button variant="secondary" size="sm" type="submit">Acknowledge</Button>
									</form>
								</div>
							</Card>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Acknowledged Breaches -->
			{#if acknowledgedBreaches.length > 0}
				<div>
					<button
						class="mb-3 flex w-full items-center justify-between text-left"
						onclick={() => (showAcknowledged = !showAcknowledged)}
					>
						<h3 class="flex items-center gap-2 text-lg font-semibold text-surface-400">
							Acknowledged Breaches
							<span class="text-sm font-normal text-surface-500">({acknowledgedBreaches.length})</span>
						</h3>
						<svg
							class="h-5 w-5 text-surface-500 transition {showAcknowledged ? 'rotate-180' : ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{#if showAcknowledged}
						<div class="space-y-2">
							{#each acknowledgedBreaches as breach}
								{@const dataClasses = Array.isArray(breach.dataClasses) ? breach.dataClasses : []}
								<Card>
									<div class="flex items-start justify-between gap-4">
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span class="h-2 w-2 rounded-full bg-surface-500"></span>
												<p class="font-medium text-surface-300">{breach.breachName}</p>
											</div>
											<div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-500">
												<span>Breach date: {fmtDate(breach.breachDate)}</span>
												{#if breach.email}
													<span>Email: {breach.email}</span>
												{/if}
											</div>
											{#if dataClasses.length > 0}
												<div class="mt-2 flex flex-wrap gap-1.5">
													{#each dataClasses as dc}
														<span class="rounded bg-surface-700/50 px-2 py-0.5 text-xs text-surface-500">
															{dc}
														</span>
													{/each}
												</div>
											{/if}
										</div>
										<span class="flex-shrink-0 rounded-full bg-surface-700 px-2.5 py-1 text-xs text-surface-400">
											Acknowledged
										</span>
									</div>
								</Card>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Breach Timeline -->
			{#if breachTimeline.length > 0}
				<div>
					<h3 class="mb-4 text-lg font-semibold text-white">Breach Timeline</h3>
					<Card padding="none">
						<div class="relative">
							{#each breachTimeline as breach, i}
								{@const dataClasses = Array.isArray(breach.dataClasses) ? breach.dataClasses : []}
								{@const hasCritical = dataClasses.some((dc: string) => isCriticalDataClass(dc))}
								<div class="relative flex gap-4 px-6 py-4 {i < breachTimeline.length - 1 ? 'border-b border-surface-700' : ''}">
									<!-- Timeline dot and line -->
									<div class="flex flex-col items-center">
										<div class="flex h-8 w-8 items-center justify-center rounded-full {breach.isAcknowledged ? 'bg-surface-700' : hasCritical ? 'bg-red-500/20' : 'bg-orange-500/20'}">
											<span class="h-3 w-3 rounded-full {breach.isAcknowledged ? 'bg-surface-500' : hasCritical ? 'bg-red-400' : 'bg-orange-400'}"></span>
										</div>
										{#if i < breachTimeline.length - 1}
											<div class="mt-1 w-0.5 flex-1 bg-surface-700"></div>
										{/if}
									</div>
									<div class="min-w-0 flex-1 pb-1">
										<div class="flex items-center justify-between">
											<p class="font-medium {breach.isAcknowledged ? 'text-surface-400' : 'text-white'}">
												{breach.breachName}
											</p>
											<span class="ml-2 flex-shrink-0 text-xs text-surface-500">
												{fmtDate(breach.breachDate)}
											</span>
										</div>
										{#if breach.email}
											<p class="mt-0.5 text-xs text-surface-500">{breach.email}</p>
										{/if}
										{#if dataClasses.length > 0}
											<p class="mt-1 text-xs text-surface-500">
												{dataClasses.slice(0, 3).join(', ')}{dataClasses.length > 3 ? ` +${dataClasses.length - 3} more` : ''}
											</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</Card>
				</div>
			{/if}
		</div>

		<!-- Right column: Email Monitoring + Password Check -->
		<div class="space-y-6">
			<!-- Email Monitoring Section -->
			<div>
				<h3 class="mb-3 text-lg font-semibold text-white">Monitored Emails</h3>

				<!-- Add Email Form -->
				<Card>
					<form method="POST" action="?/addEmail" use:enhance class="flex gap-2">
						<input
							name="email"
							type="email"
							required
							placeholder="Add email to monitor..."
							class="flex-1 rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
						<Button type="submit" size="sm">Add</Button>
					</form>
				</Card>

				{#if data.monitoredEmails.length > 0}
					<div class="mt-3 space-y-2">
						{#each data.monitoredEmails as monitored}
							<Card padding="sm">
								<div class="flex items-center justify-between gap-2">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<svg class="h-4 w-4 flex-shrink-0 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
											</svg>
											<p class="truncate text-sm font-medium text-white">{monitored.email}</p>
										</div>
										<div class="mt-1 flex items-center gap-3 text-xs text-surface-500">
											<span>{monitored.totalBreaches} breach{monitored.totalBreaches !== 1 ? 'es' : ''}</span>
											<span>Checked {timeAgo(monitored.lastCheckedAt)}</span>
										</div>
									</div>
									<div class="flex items-center gap-1">
										<form method="POST" action="?/checkEmail" use:enhance>
											<input type="hidden" name="email" value={monitored.email} />
											<Button variant="ghost" size="sm" type="submit">Check</Button>
										</form>
										<form method="POST" action="?/removeEmail" use:enhance>
											<input type="hidden" name="id" value={monitored.id} />
											<button
												type="submit"
												class="rounded-lg p-1.5 text-surface-400 transition hover:bg-red-900/30 hover:text-red-400"
												aria-label="Remove monitored email"
											>
												<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										</form>
									</div>
								</div>
							</Card>
						{/each}
					</div>
				{:else}
					<Card class="mt-3">
						<div class="py-4 text-center">
							<svg class="mx-auto h-10 w-10 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
							<p class="mt-3 text-sm text-surface-400">
								No emails being monitored yet.
							</p>
							<p class="mt-1 text-xs text-surface-500">
								Add one above to start checking for data breaches.
							</p>
						</div>
					</Card>
				{/if}
			</div>

			<!-- Password Check Section -->
			<div>
				<h3 class="mb-3 text-lg font-semibold text-white">Password Exposure Check</h3>
				<Card>
					<p class="mb-4 text-sm text-surface-400">
						Check if a password has appeared in known data breaches. Your password is hashed
						locally using SHA-1 before checking (k-anonymity model).
					</p>

					<form
						method="POST"
						action="?/checkPassword"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
							};
						}}
						onsubmit={async (e) => {
							e.preventDefault();
							if (!passwordInput.trim()) return;
							isHashing = true;
							passwordResult = null;
							try {
								sha1Hidden = await hashPassword();
							} finally {
								isHashing = false;
							}
							const formEl = e.target as HTMLFormElement;
							const hiddenInput = formEl.querySelector('input[name="sha1Hash"]') as HTMLInputElement;
							if (hiddenInput) {
								hiddenInput.value = sha1Hidden;
							}
							formEl.requestSubmit();
						}}
					>
						<input type="hidden" name="sha1Hash" value={sha1Hidden} />
						<div class="flex gap-2">
							<input
								type="password"
								bind:value={passwordInput}
								placeholder="Enter password to check..."
								class="flex-1 rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
							<Button type="submit" size="sm" disabled={isHashing || !passwordInput.trim()}>
								{isHashing ? 'Hashing...' : 'Check'}
							</Button>
						</div>
					</form>

					<!-- Password Result -->
					{#if passwordResult || (form as any)?.passwordResult}
						{@const result = passwordResult ?? (form as any)?.passwordResult}
						{#if result.exposed}
							<div class="mt-4 rounded-lg border border-red-700/30 bg-red-900/20 p-4">
								<div class="flex items-center gap-2">
									<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<p class="font-semibold text-red-300">Password Exposed!</p>
								</div>
								<p class="mt-2 text-sm text-red-200/80">
									This password has been found in <strong class="text-red-200">{result.exposureCount.toLocaleString()}</strong> data breach{result.exposureCount === 1 ? '' : 'es'}.
									Change this password immediately wherever it is used.
								</p>
							</div>
						{:else}
							<div class="mt-4 rounded-lg border border-green-700/30 bg-green-900/20 p-4">
								<div class="flex items-center gap-2">
									<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<p class="font-semibold text-green-300">Password Not Found</p>
								</div>
								<p class="mt-2 text-sm text-green-200/80">
									This password has not been found in any known data breaches. That said, always use a strong, unique password for each account.
								</p>
							</div>
						{/if}
					{/if}
				</Card>
			</div>

			<!-- Last Check Info -->
			{#if data.summary.lastCheckDate}
				<Card padding="sm">
					<div class="flex items-center gap-3">
						<svg class="h-5 w-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<p class="text-xs text-surface-400">Last checked</p>
							<p class="text-sm font-medium text-white">{fmtDate(data.summary.lastCheckDate)}</p>
						</div>
					</div>
					{#if data.summary.mostRecent}
						<p class="mt-2 text-xs text-surface-500">
							Most recent breach: <span class="text-surface-400">{data.summary.mostRecent.name}</span>
						</p>
					{/if}
				</Card>
			{/if}
		</div>
	</div>

	<!-- Empty state when no breaches at all -->
	{#if data.breaches.length === 0 && data.monitoredEmails.length === 0}
		<Card>
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-600/15">
					<svg
						class="h-8 w-8 text-green-400"
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
				<p class="mt-4 text-lg font-semibold text-white">Identity Monitoring</p>
				<p class="mt-1 text-sm text-surface-500 max-w-sm">
					Add an email address to start monitoring for data breaches, or check if a password has been exposed.
				</p>
			</div>
		</Card>
	{/if}
</div>
