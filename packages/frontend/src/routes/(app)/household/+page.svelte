<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button, Modal } from '$components/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let showCreateModal = $state(false);
  let showJoinModal = $state(false);
  let showEditNameModal = $state(false);
  let showShareAccountModal = $state(false);
  let editingMember = $state<any>(null);
  let copiedCode = $state(false);
  let confirmLeave = $state(false);
  let confirmDelete = $state(false);
  let confirmRemoveMember = $state<any>(null);

  $effect(() => {
    if (form?.success) {
      invalidateAll();
      showCreateModal = false;
      showJoinModal = false;
      showEditNameModal = false;
      showShareAccountModal = false;
      editingMember = null;
      confirmLeave = false;
      confirmDelete = false;
      confirmRemoveMember = null;
    }
  });

  function copyInviteCode() {
    if (data.household?.inviteCode) {
      navigator.clipboard.writeText(data.household.inviteCode);
      copiedCode = true;
      setTimeout(() => (copiedCode = false), 2000);
    }
  }

  function getRoleBadgeColor(role: string): string {
    switch (role) {
      case 'owner':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
      case 'editor':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      default:
        return 'bg-surface-600 text-surface-300 border border-surface-500/30';
    }
  }

  function getRoleDescription(role: string): string {
    switch (role) {
      case 'owner':
        return 'Full access, can manage members and settings';
      case 'editor':
        return 'Can view and edit shared data';
      default:
        return 'Can view shared data only';
    }
  }

  const isOwner = $derived(
    data.household?.members?.some(
      (m: any) => m.userId === data.household?.ownerId && m.role === 'owner',
    ) && data.household?.ownerId !== undefined,
  );

  const memberCount = $derived(data.household?.members?.length ?? 0);

  // Accounts not yet shared
  const unsavedAccounts = $derived(
    data.accounts.filter((a: any) => !data.sharedAccounts.some((sa: any) => sa.accountId === a.id)),
  );
</script>

