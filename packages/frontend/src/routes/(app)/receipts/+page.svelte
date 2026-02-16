<script lang="ts">
	import { Card, Button, Modal, Input } from '$components/ui';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// States
	let selectedReceipt = $state<any>(null);
	let showUpload = $state(false);
	let showDetail = $state(false);
	let showCreateTx = $state(false);
	let showLinkTx = $state(false);
	let uploading = $state(false);
	let dragActive = $state(false);
	let selectedFile = $state<File | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	// Edit form states
	let editMerchant = $state('');
	let editAmount = $state(0);
	let editDate = $state('');

	// Create transaction states
	let txAccountId = $state('');
	let txName = $state('');
	let txMerchant = $state('');
	let txAmount = $state(0);
	let txDate = $state('');

	// Link transaction
	let linkTxId = $state('');

	const statusColors: Record<string, string> = {
		pending: 'bg-yellow-500/20 text-yellow-400',
		processed: 'bg-green-500/20 text-green-400',
		failed: 'bg-red-500/20 text-red-400'
	};

	function openDetail(receipt: any) {
		selectedReceipt = receipt;
		editMerchant = receipt.merchantName || '';
		editAmount = receipt.totalAmount || 0;
		editDate = receipt.date || '';
		showDetail = true;
	}

	function closeDetail() {
		showDetail = false;
		selectedReceipt = null;
	}

	function openCreateTx() {
		if (selectedReceipt) {
			txName = selectedReceipt.merchantName || 'Receipt purchase';
			txMerchant = selectedReceipt.merchantName || '';
			txAmount = selectedReceipt.totalAmount || 0;
			txDate = selectedReceipt.date || new Date().toISOString().split('T')[0];
			txAccountId = '';
		}
		showCreateTx = true;
	}

	function openLinkTx() {
		linkTxId = '';
		showLinkTx = true;
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return 'Unknown';
		try {
			const d = new Date(dateStr);
			return d.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	function formatAmount(amount: number | null): string {
		if (amount === null || amount === undefined) return '--';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragActive = true;
	}

	function handleDragLeave() {
		dragActive = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragActive = false;
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			selectedFile = files[0];
			showUpload = true;
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			selectedFile = input.files[0];
			showUpload = true;
		}
	}

	function triggerFileInput() {
		fileInputRef?.click();
	}

	// Handle form results
	$effect(() => {
		if (form && 'uploaded' in form && form.uploaded) {
			showUpload = false;
			selectedFile = null;
		}
		if (form && 'updated' in form && form.updated) {
			// Stay on detail view, data refreshes
		}
		if (form && 'deleted' in form && form.deleted) {
			closeDetail();
		}
		if (form && 'created' in form && form.created) {
			showCreateTx = false;
			closeDetail();
		}
		if (form && 'linked' in form && form.linked) {
			showLinkTx = false;
		}
	});

	function parseItems(itemsJson: string | null): Array<{ name: string; quantity?: number; price?: number }> {
		if (!itemsJson) return [];
		try {
			return JSON.parse(itemsJson);
		} catch {
			return [];
		}
	}
</script>

<svelte:head>
	<title>Receipts - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold text-white">Receipts</h2>
		<Button size="sm" onclick={triggerFileInput}>Upload Receipt</Button>
	</div>

	<!-- Hidden file input -->
	<input
		type="file"
		accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
		class="hidden"
		bind:this={fileInputRef}
		onchange={handleFileSelect}
	/>

	<!-- Upload drop zone -->
	<div
		role="button"
		tabindex="0"
		class="rounded-xl border-2 border-dashed transition-colors {dragActive
			? 'border-primary-500 bg-primary-500/10'
			: 'border-surface-600 bg-surface-800/50 hover:border-surface-500'}"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={triggerFileInput}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerFileInput(); }}
	>
		<div class="flex flex-col items-center justify-center py-8">
			<svg
				class="h-10 w-10 text-surface-500"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
			<p class="mt-3 text-sm text-surface-300">
				<span class="font-medium text-primary-400">Click to upload</span> or drag and drop
			</p>
			<p class="mt-1 text-xs text-surface-500">JPEG, PNG, WebP, HEIC up to 10MB</p>
		</div>
	</div>

	<!-- Receipt List -->
	{#if (data.receipts || []).length > 0}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.receipts || [] as receipt}
				<button
					class="rounded-xl bg-surface-800 p-4 text-left transition hover:bg-surface-700 hover:ring-1 hover:ring-primary-500/50"
					onclick={() => openDetail(receipt)}
				>
					<div class="flex items-start gap-3">
						<!-- Thumbnail placeholder -->
						<div
							class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-surface-700"
						>
							<svg
								class="h-7 w-7 text-surface-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center justify-between">
								<p class="truncate text-sm font-medium text-white">
									{receipt.merchantName || 'Unknown Merchant'}
								</p>
								<span
									class="ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {statusColors[
										receipt.status
									] || 'bg-surface-700 text-surface-400'}"
								>
									{receipt.status}
								</span>
							</div>
							<p class="mt-1 text-sm font-semibold text-surface-300">
								{formatAmount(receipt.totalAmount)}
							</p>
							<p class="mt-0.5 text-xs text-surface-500">
								{formatDate(receipt.date || receipt.createdAt)}
							</p>
							{#if receipt.transactionId}
								<span class="mt-1 inline-flex items-center gap-1 text-xs text-primary-400">
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
									</svg>
									Linked
								</span>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>
	{:else}
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
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No receipts yet</p>
				<p class="mt-1 text-sm text-surface-500">
					Upload a receipt to get started. Take a photo or drag and drop an image.
				</p>
				<div class="mt-4">
					<Button onclick={triggerFileInput}>Upload Your First Receipt</Button>
				</div>
			</div>
		</Card>
	{/if}
</div>

<!-- Upload Modal -->
<Modal open={showUpload} onclose={() => { showUpload = false; selectedFile = null; }} title="Upload Receipt">
	<form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance={() => {
		uploading = true;
		return async ({ update }) => {
			uploading = false;
			await update();
		};
	}}>
		<div class="space-y-4">
			{#if selectedFile}
				<div class="rounded-lg border border-surface-700 bg-surface-700/50 p-4">
					<div class="flex items-center gap-3">
						<svg class="h-8 w-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						<div>
							<p class="text-sm font-medium text-white">{selectedFile.name}</p>
							<p class="text-xs text-surface-400">
								{(selectedFile.size / 1024 / 1024).toFixed(2)} MB
							</p>
						</div>
					</div>
				</div>
			{/if}

			<div>
				<label for="uploadFile" class="block text-sm font-medium text-surface-300">
					{selectedFile ? 'Change file' : 'Select receipt image'}
				</label>
				<input
					type="file"
					id="uploadFile"
					name="file"
					accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
					required
					onchange={(e) => {
						const input = e.currentTarget;
						if (input.files && input.files.length > 0) {
							selectedFile = input.files[0];
						}
					}}
					class="mt-1 block w-full text-sm text-surface-400 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-700"
				/>
			</div>

			{#if form && 'error' in form && form.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}

			<div class="flex justify-end gap-3">
				<Button variant="secondary" type="button" onclick={() => { showUpload = false; selectedFile = null; }}>
					Cancel
				</Button>
				<Button type="submit" loading={uploading} disabled={!selectedFile}>Upload</Button>
			</div>
		</div>
	</form>
</Modal>

<!-- Receipt Detail Modal -->
<Modal
	open={showDetail}
	onclose={closeDetail}
	title={selectedReceipt?.merchantName || 'Receipt Details'}
>
	{#if selectedReceipt}
		<div class="space-y-4">
			<!-- Status -->
			<div class="flex items-center justify-between">
				<span
					class="rounded-full px-3 py-1 text-xs font-medium {statusColors[selectedReceipt.status]}"
				>
					{selectedReceipt.status}
				</span>
				<span class="text-xs text-surface-500">
					Uploaded {formatDate(selectedReceipt.createdAt)}
				</span>
			</div>

			<!-- Editable data form -->
			<form method="POST" action="?/updateReceipt" use:enhance>
				<input type="hidden" name="receiptId" value={selectedReceipt.id} />
				<div class="space-y-3">
					<Input
						id="merchantName"
						name="merchantName"
						label="Merchant Name"
						bind:value={editMerchant}
						placeholder="e.g., Walmart, Target"
					/>
					<Input
						id="totalAmount"
						name="totalAmount"
						label="Total Amount"
						type="number"
						step="0.01"
						bind:value={editAmount}
						placeholder="0.00"
					/>
					<Input
						id="receiptDate"
						name="date"
						label="Date"
						type="date"
						bind:value={editDate}
					/>

					<!-- Line items -->
					{#if selectedReceipt.items}
						{@const items = parseItems(selectedReceipt.items)}
						{#if items.length > 0}
							<div>
								<p class="mb-2 text-sm font-medium text-surface-300">Line Items</p>
								<div class="space-y-1 rounded-lg border border-surface-700 p-3">
									{#each items as item}
										<div class="flex items-center justify-between text-sm">
											<span class="text-surface-300">{item.name}</span>
											<span class="text-surface-400">
												{item.quantity ? `x${item.quantity}` : ''} {item.price ? formatAmount(item.price) : ''}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/if}

					<div class="flex justify-end">
						<Button type="submit" size="sm">Save Details</Button>
					</div>
				</div>
			</form>

			<!-- Action buttons -->
			<div class="border-t border-surface-700 pt-4">
				<div class="flex flex-wrap gap-2">
					{#if !selectedReceipt.transactionId}
						<Button size="sm" variant="secondary" onclick={openCreateTx}>
							Create Transaction
						</Button>
						<Button size="sm" variant="secondary" onclick={openLinkTx}>
							Link to Transaction
						</Button>
					{:else}
						<span class="inline-flex items-center gap-1.5 text-sm text-primary-400">
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
							</svg>
							Linked to transaction
						</span>
					{/if}

					<form method="POST" action="?/deleteReceipt" use:enhance>
						<input type="hidden" name="receiptId" value={selectedReceipt.id} />
						<Button type="submit" size="sm" variant="danger">Delete</Button>
					</form>
				</div>
			</div>

			{#if form && 'error' in form && form.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}
		</div>
	{/if}
</Modal>

<!-- Create Transaction Modal -->
<Modal open={showCreateTx} onclose={() => (showCreateTx = false)} title="Create Transaction from Receipt">
	{#if selectedReceipt}
		<form method="POST" action="?/createTransaction" use:enhance>
			<input type="hidden" name="receiptId" value={selectedReceipt.id} />
			<div class="space-y-4">
				<div>
					<label for="txAccountId" class="block text-sm font-medium text-surface-300">
						Account
					</label>
					<select
						id="txAccountId"
						name="accountId"
						bind:value={txAccountId}
						required
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						<option value="">Select an account</option>
						{#each data.accounts || [] as account}
							<option value={account.id}>{account.name} ({account.type})</option>
						{/each}
					</select>
				</div>

				<Input
					id="txName"
					name="name"
					label="Transaction Name"
					bind:value={txName}
					required
					placeholder="e.g., Grocery shopping"
				/>

				<Input
					id="txMerchant"
					name="merchantName"
					label="Merchant (optional)"
					bind:value={txMerchant}
					placeholder="e.g., Walmart"
				/>

				<Input
					id="txAmount"
					name="amount"
					label="Amount"
					type="number"
					step="0.01"
					bind:value={txAmount}
					required
					placeholder="0.00"
				/>

				<Input
					id="txDate"
					name="date"
					label="Date"
					type="date"
					bind:value={txDate}
					required
				/>

				{#if form && 'error' in form && form.error}
					<p class="text-sm text-red-400">{form.error}</p>
				{/if}

				<div class="flex justify-end gap-3">
					<Button variant="secondary" type="button" onclick={() => (showCreateTx = false)}>
						Cancel
					</Button>
					<Button type="submit">Create Transaction</Button>
				</div>
			</div>
		</form>
	{/if}
</Modal>

<!-- Link Transaction Modal -->
<Modal open={showLinkTx} onclose={() => (showLinkTx = false)} title="Link to Existing Transaction">
	{#if selectedReceipt}
		<form method="POST" action="?/linkTransaction" use:enhance>
			<input type="hidden" name="receiptId" value={selectedReceipt.id} />
			<div class="space-y-4">
				<Input
					id="linkTxId"
					name="transactionId"
					label="Transaction ID"
					bind:value={linkTxId}
					required
					placeholder="Paste the transaction ID"
				/>
				<p class="text-xs text-surface-500">
					You can find the transaction ID on the Transactions page. Copy it from the transaction detail view.
				</p>

				{#if form && 'error' in form && form.error}
					<p class="text-sm text-red-400">{form.error}</p>
				{/if}

				<div class="flex justify-end gap-3">
					<Button variant="secondary" type="button" onclick={() => (showLinkTx = false)}>
						Cancel
					</Button>
					<Button type="submit">Link</Button>
				</div>
			</div>
		</form>
	{/if}
</Modal>
