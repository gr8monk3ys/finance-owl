<script lang="ts">
	import { Card, Button, Spinner } from '$components/ui';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	interface ChatMessage {
		role: 'user' | 'assistant';
		content: string;
		sources?: Array<{ transactionId: string; text: string; distance: number }>;
	}

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let question = $state('');
	let messages = $state<ChatMessage[]>([]);
	let isAsking = $state(false);
	let isDetectingAnomalies = $state(false);
	let anomalies = $state<any[]>([]);
	let activeTab = $state<'chat' | 'insights' | 'anomalies'>('chat');
	let chatContainer: HTMLDivElement | undefined = $state();

	const isAvailable = $derived(data.aiStatus?.available ?? false);

	const suggestedQuestions = [
		'What did I spend on dining this month?',
		'How is my budget looking?',
		'What are my top spending categories?',
		'Show my largest transactions this week',
		'Am I spending more than usual?',
		'How much did I save this month?'
	];

	$effect(() => {
		if (!form) return;

		if ('answer' in form && form.answer) {
			messages.push({
				role: 'assistant',
				content: form.answer,
				sources: form.sources
			});
			scrollToBottom();
		}

		if ('anomaliesDetected' in form && form.anomalies) {
			anomalies = form.anomalies;
			activeTab = 'anomalies';
		}

		isAsking = false;
		isDetectingAnomalies = false;
	});

	function scrollToBottom() {
		requestAnimationFrame(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		});
	}

	function handleAskSubmit() {
		if (!question.trim()) return;

		messages.push({ role: 'user', content: question.trim() });
		isAsking = true;
		scrollToBottom();
	}

	function useSuggestion(q: string) {
		question = q;
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatTimeAgo(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));
		if (hours < 1) return 'Just now';
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days}d ago`;
		return formatDate(dateStr);
	}

	function getInsightTypeColor(type: string): string {
		switch (type) {
			case 'spending_summary':
				return 'bg-blue-500/15 text-blue-400 border-blue-500/25';
			case 'budget_alert':
				return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25';
			case 'anomaly':
				return 'bg-red-500/15 text-red-400 border-red-500/25';
			case 'savings_tip':
				return 'bg-green-500/15 text-green-400 border-green-500/25';
			default:
				return 'bg-primary-500/15 text-primary-400 border-primary-500/25';
		}
	}

	function getInsightTypeLabel(type: string): string {
		switch (type) {
			case 'spending_summary':
				return 'Spending';
			case 'budget_alert':
				return 'Budget';
			case 'anomaly':
				return 'Anomaly';
			case 'savings_tip':
				return 'Savings';
			default:
				return 'Insight';
		}
	}
</script>

<svelte:head>
	<title>Ask Finance Owl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Ask Finance Owl</h2>
			<p class="mt-1 text-sm text-surface-400">
				Get AI-powered insights about your finances
			</p>
		</div>
		<div class="flex items-center gap-3">
			{#if isAvailable}
				<span class="flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1.5 text-sm text-green-400">
					<span class="relative flex h-2 w-2">
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-green-400"></span>
					</span>
					AI Online
				</span>
			{:else}
				<span class="flex items-center gap-2 rounded-full border border-surface-600 bg-surface-700/50 px-3 py-1.5 text-sm text-surface-400">
					<span class="h-2 w-2 rounded-full bg-surface-500"></span>
					AI Offline
				</span>
			{/if}
		</div>
	</div>

	<!-- Tab navigation -->
	<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'chat'
				? 'bg-primary-600 text-white shadow-sm'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'chat')}
		>
			<svg class="mr-1.5 inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
			</svg>
			Chat
		</button>
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'insights'
				? 'bg-primary-600 text-white shadow-sm'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'insights')}
		>
			<svg class="mr-1.5 inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>
			Insights
			{#if data.insights.length > 0}
				<span class="ml-1 rounded-full bg-surface-600 px-1.5 py-0.5 text-xs">
					{data.insights.length}
				</span>
			{/if}
		</button>
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'anomalies'
				? 'bg-primary-600 text-white shadow-sm'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'anomalies')}
		>
			<svg class="mr-1.5 inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			Anomalies
			{#if anomalies.length > 0}
				<span class="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">
					{anomalies.length}
				</span>
			{/if}
		</button>
	</div>

	<!-- Chat tab -->
	{#if activeTab === 'chat'}
		<div class="flex flex-col" style="height: calc(100vh - 18rem);">
			<!-- Messages area -->
			<Card class="flex-1 overflow-hidden" padding="none">
				<div bind:this={chatContainer} class="h-full overflow-y-auto p-4 space-y-4">
					{#if messages.length === 0}
						<div class="flex h-full flex-col items-center justify-center text-center px-4">
							{#if !isAvailable}
								<!-- AI unavailable: prominent, helpful state -->
								<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500/15">
									<svg
										class="h-8 w-8 text-yellow-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="1.5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
								</div>
								<p class="mt-4 text-lg font-semibold text-white">AI Chat Requires Ollama</p>
								<p class="mt-2 text-sm text-surface-400 max-w-md">
									The AI advisor is an optional feature that requires Ollama to be running locally.
								</p>
								<div class="mt-4 w-full max-w-sm rounded-lg border border-surface-700 bg-surface-800/70 p-4 text-left">
									<p class="text-xs font-medium uppercase tracking-wider text-surface-500 mb-2">To enable AI features:</p>
									<code class="block rounded bg-surface-900 px-3 py-2 text-sm text-primary-400 font-mono">docker compose up ollama</code>
									<p class="mt-2 text-xs text-surface-500">
										Other features like budgets, transactions, and anomaly detection work without AI.
									</p>
								</div>
							{:else}
								<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600/20">
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
											d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
										/>
									</svg>
								</div>
								<p class="mt-4 text-lg font-semibold text-white">Ask about your finances</p>
								<p class="mt-1 text-sm text-surface-400 max-w-md">
									Ask questions about your spending, budgets, transactions, or financial trends.
								</p>

								<!-- Suggested questions -->
								<div class="mt-6 w-full max-w-lg">
									<p class="mb-3 text-xs font-medium uppercase tracking-wider text-surface-500">
										Suggested questions
									</p>
									<div class="grid gap-2 sm:grid-cols-2">
										{#each suggestedQuestions as sq}
											<button
												class="rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2.5 text-left text-sm text-surface-300 transition hover:border-primary-500/50 hover:bg-surface-700/50 hover:text-white"
												onclick={() => useSuggestion(sq)}
											>
												{sq}
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{:else}
						{#each messages as message}
							<div
								class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
							>
								{#if message.role === 'assistant'}
									<div class="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-600/20">
										<svg class="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
										</svg>
									</div>
								{/if}
								<div
									class="max-w-[80%] rounded-xl px-4 py-3 {message.role === 'user'
										? 'bg-primary-600 text-white'
										: 'bg-surface-700 text-surface-200'}"
								>
									<p class="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

									{#if message.sources && message.sources.length > 0}
										<div class="mt-3 border-t border-surface-600/50 pt-2">
											<p class="text-xs font-medium text-surface-400">Sources:</p>
											<ul class="mt-1 space-y-1">
												{#each message.sources as source}
													<li class="text-xs text-surface-400">
														<a
															href="/transactions?search={encodeURIComponent(source.text.split(',')[0] || '')}"
															class="hover:text-primary-400 underline decoration-surface-600 hover:decoration-primary-400"
														>
															{source.text}
														</a>
													</li>
												{/each}
											</ul>
										</div>
									{/if}
								</div>
							</div>
						{/each}

						{#if isAsking}
							<div class="flex justify-start">
								<div class="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-600/20">
									<svg class="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
									</svg>
								</div>
								<div class="flex items-center gap-2 rounded-xl bg-surface-700 px-4 py-3">
									<Spinner size="sm" />
									<span class="text-sm text-surface-400">Thinking...</span>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</Card>

			<!-- Error display -->
			{#if form && 'error' in form && form.error}
				<div class="mt-2 flex items-center gap-2 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">
					<svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					{form.error}
				</div>
			{/if}

			<!-- Input area -->
			<form
				method="POST"
				action="?/ask"
				use:enhance={() => {
					handleAskSubmit();
					return async ({ update }) => {
						question = '';
						await update({ reset: false });
					};
				}}
				class="mt-3 flex gap-3"
			>
				<input
					type="text"
					name="question"
					bind:value={question}
					placeholder={isAvailable
						? 'Ask about your spending, budgets, or transactions...'
						: 'AI is offline -- Ollama must be running'}
					disabled={!isAvailable || isAsking}
					class="flex-1 rounded-xl border border-surface-600 bg-surface-700 px-4 py-3 text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
				/>
				<Button type="submit" disabled={!isAvailable || isAsking || !question.trim()} loading={isAsking}>
					<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
					Send
				</Button>
			</form>
		</div>
	{/if}

	<!-- Insights tab -->
	{#if activeTab === 'insights'}
		<div class="space-y-4">
			{#if !isAvailable}
				<div class="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-900/15 px-4 py-3">
					<svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<p class="text-sm font-medium text-yellow-300">AI insights require Ollama</p>
						<p class="mt-0.5 text-xs text-yellow-400/70">
							Run <code class="rounded bg-yellow-900/40 px-1 py-0.5 font-mono">docker compose up ollama</code> to enable AI-generated analysis. Basic weekly summaries are still generated without AI.
						</p>
					</div>
				</div>
			{/if}
			{#if data.insights.length === 0}
				<Card>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-700/50">
							<svg
								class="h-8 w-8 text-surface-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
								/>
							</svg>
						</div>
						<p class="mt-4 text-lg text-surface-300">No insights yet</p>
						<p class="mt-1 text-sm text-surface-500">
							{#if isAvailable}
								Weekly insights are generated automatically every Monday. Check back soon.
							{:else}
								Insights will appear here once generated. Enable Ollama for richer AI-powered analysis, or check back Monday for basic weekly summaries.
							{/if}
						</p>
					</div>
				</Card>
			{:else}
				{#each data.insights as insight}
					<Card>
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<h3 class="text-lg font-semibold text-white">{insight.title}</h3>
									{#if insight.type}
										<span class="rounded-full border px-2 py-0.5 text-xs font-medium {getInsightTypeColor(insight.type)}">
											{getInsightTypeLabel(insight.type)}
										</span>
									{/if}
								</div>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">{insight.body}</p>
							</div>
							<span class="flex-shrink-0 text-xs text-surface-500">
								{formatTimeAgo(insight.createdAt)}
							</span>
						</div>

						{#if insight.data}
							<div class="mt-4 grid grid-cols-3 gap-4 rounded-lg border border-surface-700 bg-surface-900/50 p-4">
								<div>
									<p class="text-xs text-surface-400">This Week</p>
									<p class="mt-0.5 text-sm font-semibold text-white">
										{formatCurrency(insight.data.thisWeekTotal)}
									</p>
								</div>
								<div>
									<p class="text-xs text-surface-400">Last Week</p>
									<p class="mt-0.5 text-sm font-semibold text-white">
										{formatCurrency(insight.data.lastWeekTotal)}
									</p>
								</div>
								<div>
									<p class="text-xs text-surface-400">4-Week Avg</p>
									<p class="mt-0.5 text-sm font-semibold text-white">
										{formatCurrency(insight.data.fourWeekAverage)}
									</p>
								</div>
							</div>

							{#if insight.data.topCategories && insight.data.topCategories.length > 0}
								<div class="mt-3">
									<p class="text-xs font-medium uppercase tracking-wider text-surface-500">Top Categories</p>
									<div class="mt-2 flex flex-wrap gap-2">
										{#each insight.data.topCategories as cat}
											<span class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs text-surface-300">
												{cat.name}: <span class="font-medium text-white">{formatCurrency(cat.total)}</span>
											</span>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					</Card>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Anomalies tab -->
	{#if activeTab === 'anomalies'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<p class="text-sm text-surface-400">
					Transactions that are unusually high or low compared to your typical spending.
				</p>
				<form
					method="POST"
					action="?/detectAnomalies"
					use:enhance={() => {
						isDetectingAnomalies = true;
						return async ({ update }) => {
							await update({ reset: false });
						};
					}}
				>
					<Button
						type="submit"
						variant="secondary"
						size="sm"
						loading={isDetectingAnomalies}
						disabled={isDetectingAnomalies}
					>
						<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						Scan Now
					</Button>
				</form>
			</div>

			{#if anomalies.length === 0}
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
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<p class="mt-4 text-lg text-surface-300">No anomalies detected</p>
						<p class="mt-1 text-sm text-surface-500">
							Click "Scan Now" to check for unusual transactions in the last 7 days.
						</p>
					</div>
				</Card>
			{:else}
				{#each anomalies as anomaly}
					<Card>
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="rounded-lg bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/25">
										{Math.abs(anomaly.zScore).toFixed(1)}x std dev
									</span>
									<h3 class="font-semibold text-white">{anomaly.merchantName}</h3>
								</div>
								<p class="mt-1.5 text-sm text-surface-400">{anomaly.reason}</p>
								<div class="mt-3 flex flex-wrap gap-3 text-xs text-surface-500">
									<span class="flex items-center gap-1">
										<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
										</svg>
										Avg: {formatCurrency(anomaly.mean)}
									</span>
									{#if anomaly.categoryName}
										<span class="flex items-center gap-1">
											<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
											</svg>
											{anomaly.categoryName}
										</span>
									{/if}
								</div>
							</div>
							<div class="text-right flex-shrink-0">
								<p class="text-lg font-bold text-white">
									{formatCurrency(Math.abs(anomaly.amount))}
								</p>
								<p class="mt-0.5 text-xs text-surface-500">{formatDate(anomaly.date)}</p>
							</div>
						</div>
					</Card>
				{/each}
			{/if}
		</div>
	{/if}
</div>
