<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form } = $props<{ form: ActionData }>();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Setup - FinanceOwl</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-900 px-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-white">Welcome to FinanceOwl</h1>
			<p class="mt-2 text-surface-400">Create your admin account to get started</p>
		</div>

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}
			class="space-y-6 rounded-xl bg-surface-800 p-8 shadow-lg"
		>
			{#if form?.error}
				<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
			{/if}

			<div class="rounded-lg bg-primary-900/30 p-3 text-sm text-primary-300">
				This is the first time FinanceOwl is running. Create your admin account below.
			</div>

			<div>
				<label for="name" class="block text-sm font-medium text-surface-300">Name</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					value={form?.name ?? ''}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div>
				<label for="email" class="block text-sm font-medium text-surface-300">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					value={form?.email ?? ''}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="you@example.com"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-surface-300">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					minlength={8}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div>
				<label for="confirmPassword" class="block text-sm font-medium text-surface-300"
					>Confirm Password</label
				>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					required
					minlength={8}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
			>
				{loading ? 'Setting up...' : 'Complete Setup'}
			</button>
		</form>
	</div>
</div>
