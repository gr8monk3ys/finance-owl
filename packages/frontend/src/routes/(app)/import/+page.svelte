<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button } from '$components/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  // ── Wizard State ──────────────────────────────────────────────────────
  let currentStep = $state(1);
  let isLoading = $state(false);

  // Step 1: Upload state
  let isDragging = $state(false);
  let selectedFile = $state<File | null>(null);
  let uploadResult = $state<any>(null);

  // Step 2: Configuration state
  let selectedAccountId = $state('');
  let columnMapping = $state<any>(null);
  let detectedFormat = $state('');

  // Step 3: Preview state
  let previewRows = $state<any[]>([]);
  let selectAll = $state(true);

  // Step 4: Import result state
  let importResult = $state<any>(null);

  // ── Handle form results ──────────────────────────────────────────────
  $effect(() => {
    if (form?.uploadResult) {
      uploadResult = form.uploadResult;
      columnMapping = form.uploadResult.mapping;
      detectedFormat = form.uploadResult.detectedFormat;
      currentStep = 2;
      form = null;
    }
    if (form?.previewResult) {
      previewRows = form.previewResult.map((r: any) => ({ ...r }));
      if (form.accountId) {
        selectedAccountId = form.accountId;
      }
      currentStep = 3;
      form = null;
    }
    if (form?.importResult) {
      importResult = form.importResult;
      currentStep = 4;
      form = null;
    }
  });

  // ── Drag & Drop ──────────────────────────────────────────────────────
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      selectedFile = files[0];
    }
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      selectedFile = input.files[0];
    }
  }

  function getFileExtension(name: string): string {
    return name.toLowerCase().substring(name.lastIndexOf('.'));
  }

  function getFileTypeLabel(name: string): string {
    const ext = getFileExtension(name);
    switch (ext) {
      case '.csv':
        return 'CSV';
      case '.ofx':
        return 'OFX';
      case '.qfx':
        return 'QFX';
      default:
        return ext.toUpperCase();
    }
  }

  // ── Column Mapping ───────────────────────────────────────────────────
  function updateMapping(column: string, value: number) {
    if (!columnMapping) return;
    columnMapping = { ...columnMapping, [column]: value };
  }

  // ── Preview helpers ──────────────────────────────────────────────────
  function toggleRow(index: number) {
    previewRows = previewRows.map((row, i) =>
      i === index ? { ...row, selected: !row.selected } : row,
    );
  }

  function toggleAll() {
    selectAll = !selectAll;
    previewRows = previewRows.map((row) => ({
      ...row,
      selected: selectAll && !row.isDuplicate,
    }));
  }

  const selectedCount = $derived(previewRows.filter((r) => r.selected).length);
  const duplicateCount = $derived(previewRows.filter((r) => r.isDuplicate).length);
  const newCount = $derived(previewRows.filter((r) => !r.isDuplicate).length);

  function getSelectedTransactions(): any[] {
    return previewRows
      .filter((r) => r.selected)
      .map((r) => ({
        date: r.date,
        name: r.name,
        amount: r.amount,
        category: r.category,
        merchantName: r.merchantName,
        memo: r.memo,
        fitId: r.fitId,
      }));
  }

  // ── Format helpers ───────────────────────────────────────────────────
  function formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatImportDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function resetWizard() {
    currentStep = 1;
    selectedFile = null;
    uploadResult = null;
    selectedAccountId = '';
    columnMapping = null;
    detectedFormat = '';
    previewRows = [];
    importResult = null;
    selectAll = true;
    isLoading = false;
  }
</script>

