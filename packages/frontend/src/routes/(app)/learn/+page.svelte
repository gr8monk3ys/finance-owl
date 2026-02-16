<script lang="ts">
	import { Card, Button } from '$components/ui';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let activeDifficulty = $state('');
	let activeTopic = $state('');

	$effect(() => {
		if (data.filters) {
			searchQuery = data.filters.search || '';
			activeDifficulty = data.filters.difficulty || '';
			activeTopic = data.filters.topic || '';
		}
	});

	// Topic icons (SVG paths)
	const topicIcons: Record<string, string> = {
		calculator:
			'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
		'piggy-bank':
			'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
		'trending-down': 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
		shield:
			'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
		'trending-up': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
		'file-text':
			'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
		home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
		umbrella:
			'M12 2v6m0 0c-3.314 0-6 2.015-6 4.5V14h12v-1.5c0-2.485-2.686-4.5-6-4.5zm0 14v2a2 2 0 004 0'
	};

	const difficultyColors: Record<string, string> = {
		beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
		intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
		advanced: 'bg-red-500/20 text-red-400 border-red-500/30'
	};

	function getTopicIcon(icon: string): string {
		return topicIcons[icon] || topicIcons['file-text'];
	}

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (activeDifficulty) params.set('difficulty', activeDifficulty);
		if (activeTopic) params.set('topic', activeTopic);
		goto(`/learn?${params.toString()}`);
	}

	function setDifficulty(diff: string) {
		activeDifficulty = activeDifficulty === diff ? '' : diff;
		handleSearch();
	}

	function setTopic(topic: string) {
		activeTopic = activeTopic === topic ? '' : topic;
		handleSearch();
	}

	function isArticleRead(slug: string): boolean {
		return (
			data.progress?.progress?.some(
				(p: any) => p.articleSlug === slug && p.readAt
			) ?? false
		);
	}

	function isArticleBookmarked(slug: string): boolean {
		return (
			data.progress?.progress?.some(
				(p: any) => p.articleSlug === slug && p.isBookmarked
			) ?? false
		);
	}

	const progressPercent = $derived(
		data.progress?.totalArticles > 0
			? Math.round((data.progress.articlesRead / data.progress.totalArticles) * 100)
			: 0
	);

	const bookmarkedArticles = $derived(
		(data.articles || []).filter((a: any) => isArticleBookmarked(a.slug))
	);
</script>