<svelte:head>
  <title>Household - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">Household</h2>
      <p class="mt-1 text-sm text-surface-400">
        {#if data.household}
          Manage your household members and shared accounts
        {:else}
          Collaborate with family members on shared finances
        {/if}
      </p>
    </div>
    {#if data.household}
      <div class="flex items-center gap-2">
        {#if isOwner}
          <Button variant="ghost" size="sm" onclick={() => (showEditNameModal = true)}>
            <svg
              class="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Rename
          </Button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Error -->
  {#if form?.error}
    <div class="flex items-center gap-3 rounded-lg bg-red-900/50 p-4 text-sm text-red-300">
      <svg
        class="h-5 w-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {form.error}
    </div>
  {/if}

  {#if !data.household}
    <!-- No household: show create/join options -->
    <div class="grid gap-6 sm:grid-cols-2">
      <Card>
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600/20">
            <svg
              class="h-8 w-8 text-primary-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <p class="mt-4 text-lg font-semibold text-white">Create a Household</p>
          <p class="mt-2 text-sm text-surface-400">
            Start a new household and invite family members to share accounts and track spending
            together.
          </p>
          <div class="mt-6">
            <Button onclick={() => (showCreateModal = true)}>Create Household</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-600/20">
            <svg
              class="h-8 w-8 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <p class="mt-4 text-lg font-semibold text-white">Join a Household</p>
          <p class="mt-2 text-sm text-surface-400">
            Have an invite code? Join an existing household to view shared accounts and collaborate.
          </p>
          <div class="mt-6">
            <Button variant="secondary" onclick={() => (showJoinModal = true)}>
              Join with Code
            </Button>
          </div>
        </div>
      </Card>
    </div>
  {:else}
    <!-- Household selector (if multiple) -->
    {#if data.households.length > 1}
      <div
        class="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-3"
      >
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
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span class="text-sm text-surface-300">
          You belong to {data.households.length} households. Viewing:
          <strong class="text-white">{data.household.name}</strong>
        </span>
      </div>
    {/if}

    <!-- Household exists: show details -->
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Household Info -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Household Card -->
        <Card>
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600/20">
                <svg
                  class="h-6 w-6 text-primary-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-white">{data.household.name}</h3>
                <p class="mt-0.5 text-sm text-surface-400">
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                  {#if data.sharedAccounts.length > 0}
                    -- {data.sharedAccounts.length} shared account{data.sharedAccounts.length !== 1
                      ? 's'
                      : ''}
                  {/if}
                </p>
              </div>
            </div>
            {#if isOwner}
              <span
                class="rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-medium text-yellow-300 border border-yellow-500/25"
              >
                Owner
              </span>
            {/if}
          </div>

          <!-- Invite Code -->
          <div class="mt-5 rounded-lg border border-surface-700 bg-surface-900/50 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-surface-400">
                  Invite Code
                </p>
                {#if data.household.inviteCode}
                  <p class="mt-1.5 font-mono text-lg tracking-wider text-white">
                    {data.household.inviteCode}
                  </p>
                {:else}
                  <p class="mt-1.5 text-sm text-surface-500 italic">No invite code generated yet</p>
                {/if}
              </div>
              <div class="flex gap-2">
                {#if data.household.inviteCode}
                  <Button variant="ghost" size="sm" onclick={copyInviteCode}>
                    {#if copiedCode}
                      <svg
                        class="mr-1.5 h-4 w-4 text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    {:else}
                      <svg
                        class="mr-1.5 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    {/if}
                  </Button>
                {/if}
                {#if isOwner}
                  <form method="POST" action="?/generateInviteCode" use:enhance>
                    <input type="hidden" name="id" value={data.household.id} />
                    <Button variant="secondary" size="sm" type="submit">
                      {data.household.inviteCode ? 'Regenerate' : 'Generate'}
                    </Button>
                  </form>
                {/if}
              </div>
            </div>
            <p class="mt-2 text-xs text-surface-500">
              Share this code with family members so they can join your household.
            </p>
          </div>
        </Card>

        <!-- Members -->
        <Card>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white">Members</h3>
            <span
              class="rounded-full bg-surface-700 px-2.5 py-1 text-xs font-medium text-surface-300"
            >
              {memberCount}
            </span>
          </div>
          <div class="mt-4 divide-y divide-surface-700">
            {#each data.household.members ?? [] as member}
              <div class="flex items-center justify-between py-3.5">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white"
                  >
                    {member.userName?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p class="font-medium text-white">{member.userName}</p>
                    <p class="text-xs text-surface-400">{member.userEmail}</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span
                    class="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize {getRoleBadgeColor(
                      member.role,
                    )}"
                  >
                    {member.role}
                  </span>
                  {#if isOwner && member.role !== 'owner'}
                    <div class="flex items-center gap-1">
                      <button
                        class="rounded-lg p-1.5 text-surface-400 transition hover:bg-surface-700 hover:text-white"
                        onclick={() => (editingMember = member)}
                        title="Change role"
                      >
                        <svg
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        class="rounded-lg p-1.5 text-surface-400 transition hover:bg-red-900/30 hover:text-red-400"
                        onclick={() => (confirmRemoveMember = member)}
                        title="Remove member"
                      >
                        <svg
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
                          />
                        </svg>
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Shared Accounts -->
        <Card>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white">Shared Accounts</h3>
            {#if unsavedAccounts.length > 0}
              <Button variant="ghost" size="sm" onclick={() => (showShareAccountModal = true)}>
                <svg
                  class="mr-1 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Share
              </Button>
            {/if}
          </div>

          {#if data.sharedAccounts.length === 0}
            <div class="mt-4 flex flex-col items-center py-4 text-center">
              <svg
                class="h-10 w-10 text-surface-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p class="mt-3 text-sm text-surface-400">No accounts shared yet.</p>
              <p class="mt-1 text-xs text-surface-500">
                Share an account to let household members see transactions.
              </p>
              {#if unsavedAccounts.length > 0}
                <Button
                  variant="secondary"
                  size="sm"
                  class="mt-3"
                  onclick={() => (showShareAccountModal = true)}
                >
                  Share an Account
                </Button>
              {/if}
            </div>
          {:else}
            <div class="mt-4 space-y-2">
              {#each data.sharedAccounts as sa}
                <div
                  class="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-900/50 p-3"
                >
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-white">{sa.accountName}</p>
                    <p class="mt-0.5 truncate text-xs text-surface-400">
                      {sa.institutionName ?? sa.accountType}
                      <span class="text-surface-500"> -- shared by {sa.sharedByName}</span>
                    </p>
                  </div>
                  <form method="POST" action="?/unshareAccount" use:enhance>
                    <input type="hidden" name="householdId" value={data.household.id} />
                    <input type="hidden" name="accountId" value={sa.accountId} />
                    <button
                      type="submit"
                      class="ml-2 rounded-lg p-1.5 text-surface-400 transition hover:bg-red-900/30 hover:text-red-400"
                      title="Unshare account"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                      </svg>
                    </button>
                  </form>
                </div>
              {/each}
            </div>
          {/if}
        </Card>

        <!-- Actions -->
        <Card>
          <h3 class="text-lg font-semibold text-white">Household Actions</h3>
          <div class="mt-4 space-y-3">
            {#if !isOwner}
              <button
                class="flex w-full items-center gap-3 rounded-lg border border-surface-700 p-3 text-left transition hover:border-red-700 hover:bg-red-900/20"
                onclick={() => (confirmLeave = true)}
              >
                <svg
                  class="h-5 w-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <div>
                  <p class="text-sm font-medium text-red-400">Leave Household</p>
                  <p class="text-xs text-surface-500">Remove yourself from this household</p>
                </div>
              </button>
            {:else}
              <button
                class="flex w-full items-center gap-3 rounded-lg border border-surface-700 p-3 text-left transition hover:border-red-700 hover:bg-red-900/20"
                onclick={() => (confirmDelete = true)}
              >
                <svg
                  class="h-5 w-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <div>
                  <p class="text-sm font-medium text-red-400">Delete Household</p>
                  <p class="text-xs text-surface-500">
                    Permanently delete this household and all shared data
                  </p>
                </div>
              </button>
            {/if}
          </div>
        </Card>
      </div>
    </div>
  {/if}
</div>

<!-- Create Household Modal -->
<Modal open={showCreateModal} onclose={() => (showCreateModal = false)} title="Create Household">
  <form
    method="POST"
    action="?/create"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="householdName" class="block text-sm font-medium text-surface-300">
        Household Name
      </label>
      <input
        id="householdName"
        name="name"
        type="text"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="e.g., My Family"
      />
      <p class="mt-1.5 text-xs text-surface-500">
        Choose a name that your household members will recognize.
      </p>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showCreateModal = false)}>
        Cancel
      </Button>
      <Button type="submit">Create</Button>
    </div>
  </form>
</Modal>

<!-- Join Household Modal -->
<Modal open={showJoinModal} onclose={() => (showJoinModal = false)} title="Join Household">
  <form
    method="POST"
    action="?/join"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="inviteCode" class="block text-sm font-medium text-surface-300">
        Invite Code
      </label>
      <input
        id="inviteCode"
        name="inviteCode"
        type="text"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 font-mono tracking-wider text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="Enter invite code"
      />
      <p class="mt-1.5 text-xs text-surface-500">Ask the household owner for the invite code.</p>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showJoinModal = false)}>Cancel</Button>
      <Button type="submit">Join</Button>
    </div>
  </form>
</Modal>

<!-- Edit Household Name Modal -->
<Modal
  open={showEditNameModal}
  onclose={() => (showEditNameModal = false)}
  title="Rename Household"
>
  {#if data.household}
    <form
      method="POST"
      action="?/updateName"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
        };
      }}
      class="space-y-4"
    >
      <input type="hidden" name="id" value={data.household.id} />
      <div>
        <label for="editHouseholdName" class="block text-sm font-medium text-surface-300">
          Name
        </label>
        <input
          id="editHouseholdName"
          name="name"
          type="text"
          required
          value={data.household.name}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <Button variant="ghost" type="button" onclick={() => (showEditNameModal = false)}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  {/if}
</Modal>

<!-- Share Account Modal -->
<Modal
  open={showShareAccountModal}
  onclose={() => (showShareAccountModal = false)}
  title="Share Account with Household"
>
  {#if data.household}
    {#if unsavedAccounts.length === 0}
      <div class="flex flex-col items-center py-4 text-center">
        <svg
          class="h-12 w-12 text-surface-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p class="mt-3 text-sm text-surface-300">All your accounts are already shared.</p>
      </div>
      <div class="mt-4 flex justify-end">
        <Button variant="ghost" onclick={() => (showShareAccountModal = false)}>Close</Button>
      </div>
    {:else}
      <form
        method="POST"
        action="?/shareAccount"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
          };
        }}
        class="space-y-4"
      >
        <input type="hidden" name="householdId" value={data.household.id} />
        <div>
          <label for="shareAccountId" class="block text-sm font-medium text-surface-300">
            Select Account
          </label>
          <select
            id="shareAccountId"
            name="accountId"
            required
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {#each unsavedAccounts as account}
              <option value={account.id}>
                {account.name} ({account.institutionName ?? account.type})
              </option>
            {/each}
          </select>
          <p class="mt-1.5 text-xs text-surface-500">
            Household members will be able to view transactions for this account.
          </p>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <Button variant="ghost" type="button" onclick={() => (showShareAccountModal = false)}>
            Cancel
          </Button>
          <Button type="submit">Share Account</Button>
        </div>
      </form>
    {/if}
  {/if}
</Modal>

<!-- Edit Member Role Modal -->
<Modal
  open={editingMember !== null}
  onclose={() => (editingMember = null)}
  title="Change Member Role"
>
  {#if editingMember && data.household}
    <div class="space-y-4">
      <div class="flex items-center gap-3 rounded-lg bg-surface-700/50 p-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white"
        >
          {editingMember.userName?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div>
          <p class="font-medium text-white">{editingMember.userName}</p>
          <p class="text-xs text-surface-400">{editingMember.userEmail}</p>
        </div>
      </div>

      <form
        method="POST"
        action="?/updateRole"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
          };
        }}
        class="space-y-4"
      >
        <input type="hidden" name="householdId" value={data.household.id} />
        <input type="hidden" name="memberId" value={editingMember.id} />
        <div>
          <label for="memberRole" class="block text-sm font-medium text-surface-300"> Role </label>
          <select
            id="memberRole"
            name="role"
            required
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="editor" selected={editingMember.role === 'editor'}>Editor</option>
            <option value="viewer" selected={editingMember.role === 'viewer'}>Viewer</option>
          </select>
          <p class="mt-1.5 text-xs text-surface-500">
            {editingMember.role === 'editor'
              ? getRoleDescription('editor')
              : getRoleDescription('viewer')}
          </p>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <Button variant="ghost" type="button" onclick={() => (editingMember = null)}>
            Cancel
          </Button>
          <Button type="submit">Save Role</Button>
        </div>
      </form>
    </div>
  {/if}
</Modal>

<!-- Confirm Remove Member Modal -->
<Modal
  open={confirmRemoveMember !== null}
  onclose={() => (confirmRemoveMember = null)}
  title="Remove Member"
>
  {#if confirmRemoveMember && data.household}
    <div class="space-y-4">
      <div class="flex items-center gap-3 rounded-lg border border-red-700/30 bg-red-900/20 p-4">
        <svg
          class="h-6 w-6 flex-shrink-0 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p class="font-medium text-red-300">
            Remove {confirmRemoveMember.userName} from the household?
          </p>
          <p class="mt-1 text-sm text-surface-400">
            They will lose access to all shared accounts and data. This action cannot be undone.
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <Button variant="ghost" onclick={() => (confirmRemoveMember = null)}>Cancel</Button>
        <form method="POST" action="?/removeMember" use:enhance>
          <input type="hidden" name="householdId" value={data.household.id} />
          <input type="hidden" name="memberId" value={confirmRemoveMember.id} />
          <Button type="submit" variant="danger">Remove Member</Button>
        </form>
      </div>
    </div>
  {/if}
</Modal>

<!-- Confirm Leave Household Modal -->
<Modal open={confirmLeave} onclose={() => (confirmLeave = false)} title="Leave Household">
  {#if data.household}
    <div class="space-y-4">
      <div class="flex items-center gap-3 rounded-lg border border-red-700/30 bg-red-900/20 p-4">
        <svg
          class="h-6 w-6 flex-shrink-0 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        <div>
          <p class="font-medium text-red-300">
            Leave "{data.household.name}"?
          </p>
          <p class="mt-1 text-sm text-surface-400">
            You will lose access to all shared accounts and data. You can rejoin later with a new
            invite code.
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <Button variant="ghost" onclick={() => (confirmLeave = false)}>Cancel</Button>
        <form method="POST" action="?/leave" use:enhance>
          <input type="hidden" name="id" value={data.household.id} />
          <Button type="submit" variant="danger">Leave Household</Button>
        </form>
      </div>
    </div>
  {/if}
</Modal>

<!-- Confirm Delete Household Modal -->
<Modal open={confirmDelete} onclose={() => (confirmDelete = false)} title="Delete Household">
  {#if data.household}
    <div class="space-y-4">
      <div class="flex items-center gap-3 rounded-lg border border-red-700/30 bg-red-900/20 p-4">
        <svg
          class="h-6 w-6 flex-shrink-0 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        <div>
          <p class="font-medium text-red-300">
            Delete "{data.household.name}" permanently?
          </p>
          <p class="mt-1 text-sm text-surface-400">
            All members will be removed and all shared account connections will be dissolved. This
            action cannot be undone.
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <Button variant="ghost" onclick={() => (confirmDelete = false)}>Cancel</Button>
        <form method="POST" action="?/delete" use:enhance>
          <input type="hidden" name="id" value={data.household.id} />
          <Button type="submit" variant="danger">Delete Household</Button>
        </form>
      </div>
    </div>
  {/if}
</Modal>