<svelte:head>
  <title>Import Transactions - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">Import Transactions</h2>
      <p class="mt-1 text-sm text-surface-400">Import transactions from CSV, OFX, or QFX files</p>
    </div>
    {#if currentStep > 1 && currentStep < 4}
      <Button variant="ghost" onclick={resetWizard}>Start Over</Button>
    {/if}
  </div>

  <!-- Error display -->
  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 p-4 text-sm text-red-300">
      {form.error}
    </div>
  {/if}

  <!-- Step Indicator -->
  <div class="flex items-center gap-2">
    {#each [1, 2, 3, 4] as step}
      <div class="flex items-center gap-2">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium
					{currentStep === step
            ? 'bg-primary-600 text-white'
            : currentStep > step
              ? 'bg-green-600 text-white'
              : 'bg-surface-700 text-surface-400'}"
        >
          {#if currentStep > step}
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          {:else}
            {step}
          {/if}
        </div>
        <span
          class="hidden text-sm sm:block
					{currentStep === step ? 'text-white font-medium' : 'text-surface-400'}"
        >
          {#if step === 1}Upload{:else if step === 2}Configure{:else if step === 3}Preview{:else}Import{/if}
        </span>
      </div>
      {#if step < 4}
        <div class="h-px flex-1 bg-surface-700"></div>
      {/if}
    {/each}
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- STEP 1: Upload -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  {#if currentStep === 1}
    <Card>
      <form
        method="POST"
        action="?/upload"
        enctype="multipart/form-data"
        use:enhance={() => {
          isLoading = true;
          return async ({ update }) => {
            isLoading = false;
            await update();
          };
        }}
      >
        <!-- Drop zone -->
        <div
          class="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 transition
					{isDragging
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-surface-600 bg-surface-750 hover:border-surface-500'}"
          role="button"
          tabindex="0"
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          onclick={() => document.getElementById('fileInput')?.click()}
          onkeydown={(e) => e.key === 'Enter' && document.getElementById('fileInput')?.click()}
        >
          <input
            id="fileInput"
            name="file"
            type="file"
            accept=".csv,.ofx,.qfx"
            class="hidden"
            onchange={handleFileInput}
          />

          {#if selectedFile}
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600/20">
                <svg
                  class="h-6 w-6 text-primary-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p class="font-medium text-white">{selectedFile.name}</p>
                <p class="text-sm text-surface-400">
                  {getFileTypeLabel(selectedFile.name)} - {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                aria-label="Remove selected file"
                type="button"
                class="ml-4 text-surface-400 hover:text-red-400"
                onclick={(e) => {
                  e.stopPropagation();
                  selectedFile = null;
                  const input = document.getElementById('fileInput') as HTMLInputElement;
                  if (input) input.value = '';
                }}
              >
                <svg
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {:else}
            <svg
              class="h-12 w-12 text-surface-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p class="mt-3 text-sm text-surface-300">
              <span class="font-medium text-primary-400">Click to browse</span> or drag & drop
            </p>
            <p class="mt-1 text-xs text-surface-500">Supports .csv, .ofx, .qfx files (max 10MB)</p>
          {/if}
        </div>

        {#if selectedFile}
          <div class="mt-4 flex justify-end">
            <Button type="submit" loading={isLoading}>
              {isLoading ? 'Parsing file...' : 'Upload & Parse'}
            </Button>
          </div>
        {/if}
      </form>
    </Card>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- STEP 2: Configuration -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  {#if currentStep === 2 && uploadResult}
    <form
      method="POST"
      action="?/preview"
      use:enhance={() => {
        isLoading = true;
        return async ({ update }) => {
          isLoading = false;
          await update();
        };
      }}
    >
      <input type="hidden" name="transactions" value={JSON.stringify(uploadResult.transactions)} />

      <div class="space-y-4">
        <!-- Account Selection -->
        <Card>
          <h3 class="mb-3 text-lg font-semibold text-white">Select Target Account</h3>
          <select
            name="accountId"
            bind:value={selectedAccountId}
            required
            class="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Choose an account...</option>
            {#each data.accounts as account}
              <option value={account.id}>
                {account.name}
                {#if account.institutionName}
                  ({account.institutionName}){/if}
              </option>
            {/each}
          </select>
        </Card>

        <!-- CSV Column Mapping (only for CSV files) -->
        {#if uploadResult.fileType === 'csv' && uploadResult.headers}
          <Card>
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">Column Mapping</h3>
              {#if detectedFormat && detectedFormat !== 'custom'}
                <span
                  class="rounded-full bg-green-900/50 px-3 py-1 text-xs font-medium text-green-400"
                >
                  Auto-detected: {detectedFormat === 'mint'
                    ? 'Mint'
                    : detectedFormat === 'ynab'
                      ? 'YNAB'
                      : detectedFormat === 'bank_debit_credit'
                        ? 'Bank (Debit/Credit)'
                        : 'Generic'}
                </span>
              {/if}
            </div>

            <!-- Format preset buttons -->
            <div class="mb-4 flex flex-wrap gap-2">
              <span class="self-center text-sm text-surface-400">Presets:</span>
              {#each ['generic', 'mint', 'ynab', 'bank_debit_credit'] as preset}
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-medium transition
									{detectedFormat === preset
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}"
                  onclick={() => {
                    detectedFormat = preset;
                    // Re-parse would be ideal, but we use what we have
                  }}
                >
                  {preset === 'generic'
                    ? 'Generic'
                    : preset === 'mint'
                      ? 'Mint'
                      : preset === 'ynab'
                        ? 'YNAB'
                        : 'Bank (Debit/Credit)'}
                </button>
              {/each}
            </div>

            <!-- Column mapping dropdowns -->
            {#if columnMapping}
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label for="col-date" class="mb-1 block text-xs text-surface-400"
                    >Date Column</label
                  >
                  <select
                    id="col-date"
                    class="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
                    value={columnMapping.date}
                    onchange={(e) =>
                      updateMapping('date', parseInt((e.target as HTMLSelectElement).value))}
                  >
                    {#each uploadResult.headers as header, i}
                      <option value={i}>{header}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label for="col-description" class="mb-1 block text-xs text-surface-400"
                    >Description Column</label
                  >
                  <select
                    id="col-description"
                    class="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
                    value={columnMapping.description}
                    onchange={(e) =>
                      updateMapping('description', parseInt((e.target as HTMLSelectElement).value))}
                  >
                    {#each uploadResult.headers as header, i}
                      <option value={i}>{header}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label for="col-amount" class="mb-1 block text-xs text-surface-400"
                    >Amount Column</label
                  >
                  <select
                    id="col-amount"
                    class="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
                    value={columnMapping.amount}
                    onchange={(e) =>
                      updateMapping('amount', parseInt((e.target as HTMLSelectElement).value))}
                  >
                    <option value={-1}>N/A (use Debit/Credit)</option>
                    {#each uploadResult.headers as header, i}
                      <option value={i}>{header}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label for="col-category" class="mb-1 block text-xs text-surface-400"
                    >Category Column</label
                  >
                  <select
                    id="col-category"
                    class="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
                    value={columnMapping.category ?? -1}
                    onchange={(e) => {
                      const val = parseInt((e.target as HTMLSelectElement).value);
                      updateMapping('category', val >= 0 ? val : -1);
                    }}
                  >
                    <option value={-1}>Skip</option>
                    {#each uploadResult.headers as header, i}
                      <option value={i}>{header}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {/if}

            <!-- Data Preview (first 3 rows) -->
            {#if uploadResult.rows && uploadResult.rows.length > 0}
              <div class="mt-4">
                <p class="mb-2 text-sm font-medium text-surface-300">Data Preview</p>
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead>
                      <tr class="border-b border-surface-700">
                        {#each uploadResult.headers as header}
                          <th
                            class="whitespace-nowrap px-3 py-2 text-xs font-medium uppercase text-surface-400"
                          >
                            {header}
                          </th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-700">
                      {#each uploadResult.rows.slice(0, 3) as row}
                        <tr>
                          {#each row as cell}
                            <td class="whitespace-nowrap px-3 py-2 text-surface-300">{cell}</td>
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/if}
          </Card>
        {:else if uploadResult.fileType === 'ofx' || uploadResult.fileType === 'qfx'}
          <Card>
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-900/50">
                <svg
                  class="h-5 w-5 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-white">OFX/QFX file parsed successfully</p>
                <p class="text-sm text-surface-400">
                  Found {uploadResult.transactions.length} transactions
                </p>
              </div>
            </div>
          </Card>
        {/if}

        <!-- File Info -->
        <Card>
          <div class="flex items-center gap-3 text-sm text-surface-400">
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              <strong class="text-surface-300">{uploadResult.fileName}</strong> -
              {uploadResult.transactions.length} transaction{uploadResult.transactions.length !== 1
                ? 's'
                : ''} found
            </span>
          </div>
        </Card>

        <!-- Navigation -->
        <div class="flex justify-between">
          <Button
            variant="secondary"
            onclick={() => {
              currentStep = 1;
            }}
          >
            Back
          </Button>
          <Button type="submit" loading={isLoading} disabled={!selectedAccountId}>
            {isLoading ? 'Generating preview...' : 'Preview Import'}
          </Button>
        </div>
      </div>
    </form>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- STEP 3: Preview -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  {#if currentStep === 3}
    <div class="space-y-4">
      <!-- Summary -->
      <div class="grid gap-4 sm:grid-cols-3">
        <Card>
          <div class="text-center">
            <p class="text-2xl font-bold text-green-400">{newCount}</p>
            <p class="text-sm text-surface-400">New transactions</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <p class="text-2xl font-bold text-yellow-400">{duplicateCount}</p>
            <p class="text-sm text-surface-400">Duplicates detected</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <p class="text-2xl font-bold text-primary-400">{selectedCount}</p>
            <p class="text-sm text-surface-400">Selected for import</p>
          </div>
        </Card>
      </div>

      <!-- Transaction Preview Table -->
      <Card padding="none">
        <div class="border-b border-surface-700 px-6 py-3">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white">Transactions to Import</h3>
            <label class="flex items-center gap-2 text-sm text-surface-300">
              <input
                type="checkbox"
                checked={selectAll}
                onchange={toggleAll}
                class="rounded border-surface-500 bg-surface-700 text-primary-600 focus:ring-primary-500"
              />
              Select all
            </label>
          </div>
        </div>

        <div class="max-h-96 overflow-y-auto">
          <!-- Table header -->
          <div
            class="sticky top-0 grid grid-cols-12 gap-4 border-b border-surface-700 bg-surface-800 px-6 py-2"
          >
            <div class="col-span-1 text-xs font-medium uppercase text-surface-400">Select</div>
            <div class="col-span-2 text-xs font-medium uppercase text-surface-400">Date</div>
            <div class="col-span-5 text-xs font-medium uppercase text-surface-400">Description</div>
            <div class="col-span-2 text-right text-xs font-medium uppercase text-surface-400">
              Amount
            </div>
            <div class="col-span-2 text-right text-xs font-medium uppercase text-surface-400">
              Status
            </div>
          </div>

          <div class="divide-y divide-surface-700">
            {#each previewRows as row, idx}
              <div
                class="grid grid-cols-12 items-center gap-4 px-6 py-2.5 transition
								{row.isDuplicate ? 'bg-yellow-900/10' : ''}
								{!row.selected ? 'opacity-50' : ''}"
              >
                <div class="col-span-1">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onchange={() => toggleRow(idx)}
                    class="rounded border-surface-500 bg-surface-700 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div class="col-span-2 text-sm text-surface-300">
                  {formatDate(row.date)}
                </div>
                <div class="col-span-5">
                  <p class="text-sm font-medium text-white">{row.name}</p>
                  {#if row.memo}
                    <p class="text-xs text-surface-500">{row.memo}</p>
                  {/if}
                </div>
                <div class="col-span-2 text-right">
                  <span
                    class="text-sm font-semibold {row.amount < 0 ? 'text-green-400' : 'text-white'}"
                  >
                    {formatAmount(row.amount)}
                  </span>
                </div>
                <div class="col-span-2 text-right">
                  {#if row.isDuplicate}
                    <span
                      class="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs font-medium text-yellow-400"
                    >
                      Duplicate
                    </span>
                  {:else}
                    <span
                      class="rounded-full bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-400"
                    >
                      New
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </Card>

      <!-- Navigation -->
      <div class="flex justify-between">
        <Button
          variant="secondary"
          onclick={() => {
            currentStep = 2;
          }}
        >
          Back
        </Button>
        <form
          method="POST"
          action="?/execute"
          use:enhance={() => {
            isLoading = true;
            return async ({ update }) => {
              isLoading = false;
              await update();
              invalidateAll();
            };
          }}
        >
          <input type="hidden" name="accountId" value={selectedAccountId} />
          <input
            type="hidden"
            name="transactions"
            value={JSON.stringify(getSelectedTransactions())}
          />
          <input type="hidden" name="fileName" value={uploadResult?.fileName || ''} />
          <input type="hidden" name="fileType" value={uploadResult?.fileType || ''} />
          <input type="hidden" name="skipDuplicates" value="true" />
          {#if columnMapping}
            <input type="hidden" name="columnMapping" value={JSON.stringify(columnMapping)} />
          {/if}
          <Button type="submit" loading={isLoading} disabled={selectedCount === 0}>
            {isLoading
              ? 'Importing...'
              : `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        </form>
      </div>
    </div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- STEP 4: Results -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  {#if currentStep === 4 && importResult}
    <Card>
      <div class="flex flex-col items-center py-8 text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/50">
          <svg
            class="h-8 w-8 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 class="mt-4 text-xl font-bold text-white">Import Complete</h3>
        <p class="mt-2 text-surface-400">Your transactions have been imported successfully.</p>

        <!-- Stats -->
        <div class="mt-6 grid w-full max-w-md grid-cols-2 gap-4 sm:grid-cols-4">
          <div class="rounded-lg bg-surface-750 p-3">
            <p class="text-lg font-bold text-white">{importResult.totalRows}</p>
            <p class="text-xs text-surface-400">Total</p>
          </div>
          <div class="rounded-lg bg-surface-750 p-3">
            <p class="text-lg font-bold text-green-400">{importResult.importedCount}</p>
            <p class="text-xs text-surface-400">Imported</p>
          </div>
          <div class="rounded-lg bg-surface-750 p-3">
            <p class="text-lg font-bold text-yellow-400">{importResult.duplicateCount}</p>
            <p class="text-xs text-surface-400">Duplicates</p>
          </div>
          <div class="rounded-lg bg-surface-750 p-3">
            <p class="text-lg font-bold text-surface-400">{importResult.skippedCount}</p>
            <p class="text-xs text-surface-400">Skipped</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-6 flex gap-3">
          <Button variant="secondary" onclick={resetWizard}>Import More</Button>
          <a
            href="/transactions"
            class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            View Transactions
          </a>
        </div>
      </div>
    </Card>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- Import History -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  {#if currentStep === 1 && data.history && data.history.length > 0}
    <div>
      <h3 class="mb-3 text-lg font-semibold text-white">Import History</h3>
      <Card padding="none">
        <div class="divide-y divide-surface-700">
          {#each data.history as entry}
            <div class="flex items-center justify-between px-6 py-3">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700">
                  <svg
                    class="h-5 w-5 text-surface-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="font-medium text-white">{entry.fileName}</p>
                  <p class="text-xs text-surface-400">
                    {entry.fileType.toUpperCase()} -
                    {entry.accountName || 'Unknown account'} -
                    {formatImportDate(entry.importedAt)}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-4 text-sm">
                <span class="text-green-400">{entry.importedCount} imported</span>
                {#if entry.duplicateCount > 0}
                  <span class="text-yellow-400">{entry.duplicateCount} duplicates</span>
                {/if}
                {#if entry.skippedCount > 0}
                  <span class="text-surface-400">{entry.skippedCount} skipped</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </Card>
    </div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- Supported Formats Info (on step 1) -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  {#if currentStep === 1}
    <div>
      <h3 class="mb-3 text-lg font-semibold text-white">Supported Formats</h3>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.formats as fmt}
          <Card>
            <h4 class="font-medium text-white">{fmt.name}</h4>
            <p class="mt-1 text-xs text-surface-400">{fmt.description}</p>
            <div class="mt-2 flex flex-wrap gap-1">
              {#each fmt.expectedColumns as col}
                <span class="rounded bg-surface-700 px-1.5 py-0.5 text-xs text-surface-300">
                  {col}
                </span>
              {/each}
            </div>
          </Card>
        {/each}
      </div>
    </div>
  {/if}
</div>
