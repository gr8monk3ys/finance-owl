<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form } = $props<{ form: ActionData }>();
	let loading = $state(false);
	let showTotp = $state(false);

	$effect(() => {
		if (form?.code === 'TOTP_REQUIRED') {
			showTotp = true;
		}
	});
</script>

<svelte:head>
	<title>Sign In - Finance Owl</title>
	<meta
		name="description"
		content="Sign in to Finance Owl to review your dashboard, transactions, budgets, and account activity."
	/>
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center bg-surface-900 px-4">
	<!-- Background effects -->
	<div class="absolute inset-0 overflow-hidden">
		<div class="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary-500/5 blur-[100px]"></div>
		<div class="absolute bottom-0 right-0 h-[300px] w-[400px] translate-x-1/4 rounded-full bg-blue-500/5 blur-[80px]"></div>
	</div>

	<div class="relative w-full max-w-md space-y-8">
		<!-- Logo & branding -->
		<div class="text-center">
			<a aria-label="Finance Owl home" href="/" class="inline-flex items-center gap-2.5 group">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-900/40 transition-transform duration-200 group-hover:scale-105">
					<svg class="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5 3.5 5.5 2.5 7C1.5 8.5 2 10.5 3 11.5C2 12.5 1.5 14.5 2.5 16C3.5 17.5 5.5 18 7 17.5C7.5 19.5 9.5 21 12 21C14.5 21 16.5 19.5 17 17.5C18.5 18 20.5 17.5 21.5 16C22.5 14.5 22 12.5 21 11.5C22 10.5 22.5 8.5 21.5 7C20.5 5.5 18.5 5 17 5.5C16.5 3.5 14.5 2 12 2Z"/>
						<circle cx="9.5" cy="10" r="1.5" fill="#064e3b"/>
						<circle cx="14.5" cy="10" r="1.5" fill="#064e3b"/>
						<path d="M9 14.5C9 14.5 10 16 12 16C14 16 15 14.5 15 14.5" stroke="#064e3b" stroke-width="1.5" stroke-linecap="round" fill="none"/>
					</svg>
				</div>
			</a>
			<h1 class="mt-5 text-2xl font-bold text-white">Welcome back</h1>
			<p class="mt-2 text-surface-300">Sign in to your Finance Owl account</p>
		</div>

		<div class="rounded-2xl border border-surface-700/50 bg-surface-800/80 p-8 shadow-xl backdrop-blur-sm">
			<!-- Social login buttons -->
			<div class="space-y-3">
				<button
					type="button"
					class="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-surface-600 bg-surface-700/30 px-4 py-2.5 text-sm font-medium text-surface-300"
					disabled
					aria-disabled="true"
					title="Google sign-in is coming soon"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24">
						<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
						<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
						<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
						<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
					</svg>
					Continue with Google
					<span class="rounded-full border border-surface-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-surface-300">Soon</span>
				</button>
				<button
					type="button"
					class="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-surface-600 bg-surface-700/30 px-4 py-2.5 text-sm font-medium text-surface-300"
					disabled
					aria-disabled="true"
					title="Apple sign-in is coming soon"
				>
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.53-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.18 4.36 9.22 8.87 9c1.27.07 2.15.72 2.91.76.98-.2 1.92-.81 3-.86 1.46.07 2.56.63 3.27 1.63-2.98 1.81-2.27 5.78.5 6.88-.6 1.57-1.37 3.13-2.5 4.87zM12.03 8.94c-.17-2.27 1.65-4.18 3.87-4.44.29 2.55-2.33 4.55-3.87 4.44z"/>
					</svg>
					Continue with Apple
					<span class="rounded-full border border-surface-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-surface-300">Soon</span>
				</button>
			</div>
			<p class="mt-3 text-center text-xs text-surface-400">
				Google and Apple sign-in are not available yet. Use email and password for now.
			</p>

			<!-- Divider -->
			<div class="my-6 flex items-center gap-3">
				<div class="h-px flex-1 bg-surface-700"></div>
				<span class="text-xs text-surface-400">or continue with email</span>
				<div class="h-px flex-1 bg-surface-700"></div>
			</div>

			<!-- Login form -->
			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
				class="space-y-5"
				aria-busy={loading}
			>
				{#if form?.error}
					<div role="alert" aria-live="polite" class="flex items-center gap-2 rounded-lg bg-red-900/30 border border-red-800/30 p-3 text-sm text-red-300">
						<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
						{form.error}
					</div>
				{/if}

				<div>
					<label for="email" class="block text-sm font-medium text-surface-300">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						value={form?.email ?? ''}
						autocomplete="email"
						autocapitalize="off"
						spellcheck="false"
						class="mt-1.5 block w-full rounded-xl border border-surface-600 bg-surface-700/50 px-4 py-2.5 text-white placeholder-surface-500 transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						placeholder="you@example.com"
					/>
				</div>

				<div>
					<div class="flex items-center justify-between">
						<label for="password" class="block text-sm font-medium text-surface-300">Password</label>
						<a href="/auth/forgot-password" class="text-xs text-primary-400 transition hover:text-primary-300">Forgot password?</a>
					</div>
					<input
						id="password"
						name="password"
						type="password"
						required
						autocomplete="current-password"
						class="mt-1.5 block w-full rounded-xl border border-surface-600 bg-surface-700/50 px-4 py-2.5 text-white placeholder-surface-500 transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						placeholder="Enter your password"
					/>
				</div>

				{#if showTotp}
					<div>
						<label for="totpCode" class="block text-sm font-medium text-surface-300">Two-Factor Code</label>
						<input
							id="totpCode"
							name="totpCode"
							type="text"
							inputmode="numeric"
							pattern="[0-9]{6}"
							maxlength="6"
							required
							autocomplete="one-time-code"
							aria-describedby="totp-help"
							class="mt-1.5 block w-full rounded-xl border border-surface-600 bg-surface-700/50 px-4 py-2.5 text-center text-lg tracking-[0.3em] text-white placeholder-surface-500 transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							placeholder="000000"
						/>
						<p id="totp-help" class="mt-1.5 text-xs text-surface-400">
							Enter the 6-digit code from your authenticator app.
						</p>
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="relative flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white shadow-lg shadow-primary-900/30 transition-all hover:bg-primary-500 hover:shadow-primary-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if loading}
						<div class="absolute left-4 h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
					{/if}
					{loading ? 'Signing in...' : 'Sign in'}
				</button>
			</form>
		</div>

		<!-- Footer -->
		<p class="text-center text-sm text-surface-300">
			Don't have an account?
			<a href="/auth/register" class="font-medium text-primary-400 transition hover:text-primary-300">Create one free</a>
		</p>
	</div>
</div>
