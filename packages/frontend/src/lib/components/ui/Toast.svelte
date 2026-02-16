<script lang="ts">
	interface Props {
		message: string;
		type?: 'success' | 'error' | 'info' | 'warning';
		visible: boolean;
		ondismiss: () => void;
	}

	let { message, type = 'info', visible, ondismiss }: Props = $props();

	const styles: Record<string, string> = {
		success: 'bg-primary-900/90 text-primary-200 border-primary-700/60',
		error: 'bg-red-900/90 text-red-200 border-red-700/60',
		info: 'bg-surface-800/95 text-surface-200 border-surface-600/60',
		warning: 'bg-accent-900/90 text-accent-200 border-accent-700/60'
	};

	const icons: Record<string, string> = {
		success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
		info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
	};

	$effect(() => {
		if (visible) {
			const timer = setTimeout(ondismiss, 5000);
			return () => clearTimeout(timer);
		}
	});
</script>

{#if visible}
	<div class="fixed bottom-4 right-4 z-50 toast-enter">
		<div
			class="flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl shadow-black/30 backdrop-blur-sm {styles[type]}"
		>
			<svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d={icons[type]} />
			</svg>
			<span class="text-sm font-medium">{message}</span>
			<button
				aria-label="Dismiss notification"
				onclick={ondismiss}
				class="ml-2 rounded-lg p-0.5 opacity-60 transition-opacity hover:opacity-100"
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
