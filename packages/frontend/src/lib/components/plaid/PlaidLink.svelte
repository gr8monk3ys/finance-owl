<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		linkToken: string;
		onSuccess: (publicToken: string, metadata: any) => void;
		onExit?: (error: any, metadata: any) => void;
		buttonText?: string;
		buttonClass?: string;
		isUpdate?: boolean;
		autoOpen?: boolean;
	}

	let {
		linkToken,
		onSuccess,
		onExit,
		buttonText = 'Link Account',
		buttonClass = '',
		isUpdate = false,
		autoOpen = true
	}: Props = $props();

	let plaidLoaded = $state(false);
	let loading = $state(true);
	let error = $state('');
	let handler: any = null;
	let opened = $state(false);

	onMount(() => {
		// Check if Plaid is already loaded (e.g. from a previous component mount)
		if ((window as any).Plaid) {
			plaidLoaded = true;
			loading = false;
			if (autoOpen && !opened) {
				openPlaidLink();
			}
			return;
		}

		// Check if script tag already exists
		const existingScript = document.querySelector(
			'script[src*="link-initialize.js"]'
		);
		if (existingScript) {
			existingScript.addEventListener('load', () => {
				plaidLoaded = true;
				loading = false;
				if (autoOpen && !opened) {
					openPlaidLink();
				}
			});
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
		script.async = true;
		script.onload = () => {
			plaidLoaded = true;
			loading = false;
			if (autoOpen && !opened) {
				openPlaidLink();
			}
		};
		script.onerror = () => {
			loading = false;
			error = 'Failed to load Plaid Link SDK';
		};
		document.head.appendChild(script);

		return () => {
			handler?.destroy();
		};
	});

	function openPlaidLink() {
		if (!(window as any).Plaid) {
			error = 'Plaid SDK not loaded yet';
			return;
		}

		error = '';
		opened = true;

		handler = (window as any).Plaid.create({
			token: linkToken,
			onSuccess: (public_token: string, metadata: any) => {
				onSuccess(public_token, metadata);
			},
			onExit: (err: any, metadata: any) => {
				if (err) {
					error = err.display_message || err.error_message || 'Plaid Link error';
				}
				onExit?.(err, metadata);
			},
			onEvent: (eventName: string, _metadata: any) => {
				// Can be used for analytics/logging
				if (eventName === 'ERROR') {
					error = 'An error occurred in Plaid Link';
				}
			}
		});

		handler.open();
	}
</script>

{#if error}
	<div class="mb-2 rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-300">
		{error}
		<button
			onclick={() => {
				error = '';
				opened = false;
				openPlaidLink();
			}}
			class="ml-2 text-red-200 underline hover:text-white"
		>
			Try again
		</button>
	</div>
{/if}

{#if !autoOpen || !opened || error}
	<button
		onclick={openPlaidLink}
		disabled={!plaidLoaded || loading}
		class="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-50 {buttonClass}"
	>
		{#if loading}
			<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
				<circle
					class="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				/>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
				/>
			</svg>
			Loading...
		{:else}
			{buttonText}
		{/if}
	</button>
{/if}
