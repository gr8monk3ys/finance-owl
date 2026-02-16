<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		feature?: string;
		requiredPlan?: 'premium' | 'family';
	}

	let { open = $bindable(), onclose, feature = '', requiredPlan = 'premium' }: Props = $props();

	const planDetails: Record<
		string,
		{ title: string; price: string; color: string; highlights: string[] }
	> = {
		premium: {
			title: 'Premium',
			price: '$4.99/mo',
			color: 'emerald',
			highlights: [
				'Unlimited linked accounts',
				'Unlimited AI chat & insights',
				'Subscription tracking',
				'Bill negotiation tools',
				'Smart savings automation',
				'Investment tracking',
				'Advanced reports & analytics'
			]
		},
		family: {
			title: 'Family',
			price: '$9.99/mo',
			color: 'purple',
			highlights: [
				'Everything in Premium',
				'Household sharing (up to 5 members)',
				'Family budgets & shared goals',
				'Advisor sharing',
				'Priority support'
			]
		}
	};

	const plan = $derived(planDetails[requiredPlan] || planDetails.premium);
</script>

<Modal {open} {onclose} title="Unlock this feature" size="md">
	<div class="space-y-6">
		<!-- Feature highlight -->
		{#if feature}
			<div class="rounded-lg bg-surface-900 p-4 text-center">
				<div
					class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-{plan.color}-500/10"
				>
					<svg
						class="h-6 w-6 text-{plan.color}-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
						/>
					</svg>
				</div>
				<p class="text-sm text-surface-300">
					<span class="font-medium text-white">{feature}</span> requires the
					<span class="font-semibold text-{plan.color}-400">{plan.title}</span> plan.
				</p>
			</div>
		{/if}

		<!-- Plan benefits -->
		<div>
			<h3 class="text-sm font-semibold text-white">{plan.title} Plan - {plan.price}</h3>
			<ul class="mt-3 space-y-2">
				{#each plan.highlights as highlight}
					<li class="flex items-center gap-2 text-sm text-surface-300">
						<svg
							class="h-4 w-4 flex-shrink-0 text-emerald-400"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
						{highlight}
					</li>
				{/each}
			</ul>
		</div>

		<!-- CTA -->
		<div class="flex gap-3">
			<a href="/pricing" class="flex-1">
				<Button variant="primary" class="w-full">View Plans & Upgrade</Button>
			</a>
			<Button variant="secondary" onclick={onclose}>Maybe Later</Button>
		</div>

		<p class="text-center text-xs text-surface-500">
			Cancel anytime. 14-day free trial included.
		</p>
	</div>
</Modal>
