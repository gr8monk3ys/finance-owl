<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import { Button, Card, Input, Modal } from '$components/ui';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // -- Create category state --
  let showCreateModal = $state(false);
  let createLoading = $state(false);
  let newCategoryName = $state('');
  let newCategoryColor = $state('#6366f1');
  let newCategoryIcon = $state('');
  let newCategoryParent = $state('');

  // -- Edit category state --
  let editingCategory = $state<any>(null);
  let editLoading = $state(false);
  let editName = $state('');
  let editColor = $state('');
  let editIcon = $state('');

  // -- Delete category state --
  let deleteConfirmId = $state<string | null>(null);
  let deleteLoading = $state(false);

  // -- Rule state --
  let showRuleModal = $state(false);
  let ruleLoading = $state(false);
  let newRuleCategoryId = $state('');
  let newRuleMatchType = $state('merchant');
  let newRuleMatchValue = $state('');
  let deleteRuleConfirmId = $state<string | null>(null);
  let deleteRuleLoading = $state(false);

  const iconOptions = [
    'utensils',
    'car',
    'shopping-bag',
    'home',
    'zap',
    'heart',
    'film',
    'user',
    'graduation-cap',
    'plane',
    'wallet',
    'landmark',
    'gift',
    'paw-print',
    'coffee',
    'music',
    'book',
    'briefcase',
    'phone',
    'wifi',
    'star',
    'tag',
    'credit-card',
    'percent',
  ];

  const presetColors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#ec4899',
    '#e11d48',
    '#64748b',
    '#71717a',
    '#94a3b8',
  ];

  const matchTypeLabels: Record<string, string> = {
    merchant: 'Merchant name',
    description: 'Description contains',
    regex: 'Regex pattern',
    amount_range: 'Amount range',
  };

  const parentCategories = $derived(data.categories.filter((c: any) => !c.parentId));

  const userCategories = $derived(data.categories.filter((c: any) => c.userId && !c.isSystem));

  function getCategoryName(id: string): string {
    const cat = data.categories.find((c: any) => c.id === id);
    return cat?.name || 'Unknown';
  }

  function getCategoryColor(id: string): string {
    const cat = data.categories.find((c: any) => c.id === id);
    return cat?.color || '#71717a';
  }

  function openEditModal(category: any) {
    editingCategory = category;
    editName = category.name;
    editColor = category.color || '#6366f1';
    editIcon = category.icon || '';
  }

  function closeEditModal() {
    editingCategory = null;
    editName = '';
    editColor = '';
    editIcon = '';
  }

  function resetCreateModal() {
    showCreateModal = false;
    newCategoryName = '';
    newCategoryColor = '#6366f1';
    newCategoryIcon = '';
    newCategoryParent = '';
  }

  function resetRuleModal() {
    showRuleModal = false;
    newRuleCategoryId = '';
    newRuleMatchType = 'merchant';
    newRuleMatchValue = '';
  }

  // Close modals on success
  $effect(() => {
    if (form?.categorySuccess) resetCreateModal();
    if (form?.categoryUpdateSuccess) closeEditModal();
    if (form?.ruleSuccess) resetRuleModal();
  });
</script>

