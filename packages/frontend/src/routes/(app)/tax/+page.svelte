<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showAddModal = $state(false);
	let editingDocument = $state<any>(null);
	let activeTab = $state<'summary' | 'documents' | 'deductions'>('summary');

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			showAddModal = false;
			editingDocument = null;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function docTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			w2: 'W-2',
			'1099': '1099',
			'1098': '1098',
			charitable: 'Charitable Donation',
			medical: 'Medical Expense',
			business: 'Business Expense'
		};
		return labels[type] || type;
	}

	function filingStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			single: 'Single',
			married_joint: 'Married Filing Jointly',
			married_separate: 'Married Filing Separately',
			head_of_household: 'Head of Household'
		};
		return labels[status] || status;
	}

	function handleYearChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		goto(`/tax?year=${target.value}`);
	}

	const currentYear = new Date().getFullYear();
	const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

	const totalTaxLiability = $derived(
		(data.summary?.estimatedFederalTax ?? 0) + (data.summary?.estimatedStateTax ?? 0)
	);
</script>

<svelte:head>
	<title>Tax Preparation - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Tax Preparation</h2>
			<p class="mt-1 text-sm text-surface-400">
				Track documents and estimate your tax liability.
			</p>
		</div>
		<select
			value={data.year}
			onchange={handleYearChange}
			class="rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
		>
			{#each yearOptions as yr}
				<option value={yr}>{yr}</option>
			{/each}
		</select>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Section Tabs -->
	<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
		<button
			class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition {activeTab === 'summary'
				? 'bg-surface-700 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'summary')}
		>
			Summary
		</button>
		<button
			class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition {activeTab === 'documents'
				? 'bg-surface-700 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'documents')}
		>
			Documents
		</button>
		<button
			class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition {activeTab === 'deductions'
				? 'bg-surface-700 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'deductions')}
		>
			Deductions
		</button>
	</div>

	<!-- ═══════ SUMMARY TAB ═══════ -->
	{#if activeTab === 'summary'}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<Card>
				<p class="text-sm text-surface-400">Estimated Income</p>
				<p class="mt-1 text-xl font-bold text-white">
					{fmt(data.summary?.estimatedIncome ?? 0)}
				</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Estimated Deductions</p>
				<p class="mt-1 text-xl font-bold text-green-400">
					{fmt(data.summary?.estimatedDeductions ?? 0)}
				</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Taxable Income</p>
				<p class="mt-1 text-xl font-bold text-white">
					{fmt(data.summary?.estimatedTaxableIncome ?? 0)}
				</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Federal Tax</p>
				<p class="mt-1 text-xl font-bold text-red-400">
					{fmt(data.summary?.estimatedFederalTax ?? 0)}
				</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">State Tax</p>
				<p class="mt-1 text-xl font-bold text-red-400">
					{fmt(data.summary?.estimatedStateTax ?? 0)}
				</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Total Tax Liability</p>
				<p class="mt-1 text-xl font-bold text-red-400">{fmt(totalTaxLiability)}</p>
			</Card>
		</div>

		<Card>
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-surface-400">Filing Status</p>
					<p class="mt-1 text-white">
						{filingStatusLabel(data.summary?.filingStatus ?? 'single')}
					</p>
					{#if data.summary?.generatedAt}
						<p class="mt-1 text-xs text-surface-500">
							Last generated: {new Date(data.summary.generatedAt).toLocaleDateString()}
						</p>
					{/if}
				</div>
				<form
					method="POST"
					action="?/generateSummary"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<input type="hidden" name="year" value={data.year} />
					<Button type="submit">
						{data.summary?.generatedAt ? 'Recalculate' : 'Generate'} Summary
					</Button>
				</form>
			</div>
		</Card>

	<!-- ═══════ DOCUMENTS TAB ═══════ -->
	{:else if activeTab === 'documents'}
		<div class="flex items-center justify-between">
			<p class="text-sm text-surface-400">
				{data.documents.length} document{data.documents.length !== 1 ? 's' : ''} for {data.year}
			</p>
			<Button onclick={() => (showAddModal = true)}>Add Document</Button>
		</div>

		{#if data.documents.length === 0}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
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
							d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
						/>
					</svg>
					<p class="mt-4 text-lg text-surface-300">No tax documents yet</p>
					<p class="mt-1 text-sm text-surface-500">
						Add W-2s, 1099s, and other tax-related documents.
					</p>
				</div>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each data.documents as doc}
					<Card>
						<div class="flex items-start justify-between">
							<div>
								<div class="flex items-center gap-2">
									<span
										class="inline-flex rounded-full bg-surface-700 px-2 py-0.5 text-xs font-medium text-surface-300"
									>
										{docTypeLabel(doc.type)}
									</span>
									{#if doc.isDeductible}
										<span
											class="inline-flex rounded-full bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-400"
										>
											Deductible
										</span>
									{/if}
								</div>
								<p class="mt-1 font-medium text-white">{fmt(doc.amount)}</p>
								{#if doc.description}
									<p class="mt-0.5 text-sm text-surface-400">{doc.description}</p>
								{/if}
								{#if doc.category}
									<p class="mt-0.5 text-xs text-surface-500">{doc.category}</p>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<button
									class="text-xs text-surface-400 hover:text-white"
									onclick={() => (editingDocument = doc)}
								>
									Edit
								</button>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}

	<!-- ═══════ DEDUCTIONS TAB ═══════ -->
	{:else}
		<Card>
			<h3 class="mb-2 text-lg font-semibold text-white">Potentially Deductible Transactions</h3>
			<p class="mb-4 text-sm text-surface-400">
				Transactions in categories that may qualify as deductions for {data.year}.
			</p>
		</Card>

		{#if data.deductions.length === 0}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<p class="text-lg text-surface-300">No deductible transactions found</p>
					<p class="mt-1 text-sm text-surface-500">
						Transactions in charitable, medical, education, or business categories will appear here.
					</p>
				</div>
			</Card>
		{:else}
			<div class="space-y-2">
				{#each data.deductions as txn}
					<Card>
						<div class="flex items-center justify-between">
							<div>
								<p class="font-medium text-white">{txn.merchantName || txn.name}</p>
								<div class="flex items-center gap-3 text-sm text-surface-400">
									<span>{txn.date}</span>
									{#if txn.categoryName}
										<span class="text-surface-500">{txn.categoryName}</span>
									{/if}
								</div>
							</div>
							<p class="font-semibold text-white">{fmt(Math.abs(txn.amount))}</p>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Add Document Modal -->
<Modal open={showAddModal} onclose={() => (showAddModal = false)} title="Add Tax Document">
	<form
		method="POST"
		action="?/addDocument"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="year" value={data.year} />

		<div>
			<label for="docType" class="block text-sm font-medium text-surface-300">Type</label>
			<select
				id="docType"
				name="type"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			>
				<option value="w2">W-2</option>
				<option value="1099">1099</option>
				<option value="1098">1098</option>
				<option value="charitable">Charitable Donation</option>
				<option value="medical">Medical Expense</option>
				<option value="business">Business Expense</option>
			</select>
		</div>

		<div>
			<label for="docAmount" class="block text-sm font-medium text-surface-300">Amount</label>
			<input
				id="docAmount"
				name="amount"
				type="number"
				step="0.01"
				min="0"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="5000.00"
			/>
		</div>

		<div>
			<label for="docDescription" class="block text-sm font-medium text-surface-300"
				>Description</label
			>
			<input
				id="docDescription"
				name="description"
				type="text"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="Employer W-2, charity name, etc."
			/>
		</div>

		<div>
			<label for="docCategory" class="block text-sm font-medium text-surface-300"
				>Category</label
			>
			<input
				id="docCategory"
				name="category"
				type="text"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="Income, Medical, Charitable, etc."
			/>
		</div>

		<div class="flex items-center gap-2">
			<input
				id="docDeductible"
				name="isDeductible"
				type="checkbox"
				class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
			/>
			<label for="docDeductible" class="text-sm text-surface-300">
				This is a tax-deductible expense
			</label>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showAddModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Add Document</Button>
		</div>
	</form>
</Modal>

<!-- Edit Document Modal -->
<Modal
	open={editingDocument !== null}
	onclose={() => (editingDocument = null)}
	title="Edit Tax Document"
>
	{#if editingDocument}
		<form
			method="POST"
			action="?/updateDocument"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={editingDocument.id} />

			<div>
				<label for="editDocType" class="block text-sm font-medium text-surface-300">Type</label>
				<select
					id="editDocType"
					name="type"
					required
					value={editingDocument.type}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					<option value="w2">W-2</option>
					<option value="1099">1099</option>
					<option value="1098">1098</option>
					<option value="charitable">Charitable Donation</option>
					<option value="medical">Medical Expense</option>
					<option value="business">Business Expense</option>
				</select>
			</div>

			<div>
				<label for="editDocAmount" class="block text-sm font-medium text-surface-300"
					>Amount</label
				>
				<input
					id="editDocAmount"
					name="amount"
					type="number"
					step="0.01"
					min="0"
					required
					value={editingDocument.amount}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div>
				<label for="editDocDescription" class="block text-sm font-medium text-surface-300"
					>Description</label
				>
				<input
					id="editDocDescription"
					name="description"
					type="text"
					value={editingDocument.description ?? ''}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div>
				<label for="editDocCategory" class="block text-sm font-medium text-surface-300"
					>Category</label
				>
				<input
					id="editDocCategory"
					name="category"
					type="text"
					value={editingDocument.category ?? ''}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div class="flex items-center gap-2">
				<input
					id="editDocDeductible"
					name="isDeductible"
					type="checkbox"
					checked={editingDocument.isDeductible}
					class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
				/>
				<label for="editDocDeductible" class="text-sm text-surface-300">
					This is a tax-deductible expense
				</label>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => (editingDocument = null)}>
					Cancel
				</Button>
				<Button type="submit">Save</Button>
			</div>
		</form>

		<form
			method="POST"
			action="?/deleteDocument"
			use:enhance
			class="mt-3 border-t border-surface-700 pt-3"
		>
			<input type="hidden" name="id" value={editingDocument.id} />
			<Button type="submit" variant="danger" size="sm">Delete Document</Button>
		</form>
	{/if}
</Modal>