<svelte:head>
	<title>Learn - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Hero Section -->
	<div class="rounded-xl bg-gradient-to-r from-primary-600/20 to-emerald-600/20 p-6">
		<div class="flex items-start justify-between">
			<div>
				<h2 class="text-2xl font-bold text-white">Financial Education</h2>
				<p class="mt-1 text-sm text-surface-300">
					Build your financial literacy with expert guides and articles.
				</p>
			</div>
			<div class="hidden text-right sm:block">
				<p class="text-3xl font-bold text-primary-400">{data.progress?.articlesRead || 0}</p>
				<p class="text-xs text-surface-400">
					of {data.progress?.totalArticles || 0} articles read
				</p>
			</div>
		</div>
		<!-- Progress bar -->
		<div class="mt-4">
			<div class="flex items-center justify-between text-xs text-surface-400">
				<span>Reading Progress</span>
				<span>{progressPercent}%</span>
			</div>
			<div class="mt-1 h-2 rounded-full bg-surface-700">
				<div
					class="h-2 rounded-full bg-primary-500 transition-all duration-500"
					style="width: {progressPercent}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Personalized Recommendations -->
	{#if data.recommended && data.recommended.length > 0}
		<div>
			<h3 class="mb-3 text-lg font-semibold text-white">Recommended for You</h3>
			<div class="flex gap-4 overflow-x-auto pb-2">
				{#each data.recommended as article}
					<a
						href="/learn/{article.slug}"
						class="min-w-[280px] max-w-[320px] flex-shrink-0 rounded-xl bg-surface-800 p-4 transition hover:bg-surface-700 hover:ring-1 hover:ring-primary-500/50"
					>
						<div class="flex items-center gap-2">
							<span
								class="rounded-full border px-2 py-0.5 text-xs font-medium {difficultyColors[
									article.difficulty
								] || 'bg-surface-700 text-surface-300'}"
							>
								{article.difficulty}
							</span>
							<span class="text-xs text-surface-500">{article.readTimeMinutes} min read</span>
						</div>
						<h4 class="mt-2 line-clamp-2 text-sm font-medium text-white">
							{article.title}
						</h4>
						<p class="mt-1 line-clamp-2 text-xs text-surface-400">{article.summary}</p>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Search and Filters -->
	<div class="space-y-3">
		<form
			onsubmit={(e) => { e.preventDefault(); handleSearch(); }}
			class="flex gap-2"
		>
			<div class="relative flex-1">
				<svg
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<input
					type="text"
					placeholder="Search articles..."
					bind:value={searchQuery}
					class="w-full rounded-lg border border-surface-600 bg-surface-700 py-2 pl-10 pr-4 text-sm text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
			<Button type="submit" size="sm">Search</Button>
		</form>

		<!-- Difficulty filter chips -->
		<div class="flex flex-wrap gap-2">
			{#each ['beginner', 'intermediate', 'advanced'] as diff}
				<button
					class="rounded-full border px-3 py-1 text-xs font-medium transition {activeDifficulty ===
					diff
						? difficultyColors[diff]
						: 'border-surface-600 text-surface-400 hover:border-surface-500 hover:text-surface-300'}"
					onclick={() => setDifficulty(diff)}
				>
					{diff.charAt(0).toUpperCase() + diff.slice(1)}
				</button>
			{/each}
			{#if activeDifficulty || activeTopic || searchQuery}
				<button
					class="rounded-full border border-surface-600 px-3 py-1 text-xs text-surface-400 transition hover:border-red-500/50 hover:text-red-400"
					onclick={() => {
						activeDifficulty = '';
						activeTopic = '';
						searchQuery = '';
						goto('/learn');
					}}
				>
					Clear filters
				</button>
			{/if}
		</div>
	</div>

	<!-- Topic Grid -->
	<div>
		<h3 class="mb-3 text-lg font-semibold text-white">Topics</h3>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each data.topics || [] as topic}
				{@const topicArticlesRead =
					data.progress?.progress?.filter(
						(p: any) =>
							p.readAt &&
							(data.articles || []).some(
								(a: any) => a.slug === p.articleSlug && a.topic === topic.id
							)
					)?.length || 0}
				<button
					class="rounded-xl p-4 text-left transition {activeTopic === topic.id
						? 'bg-primary-600/20 ring-1 ring-primary-500/50'
						: 'bg-surface-800 hover:bg-surface-700'}"
					onclick={() => setTopic(topic.id)}
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg {activeTopic ===
							topic.id
								? 'bg-primary-500/20'
								: 'bg-surface-700'}"
						>
							<svg
								class="h-5 w-5 {activeTopic === topic.id ? 'text-primary-400' : 'text-surface-400'}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d={getTopicIcon(topic.icon)}
								/>
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-white">{topic.name}</p>
							<p class="text-xs text-surface-400">
								{topic.articleCount} articles
							</p>
						</div>
					</div>
					{#if topic.articleCount > 0}
						<div class="mt-3">
							<div class="h-1 rounded-full bg-surface-700">
								<div
									class="h-1 rounded-full bg-primary-500 transition-all"
									style="width: {Math.round(
										(topicArticlesRead / topic.articleCount) * 100
									)}%"
								></div>
							</div>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Bookmarked Articles -->
	{#if bookmarkedArticles.length > 0 && !activeTopic && !searchQuery}
		<div>
			<h3 class="mb-3 text-lg font-semibold text-white">Bookmarked</h3>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each bookmarkedArticles as article}
					<a
						href="/learn/{article.slug}"
						class="rounded-xl bg-surface-800 p-4 transition hover:bg-surface-700 hover:ring-1 hover:ring-primary-500/50"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span
									class="rounded-full border px-2 py-0.5 text-xs font-medium {difficultyColors[
										article.difficulty
									]}"
								>
									{article.difficulty}
								</span>
								<span class="text-xs text-surface-500"
									>{article.readTimeMinutes} min</span
								>
							</div>
							<svg
								class="h-4 w-4 text-yellow-400"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
								/>
							</svg>
						</div>
						<h4 class="mt-2 text-sm font-medium text-white">{article.title}</h4>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Articles List -->
	<div>
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-lg font-semibold text-white">
				{activeTopic
					? (data.topics || []).find((t: any) => t.id === activeTopic)?.name || 'Articles'
					: searchQuery
						? 'Search Results'
						: 'All Articles'}
			</h3>
			<span class="text-sm text-surface-400">
				{(data.articles || []).length} articles
			</span>
		</div>

		{#if (data.articles || []).length > 0}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.articles || [] as article}
					<a
						href="/learn/{article.slug}"
						class="group rounded-xl bg-surface-800 p-5 transition hover:bg-surface-700 hover:ring-1 hover:ring-primary-500/50"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span
									class="rounded-full border px-2 py-0.5 text-xs font-medium {difficultyColors[
										article.difficulty
									]}"
								>
									{article.difficulty}
								</span>
								<span class="text-xs text-surface-500">
									{article.readTimeMinutes} min read
								</span>
							</div>
							<div class="flex items-center gap-1">
								{#if isArticleBookmarked(article.slug)}
									<svg class="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
										<path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
									</svg>
								{/if}
								{#if isArticleRead(article.slug)}
									<svg
										class="h-4 w-4 text-green-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								{/if}
							</div>
						</div>
						<h4 class="mt-3 text-sm font-semibold text-white group-hover:text-primary-300">
							{article.title}
						</h4>
						<p class="mt-2 line-clamp-2 text-xs text-surface-400">
							{article.summary}
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							{#each (article.tags || []).slice(0, 3) as tag}
								<span
									class="rounded bg-surface-700 px-1.5 py-0.5 text-xs text-surface-400"
								>
									{tag}
								</span>
							{/each}
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<Card>
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
							d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
						/>
					</svg>
					<p class="mt-3 text-sm text-surface-400">No articles found matching your filters.</p>
					<Button
						variant="secondary"
						size="sm"
						class="mt-3"
						onclick={() => {
							activeDifficulty = '';
							activeTopic = '';
							searchQuery = '';
							goto('/learn');
						}}
					>
						Clear filters
					</Button>
				</div>
			</Card>
		{/if}
	</div>
</div>
