<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$components/ui';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let dismissed = $state(false);

	$effect(() => {
		if (!browser) return;

		function handleBeforeInstallPrompt(event: Event): void {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
		}

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		};
	});

	async function install(): Promise<void> {
		if (!deferredPrompt) return;

		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === 'accepted') {
			deferredPrompt = null;
		}
	}

	function dismiss(): void {
		dismissed = true;
	}
</script>

{#if deferredPrompt && !dismissed}
	<div
		class="flex items-center justify-between gap-4 border-b border-surface-700 bg-surface-800 px-4 py-3"
		role="banner"
	>
		<div class="flex items-center gap-3">
			<svg class="h-5 w-5 shrink-0 text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
			</svg>
			<span class="text-sm text-surface-200">Install Finance Owl for quick access</span>
		</div>
		<div class="flex items-center gap-2">
			<Button size="sm" onclick={install}>Install</Button>
			<button
				onclick={dismiss}
				class="p-1 text-surface-400 transition hover:text-white"
				aria-label="Dismiss install prompt"
			>
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
					/>
				</svg>
			</button>
		</div>
	</div>
{/if}