<svelte:head>
  <title>Categories - Finance Owl</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
  <div class="flex items-center gap-3">
    <a
      href="/settings"
      class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition hover:bg-surface-700 hover:text-white"
      aria-label="Back to settings"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <div class="flex-1">
      <h1 class="text-2xl font-bold text-white">Categories</h1>
      <p class="mt-0.5 text-sm text-surface-400">
        Manage your transaction categories and auto-categorization rules.
      </p>
    </div>
  </div>

  <!-- Global messages -->
  {#if form?.categorySuccess}
    <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
      Category created successfully.
    </div>
  {/if}
  {#if form?.categoryUpdateSuccess}
    <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
      Category updated successfully.
    </div>
  {/if}
  {#if form?.categoryDeleteSuccess}
    <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">Category deleted.</div>
  {/if}
  {#if form?.categoryError}
    <div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
      {form.categoryError}
    </div>
  {/if}

  <!-- ==================== CATEGORIES LIST ==================== -->
  <Card padding="none">
    <div class="flex items-center justify-between border-b border-surface-700 px-6 py-4">
      <h2 class="text-lg font-semibold text-white">Your Categories</h2>
      <Button size="sm" onclick={() => (showCreateModal = true)}>
        <svg
          class="mr-1.5 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New Category
      </Button>
    </div>

    <div class="divide-y divide-surface-700/50">
      {#each parentCategories as category (category.id)}
        {@const children = data.categories.filter((c: any) => c.parentId === category.id)}
        <div>
          <!-- Parent category row -->
          <div class="flex items-center justify-between px-6 py-3">
            <div class="flex items-center gap-3">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                style="background-color: {category.color || '#71717a'}20; color: {category.color ||
                  '#71717a'}"
              >
                <span
                  class="h-3 w-3 rounded-full"
                  style="background-color: {category.color || '#71717a'}"
                ></span>
              </span>
              <div>
                <p class="text-sm font-medium text-white">{category.name}</p>
                {#if category.icon}
                  <p class="text-xs text-surface-500">{category.icon}</p>
                {/if}
              </div>
              {#if category.isSystem && !category.userId}
                <span
                  class="rounded-full bg-surface-700 px-1.5 py-0.5 text-[10px] font-medium text-surface-400"
                >
                  System
                </span>
              {/if}
            </div>

            {#if category.userId && !category.isSystem}
              <div class="flex items-center gap-1">
                {#if deleteConfirmId === category.id}
                  <span class="mr-2 text-xs text-surface-400">Delete?</span>
                  <form
                    method="POST"
                    action="?/deleteCategory"
                    use:enhance={() => {
                      deleteLoading = true;
                      return async ({ update }) => {
                        deleteLoading = false;
                        deleteConfirmId = null;
                        await update();
                      };
                    }}
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <Button variant="danger" size="sm" type="submit" loading={deleteLoading}>
                      Confirm
                    </Button>
                  </form>
                  <Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = null)}>
                    Cancel
                  </Button>
                {:else}
                  <Button variant="ghost" size="sm" onclick={() => openEditModal(category)}>
                    <svg
                      class="h-4 w-4 text-surface-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                  </Button>
                  <Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = category.id)}>
                    <svg
                      class="h-4 w-4 text-surface-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </Button>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Child categories -->
          {#if children.length > 0}
            <div class="ml-11 border-l border-surface-700/50">
              {#each children as child (child.id)}
                <div class="flex items-center justify-between py-2 pl-4 pr-6">
                  <div class="flex items-center gap-2">
                    <span
                      class="h-2 w-2 rounded-full"
                      style="background-color: {child.color || category.color || '#71717a'}"
                    ></span>
                    <span class="text-sm text-surface-300">{child.name}</span>
                    {#if child.isSystem && !child.userId}
                      <span
                        class="rounded-full bg-surface-700 px-1.5 py-0.5 text-[10px] font-medium text-surface-400"
                      >
                        System
                      </span>
                    {/if}
                  </div>

                  {#if child.userId && !child.isSystem}
                    <div class="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onclick={() => openEditModal(child)}>
                        <svg
                          class="h-3.5 w-3.5 text-surface-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                          />
                        </svg>
                      </Button>
                      <form
                        method="POST"
                        action="?/deleteCategory"
                        use:enhance={() => {
                          return async ({ update }) => {
                            await update();
                          };
                        }}
                      >
                        <input type="hidden" name="id" value={child.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          <svg
                            class="h-3.5 w-3.5 text-surface-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </Button>
                      </form>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if data.categories.length === 0}
      <div class="px-6 py-8 text-center">
        <svg
          class="mx-auto h-10 w-10 text-surface-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
          />
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
        <p class="mt-3 text-sm text-surface-400">No categories yet.</p>
        <p class="mt-1 text-xs text-surface-500">
          Create your first category to start organizing transactions.
        </p>
      </div>
    {/if}
  </Card>

  <!-- ==================== CREATE CATEGORY MODAL ==================== -->
  <Modal open={showCreateModal} onclose={resetCreateModal} title="New Category">
    <form
      method="POST"
      action="?/createCategory"
      use:enhance={() => {
        createLoading = true;
        return async ({ update }) => {
          createLoading = false;
          await update();
        };
      }}
    >
      <div class="space-y-4">
        <Input
          id="categoryName"
          name="name"
          label="Name"
          placeholder="e.g., Subscriptions"
          required
          bind:value={newCategoryName}
        />

        <!-- Color Picker -->
        <div>
          <span class="block text-sm font-medium text-surface-300">Color</span>
          <div class="mt-2 flex flex-wrap gap-2">
            {#each presetColors as color}
              <button
                type="button"
                class="h-7 w-7 rounded-full border-2 transition {newCategoryColor === color
                  ? 'border-white scale-110'
                  : 'border-transparent hover:border-surface-400'}"
                style="background-color: {color}"
                onclick={() => (newCategoryColor = color)}
                aria-label="Select color {color}"
              ></button>
            {/each}
          </div>
          <input type="hidden" name="color" value={newCategoryColor} />
        </div>

        <!-- Icon Selector -->
        <div>
          <span class="block text-sm font-medium text-surface-300">Icon</span>
          <div class="mt-2 flex flex-wrap gap-1.5">
            {#each iconOptions as icon}
              <button
                type="button"
                class="rounded-lg px-2.5 py-1.5 text-xs transition {newCategoryIcon === icon
                  ? 'bg-primary-600/30 text-primary-300 ring-1 ring-primary-500'
                  : 'bg-surface-700 text-surface-400 hover:bg-surface-600 hover:text-surface-200'}"
                onclick={() => (newCategoryIcon = icon)}
              >
                {icon}
              </button>
            {/each}
          </div>
          <input type="hidden" name="icon" value={newCategoryIcon} />
        </div>

        <!-- Parent Category -->
        <div>
          <label for="parentId" class="block text-sm font-medium text-surface-300">
            Parent Category (optional)
          </label>
          <select
            id="parentId"
            name="parentId"
            bind:value={newCategoryParent}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">None (top-level category)</option>
            {#each parentCategories as parent}
              <option value={parent.id}>{parent.name}</option>
            {/each}
          </select>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onclick={resetCreateModal}>Cancel</Button>
          <Button type="submit" loading={createLoading}>Create Category</Button>
        </div>
      </div>
    </form>
  </Modal>

  <!-- ==================== EDIT CATEGORY MODAL ==================== -->
  <Modal open={editingCategory !== null} onclose={closeEditModal} title="Edit Category">
    {#if editingCategory}
      <form
        method="POST"
        action="?/updateCategory"
        use:enhance={() => {
          editLoading = true;
          return async ({ update }) => {
            editLoading = false;
            await update();
          };
        }}
      >
        <input type="hidden" name="id" value={editingCategory.id} />

        <div class="space-y-4">
          <Input id="editCategoryName" name="name" label="Name" required bind:value={editName} />

          <!-- Color Picker -->
          <div>
            <span class="block text-sm font-medium text-surface-300">Color</span>
            <div class="mt-2 flex flex-wrap gap-2">
              {#each presetColors as color}
                <button
                  type="button"
                  class="h-7 w-7 rounded-full border-2 transition {editColor === color
                    ? 'border-white scale-110'
                    : 'border-transparent hover:border-surface-400'}"
                  style="background-color: {color}"
                  onclick={() => (editColor = color)}
                  aria-label="Select color {color}"
                ></button>
              {/each}
            </div>
            <input type="hidden" name="color" value={editColor} />
          </div>

          <!-- Icon Selector -->
          <div>
            <span class="block text-sm font-medium text-surface-300">Icon</span>
            <div class="mt-2 flex flex-wrap gap-1.5">
              {#each iconOptions as icon}
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1.5 text-xs transition {editIcon === icon
                    ? 'bg-primary-600/30 text-primary-300 ring-1 ring-primary-500'
                    : 'bg-surface-700 text-surface-400 hover:bg-surface-600 hover:text-surface-200'}"
                  onclick={() => (editIcon = icon)}
                >
                  {icon}
                </button>
              {/each}
            </div>
            <input type="hidden" name="icon" value={editIcon} />
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onclick={closeEditModal}>Cancel</Button>
            <Button type="submit" loading={editLoading}>Save Changes</Button>
          </div>
        </div>
      </form>
    {/if}
  </Modal>

  <!-- ==================== CATEGORIZATION RULES ==================== -->
  <Card padding="none">
    <div class="flex items-center justify-between border-b border-surface-700 px-6 py-4">
      <div>
        <h2 class="text-lg font-semibold text-white">Auto-Categorization Rules</h2>
        <p class="mt-0.5 text-sm text-surface-400">
          Automatically assign categories to transactions based on matching rules.
        </p>
      </div>
      <Button size="sm" onclick={() => (showRuleModal = true)}>
        <svg
          class="mr-1.5 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Rule
      </Button>
    </div>

    {#if form?.ruleSuccess}
      <div class="mx-6 mt-4 rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
        Rule created successfully.
      </div>
    {/if}
    {#if form?.ruleDeleteSuccess}
      <div class="mx-6 mt-4 rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
        Rule deleted.
      </div>
    {/if}
    {#if form?.ruleError}
      <div class="mx-6 mt-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
        {form.ruleError}
      </div>
    {/if}

    {#if data.rules.length === 0}
      <div class="px-6 py-8 text-center">
        <svg
          class="mx-auto h-10 w-10 text-surface-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
          />
        </svg>
        <p class="mt-3 text-sm text-surface-400">No categorization rules yet.</p>
        <p class="mt-1 text-xs text-surface-500">
          Create rules to automatically categorize new transactions.
        </p>
      </div>
    {:else}
      <div class="divide-y divide-surface-700/50">
        {#each data.rules as rule (rule.id)}
          <div class="flex items-center justify-between px-6 py-3">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <span
                  class="h-2.5 w-2.5 rounded-full"
                  style="background-color: {getCategoryColor(rule.categoryId)}"
                ></span>
                <span class="text-sm font-medium text-white">
                  {getCategoryName(rule.categoryId)}
                </span>
              </div>
              <svg
                class="h-4 w-4 text-surface-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
              <div>
                <span
                  class="rounded-md bg-surface-700 px-2 py-0.5 text-xs font-medium text-surface-300"
                >
                  {matchTypeLabels[rule.matchType] || rule.matchType}
                </span>
                <span class="ml-1.5 text-sm text-surface-300">
                  &ldquo;{rule.matchValue}&rdquo;
                </span>
              </div>
            </div>

            {#if deleteRuleConfirmId === rule.id}
              <div class="flex items-center gap-2">
                <span class="text-xs text-surface-400">Delete?</span>
                <form
                  method="POST"
                  action="?/deleteRule"
                  use:enhance={() => {
                    deleteRuleLoading = true;
                    return async ({ update }) => {
                      deleteRuleLoading = false;
                      deleteRuleConfirmId = null;
                      await update();
                    };
                  }}
                >
                  <input type="hidden" name="id" value={rule.id} />
                  <Button variant="danger" size="sm" type="submit" loading={deleteRuleLoading}>
                    Confirm
                  </Button>
                </form>
                <Button variant="ghost" size="sm" onclick={() => (deleteRuleConfirmId = null)}>
                  Cancel
                </Button>
              </div>
            {:else}
              <Button variant="ghost" size="sm" onclick={() => (deleteRuleConfirmId = rule.id)}>
                <svg
                  class="h-4 w-4 text-surface-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              </Button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- ==================== CREATE RULE MODAL ==================== -->
  <Modal open={showRuleModal} onclose={resetRuleModal} title="New Categorization Rule">
    <form
      method="POST"
      action="?/createRule"
      use:enhance={() => {
        ruleLoading = true;
        return async ({ update }) => {
          ruleLoading = false;
          await update();
        };
      }}
    >
      <div class="space-y-4">
        <!-- Target Category -->
        <div>
          <label for="ruleCategoryId" class="block text-sm font-medium text-surface-300">
            Assign to Category
          </label>
          <select
            id="ruleCategoryId"
            name="categoryId"
            bind:value={newRuleCategoryId}
            required
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="" disabled>Select a category</option>
            {#each data.categories as cat}
              <option value={cat.id}>
                {cat.parentId ? '  ' : ''}{cat.name}
              </option>
            {/each}
          </select>
        </div>

        <!-- Match Type -->
        <div>
          <label for="ruleMatchType" class="block text-sm font-medium text-surface-300">
            Match Type
          </label>
          <select
            id="ruleMatchType"
            name="matchType"
            bind:value={newRuleMatchType}
            required
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="merchant">Merchant name contains</option>
            <option value="description">Description contains</option>
            <option value="regex">Regex pattern</option>
            <option value="amount_range">Amount range</option>
          </select>
        </div>

        <!-- Match Value -->
        <Input
          id="ruleMatchValue"
          name="matchValue"
          label="Match Value"
          placeholder={newRuleMatchType === 'regex'
            ? '^AMZN.*'
            : newRuleMatchType === 'amount_range'
              ? '50-200'
              : 'Starbucks'}
          required
          bind:value={newRuleMatchValue}
        />

        <p class="text-xs text-surface-500">
          {#if newRuleMatchType === 'merchant'}
            Matches when the merchant name contains the value (case-insensitive).
          {:else if newRuleMatchType === 'description'}
            Matches when the transaction description contains the value.
          {:else if newRuleMatchType === 'regex'}
            Uses a regular expression pattern to match transaction descriptions.
          {:else}
            Matches transactions within the specified amount range (e.g. "50-200").
          {/if}
        </p>

        <div class="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onclick={resetRuleModal}>Cancel</Button>
          <Button type="submit" loading={ruleLoading}>Create Rule</Button>
        </div>
      </div>
    </form>
  </Modal>
</div>
