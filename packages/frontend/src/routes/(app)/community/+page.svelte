<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showNewPostModal = $state(false);
	let replyingToPost = $state<any>(null);
	let confirmDeletePost = $state<any>(null);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			showNewPostModal = false;
			replyingToPost = null;
			confirmDeletePost = null;
		}
	});

	function fmtDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	const categories = [
		{ key: '', label: 'All' },
		{ key: 'tip', label: 'Tips' },
		{ key: 'question', label: 'Questions' },
		{ key: 'achievement', label: 'Achievements' },
		{ key: 'discussion', label: 'Discussion' }
	];

	function getCategoryColor(category: string): string {
		switch (category) {
			case 'tip':
				return 'bg-green-500/20 text-green-300 border border-green-500/30';
			case 'question':
				return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
			case 'achievement':
				return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
			case 'discussion':
				return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
			default:
				return 'bg-surface-600 text-surface-300 border border-surface-500/30';
		}
	}

	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'tip':
				return 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z';
			case 'question':
				return 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
			case 'achievement':
				return 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z';
			default:
				return 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z';
		}
	}

	function setCategory(cat: string) {
		const url = new URL($page.url);
		if (cat) {
			url.searchParams.set('category', cat);
		} else {
			url.searchParams.delete('category');
		}
		url.searchParams.delete('page');
		goto(url.toString());
	}
</script>

<svelte:head>
	<title>Community - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Community</h2>
			<p class="mt-1 text-sm text-surface-400">
				Share tips, ask questions, and celebrate financial wins together.
			</p>
		</div>
		<Button onclick={() => (showNewPostModal = true)}>New Post</Button>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Category Filter Tabs -->
	<div class="flex gap-2 overflow-x-auto border-b border-surface-700 pb-3">
		{#each categories as cat}
			<button
				class="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition
					{data.category === cat.key
					? 'bg-primary-600 text-white'
					: 'text-surface-400 hover:bg-surface-800 hover:text-white'}"
				onclick={() => setCategory(cat.key)}
			>
				{cat.label}
			</button>
		{/each}
	</div>

	<!-- Posts Feed -->
	{#if data.posts.length === 0}
		<Card>
			<div class="flex flex-col items-center py-12 text-center">
				<svg
					class="h-16 w-16 text-surface-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No posts yet</p>
				<p class="mt-1 text-sm text-surface-500">
					Be the first to start a conversation in the community.
				</p>
			</div>
		</Card>
	{:else}
		<div class="space-y-4">
			{#each data.posts as post}
				<Card>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span
									class="rounded-full px-2 py-0.5 text-xs font-medium capitalize {getCategoryColor(post.category)}"
								>
									<svg
										class="mr-1 inline h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d={getCategoryIcon(post.category)}
										/>
									</svg>
									{post.category}
								</span>
								{#if post.isAnonymous}
									<span class="text-xs text-surface-500">Anonymous</span>
								{/if}
								<span class="text-xs text-surface-500">{fmtDate(post.createdAt)}</span>
							</div>
							<h3 class="mt-2 text-lg font-semibold text-white">{post.title}</h3>
							<p class="mt-1 text-sm text-surface-300 line-clamp-3">{post.content}</p>
						</div>
					</div>

					<!-- Actions bar -->
					<div class="mt-4 flex items-center gap-4 border-t border-surface-700 pt-3">
						<form method="POST" action="?/likePost" use:enhance class="inline">
							<input type="hidden" name="postId" value={post.id} />
							<button
								type="submit"
								class="flex items-center gap-1.5 text-sm text-surface-400 transition hover:text-red-400"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
								</svg>
								{post.likesCount}
							</button>
						</form>

						<button
							class="flex items-center gap-1.5 text-sm text-surface-400 transition hover:text-primary-400"
							onclick={() => (replyingToPost = post)}
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
							{post.repliesCount}
						</button>

						<form method="POST" action="?/deletePost" use:enhance class="ml-auto inline">
							<input type="hidden" name="postId" value={post.id} />
							<button
								type="submit"
								class="rounded p-1 text-surface-500 transition hover:bg-surface-700 hover:text-red-400"
								title="Delete post"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</form>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- New Post Modal -->
<Modal open={showNewPostModal} onclose={() => (showNewPostModal = false)} title="New Post">
	<form
		method="POST"
		action="?/createPost"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="postCategory" class="block text-sm font-medium text-surface-300">
				Category
			</label>
			<select
				id="postCategory"
				name="category"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			>
				<option value="tip">Tip</option>
				<option value="question">Question</option>
				<option value="achievement">Achievement</option>
				<option value="discussion">Discussion</option>
			</select>
		</div>

		<div>
			<label for="postTitle" class="block text-sm font-medium text-surface-300">Title</label>
			<input
				id="postTitle"
				name="title"
				type="text"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="What's on your mind?"
			/>
		</div>

		<div>
			<label for="postContent" class="block text-sm font-medium text-surface-300">
				Content
			</label>
			<textarea
				id="postContent"
				name="content"
				required
				rows="4"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="Share your thoughts..."
			></textarea>
		</div>

		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				name="isAnonymous"
				class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
			/>
			<span class="text-sm text-surface-300">Post anonymously</span>
		</label>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showNewPostModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Post</Button>
		</div>
	</form>
</Modal>

<!-- Reply Modal -->
<Modal
	open={replyingToPost !== null}
	onclose={() => (replyingToPost = null)}
	title="Reply to Post"
>
	{#if replyingToPost}
		<div class="mb-4 rounded-lg bg-surface-900 p-3">
			<p class="text-sm font-medium text-white">{replyingToPost.title}</p>
			<p class="mt-1 text-xs text-surface-500 line-clamp-2">{replyingToPost.content}</p>
		</div>

		<form
			method="POST"
			action="?/addReply"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="postId" value={replyingToPost.id} />

			<div>
				<label for="replyContent" class="block text-sm font-medium text-surface-300">
					Your Reply
				</label>
				<textarea
					id="replyContent"
					name="content"
					required
					rows="3"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="Write your reply..."
				></textarea>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => (replyingToPost = null)}>
					Cancel
				</Button>
				<Button type="submit">Reply</Button>
			</div>
		</form>
	{/if}
</Modal>
