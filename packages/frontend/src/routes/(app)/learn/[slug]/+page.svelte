<script lang="ts">
	import { Card, Button } from '$components/ui';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const difficultyColors: Record<string, string> = {
		beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
		intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
		advanced: 'bg-red-500/20 text-red-400 border-red-500/30'
	};

	const topicLabels: Record<string, string> = {
		budgeting: 'Budgeting Basics',
		saving: 'Saving Money',
		debt: 'Debt Management',
		credit: 'Credit Score',
		investing: 'Investing 101',
		tax: 'Tax Planning',
		'home-buying': 'Home Buying',
		insurance: 'Insurance'
	};

	let markingRead = $state(false);
	let bookmarkLoading = $state(false);

	const isRead = $derived(
		data.progress?.progress?.some(
			(p: any) => p.articleSlug === data.article.slug && p.readAt
		) ?? false
	);

	const isBookmarked = $derived(
		data.progress?.progress?.some(
			(p: any) => p.articleSlug === data.article.slug && p.isBookmarked
		) ?? false
	);

	// Simple markdown rendering
	function renderMarkdown(md: string): string {
		let html = md;

		// Headers
		html = html.replace(/^### (.+)$/gm, '<h3 class="mt-6 mb-2 text-lg font-semibold text-white">$1</h3>');
		html = html.replace(/^## (.+)$/gm, '<h2 class="mt-8 mb-3 text-xl font-bold text-white">$1</h2>');

		// Bold
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');

		// Tables
		html = html.replace(
			/^\|(.+)\|$/gm,
			(match) => {
				return match;
			}
		);

		// Process tables block by block
		const lines = html.split('\n');
		let result: string[] = [];
		let inTable = false;
		let tableRows: string[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			if (line.startsWith('|') && line.endsWith('|')) {
				if (!inTable) {
					inTable = true;
					tableRows = [];
				}
				tableRows.push(line);
			} else {
				if (inTable) {
					result.push(renderTable(tableRows));
					inTable = false;
					tableRows = [];
				}
				result.push(lines[i]);
			}
		}
		if (inTable) {
			result.push(renderTable(tableRows));
		}

		html = result.join('\n');

		// Unordered lists
		html = html.replace(
			/^- (.+)$/gm,
			'<li class="ml-4 flex items-start gap-2 text-surface-300"><span class="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-surface-500"></span><span>$1</span></li>'
		);

		// Ordered lists
		html = html.replace(
			/^(\d+)\. (.+)$/gm,
			'<li class="ml-4 flex items-start gap-2 text-surface-300"><span class="flex-shrink-0 font-semibold text-primary-400">$1.</span><span>$2</span></li>'
		);

		// Paragraphs - wrap non-tag lines
		html = html
			.split('\n\n')
			.map((block) => {
				block = block.trim();
				if (!block) return '';
				if (
					block.startsWith('<h') ||
					block.startsWith('<li') ||
					block.startsWith('<table') ||
					block.startsWith('<div')
				) {
					return block;
				}
				// Wrap consecutive list items
				if (block.includes('<li')) {
					return `<ul class="my-3 space-y-1">${block}</ul>`;
				}
				return `<p class="my-3 text-surface-300 leading-relaxed">${block}</p>`;
			})
			.join('\n');

		return html;
	}

	function renderTable(rows: string[]): string {
		if (rows.length < 2) return rows.join('\n');

		const headerCells = rows[0]
			.split('|')
			.filter((c) => c.trim())
			.map((c) => c.trim());

		// Skip separator row
		const dataRows = rows.slice(2).map((row) =>
			row
				.split('|')
				.filter((c) => c.trim())
				.map((c) => c.trim())
		);

		let tableHtml =
			'<div class="my-4 overflow-x-auto"><table class="w-full text-sm"><thead><tr>';
		for (const cell of headerCells) {
			tableHtml += `<th class="border-b border-surface-600 px-3 py-2 text-left text-surface-300 font-medium">${cell}</th>`;
		}
		tableHtml += '</tr></thead><tbody>';

		for (const row of dataRows) {
			tableHtml += '<tr>';
			for (const cell of row) {
				tableHtml += `<td class="border-b border-surface-700 px-3 py-2 text-surface-400">${cell}</td>`;
			}
			tableHtml += '</tr>';
		}
		tableHtml += '</tbody></table></div>';
		return tableHtml;
	}

	const renderedContent = $derived(renderMarkdown(data.article.content));
</script>

<svelte:head>
	<title>{data.article.title} - Finance Owl Learn</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Back link -->
	<a
		href="/learn"
		class="inline-flex items-center gap-1.5 text-sm text-surface-400 transition hover:text-white"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
		Back to Learn
	</a>

	<!-- Article Header -->
	<Card>
		<div class="space-y-4">
			<div class="flex flex-wrap items-center gap-2">
				<span class="rounded-full bg-surface-700 px-3 py-1 text-xs font-medium text-surface-300">
					{topicLabels[data.article.topic] || data.article.topic}
				</span>
				<span
					class="rounded-full border px-2 py-0.5 text-xs font-medium {difficultyColors[
						data.article.difficulty
					]}"
				>
					{data.article.difficulty}
				</span>
				<span class="flex items-center gap-1 text-xs text-surface-500">
					<svg
						class="h-3.5 w-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					{data.article.readTimeMinutes} min read
				</span>
			</div>

			<h1 class="text-2xl font-bold text-white lg:text-3xl">{data.article.title}</h1>
			<p class="text-surface-300">{data.article.summary}</p>

			<div class="flex items-center gap-3">
				<!-- Bookmark button -->
				<form method="POST" action="?/bookmark" use:enhance={() => {
					bookmarkLoading = true;
					return async ({ update }) => {
						bookmarkLoading = false;
						await update();
					};
				}}>
					<button
						type="submit"
						class="inline-flex items-center gap-1.5 rounded-lg border border-surface-600 px-3 py-1.5 text-sm transition hover:border-yellow-500/50 {isBookmarked
							? 'text-yellow-400'
							: 'text-surface-400 hover:text-yellow-400'}"
						disabled={bookmarkLoading}
					>
						<svg
							class="h-4 w-4"
							fill={isBookmarked ? 'currentColor' : 'none'}
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
							/>
						</svg>
						{isBookmarked ? 'Bookmarked' : 'Bookmark'}
					</button>
				</form>

				<!-- Mark as Read button -->
				{#if !isRead}
					<form method="POST" action="?/markRead" use:enhance={() => {
						markingRead = true;
						return async ({ update }) => {
							markingRead = false;
							await update();
						};
					}}>
						<Button type="submit" size="sm" variant="secondary" loading={markingRead}>
							Mark as Read
						</Button>
					</form>
				{:else}
					<span class="inline-flex items-center gap-1.5 text-sm text-green-400">
						<svg
							class="h-4 w-4"
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
						Read
					</span>
				{/if}
			</div>
		</div>
	</Card>

	<!-- Article Content -->
	<Card>
		<article class="prose-custom">
			{@html renderedContent}
		</article>
	</Card>

	<!-- Related Articles -->
	{#if data.related && data.related.length > 0}
		<div>
			<h3 class="mb-3 text-lg font-semibold text-white">Related Articles</h3>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.related as article}
					<a
						href="/learn/{article.slug}"
						class="rounded-xl bg-surface-800 p-4 transition hover:bg-surface-700 hover:ring-1 hover:ring-primary-500/50"
					>
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
						<h4 class="mt-2 text-sm font-medium text-white">{article.title}</h4>
						<p class="mt-1 line-clamp-2 text-xs text-surface-400">
							{article.summary}
						</p>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Bottom navigation -->
	<div class="flex justify-center pb-8">
		<a
			href="/learn"
			class="inline-flex items-center gap-1.5 text-sm text-primary-400 transition hover:text-primary-300"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Back to all articles
		</a>
	</div>
</div>
