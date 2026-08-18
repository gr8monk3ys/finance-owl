<script lang="ts">
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  // Branding editor state
  let primaryColor = $state('#10b981');
  let accentColor = $state('#f59e0b');
  let appName = $state('Finance Owl');
  let logoUrl = $state('');
  let faviconUrl = $state('');

  // General settings state
  let tenantName = $state('');
  let customDomain = $state('');
  let plan = $state('');
  let maxUsers = $state(100);

  // Sync form state from props reactively
  $effect(() => {
    if (data.tenant) {
      primaryColor = data.tenant.primaryColor ?? '#10b981';
      accentColor = data.tenant.accentColor ?? '#f59e0b';
      appName = data.tenant.appName ?? 'Finance Owl';
      logoUrl = data.tenant.logoUrl ?? '';
      faviconUrl = data.tenant.faviconUrl ?? '';
      tenantName = data.tenant.name;
      customDomain = data.tenant.domain ?? '';
      plan = data.tenant.plan;
      maxUsers = data.tenant.maxUsers ?? 100;
    }
  });

  let saving = $state(false);
  let saveMessage = $state('');

  async function saveBranding() {
    saving = true;
    saveMessage = '';
    try {
      const res = await fetch(`/api/tenants/${data.tenant.id}/branding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryColor,
          accentColor,
          appName,
          logoUrl: logoUrl || null,
          faviconUrl: faviconUrl || null,
        }),
      });

      if (res.ok) {
        saveMessage = 'Branding saved successfully';
      } else {
        const err = await res.json();
        saveMessage = `Error: ${err.message || 'Failed to save'}`;
      }
    } catch {
      saveMessage = 'Error: Failed to save branding';
    }
    saving = false;
  }

  async function saveSettings() {
    saving = true;
    saveMessage = '';
    try {
      const res = await fetch(`/api/tenants/${data.tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tenantName,
          domain: customDomain || null,
          plan,
          maxUsers,
        }),
      });

      if (res.ok) {
        saveMessage = 'Settings saved successfully';
      } else {
        const err = await res.json();
        saveMessage = `Error: ${err.message || 'Failed to save'}`;
      }
    } catch {
      saveMessage = 'Error: Failed to save settings';
    }
    saving = false;
  }

  function getRoleColor(role: string): string {
    switch (role) {
      case 'owner':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'admin':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default:
        return 'text-surface-400 bg-surface-400/10 border-surface-400/20';
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      aria-label="Back to tenants"
      href="/admin/tenants"
      class="rounded-lg p-2 text-surface-400 hover:bg-surface-700/50 hover:text-white transition-colors duration-150"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <div>
      <h1 class="text-2xl font-bold text-white">{data.tenant.name}</h1>
      <p class="text-sm text-surface-400">{data.tenant.slug}.financeowl.com</p>
    </div>
    <span
      class="ml-auto inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize
			{data.tenant.status === 'active'
        ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
        : data.tenant.status === 'suspended'
          ? 'text-red-400 bg-red-400/10 border-red-400/20'
          : 'text-amber-400 bg-amber-400/10 border-amber-400/20'}"
    >
      {data.tenant.status}
    </span>
  </div>

  {#if saveMessage}
    <div
      class="rounded-lg border px-4 py-3 text-sm
			{saveMessage.startsWith('Error')
        ? 'border-red-400/20 bg-red-400/10 text-red-400'
        : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'}"
    >
      {saveMessage}
    </div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-2">
    <!-- General Settings -->
    <div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-5">
      <h2 class="text-lg font-semibold text-white mb-4">General Settings</h2>
      <div class="space-y-4">
        <div>
          <label for="tenant-name" class="block text-sm font-medium text-surface-300 mb-1.5"
            >Tenant Name</label
          >
          <input
            id="tenant-name"
            type="text"
            bind:value={tenantName}
            class="w-full rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white
							placeholder:text-surface-500 focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          />
        </div>

        <div>
          <label for="slug" class="block text-sm font-medium text-surface-300 mb-1.5"
            >Slug (read-only)</label
          >
          <input
            id="slug"
            type="text"
            value={data.tenant.slug}
            disabled
            class="w-full rounded-lg border border-surface-600/50 bg-surface-700/30 px-3 py-2 text-sm text-surface-400
							cursor-not-allowed"
          />
        </div>

        <div>
          <label for="custom-domain" class="block text-sm font-medium text-surface-300 mb-1.5"
            >Custom Domain</label
          >
          <input
            id="custom-domain"
            type="text"
            bind:value={customDomain}
            placeholder="app.acme.com"
            class="w-full rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white
							placeholder:text-surface-500 focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="plan" class="block text-sm font-medium text-surface-300 mb-1.5">Plan</label>
            <select
              id="plan"
              bind:value={plan}
              class="w-full rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white
								focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label for="max-users" class="block text-sm font-medium text-surface-300 mb-1.5"
              >Max Users</label
            >
            <input
              id="max-users"
              type="number"
              bind:value={maxUsers}
              min="1"
              class="w-full rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white
								focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            />
          </div>
        </div>

        <button
          onclick={saveSettings}
          disabled={saving}
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
						hover:bg-primary-500 disabled:opacity-50 transition-colors duration-150"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>

    <!-- Branding Editor -->
    <div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-5">
      <h2 class="text-lg font-semibold text-white mb-4">Branding</h2>
      <div class="space-y-4">
        <div>
          <label for="app-name" class="block text-sm font-medium text-surface-300 mb-1.5"
            >App Name</label
          >
          <input
            id="app-name"
            type="text"
            bind:value={appName}
            placeholder="Finance Owl"
            class="w-full rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white
							placeholder:text-surface-500 focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="primary-color" class="block text-sm font-medium text-surface-300 mb-1.5"
              >Primary Color</label
            >
            <div class="flex items-center gap-2">
              <input
                id="primary-color"
                type="color"
                bind:value={primaryColor}
                class="h-9 w-12 cursor-pointer rounded border border-surface-600/50 bg-transparent"
              />
              <input
                type="text"
                bind:value={primaryColor}
                class="flex-1 rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white font-mono
									focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
              />
            </div>
          </div>
          <div>
            <label for="accent-color" class="block text-sm font-medium text-surface-300 mb-1.5"
              >Accent Color</label
            >
            <div class="flex items-center gap-2">
              <input
                id="accent-color"
                type="color"
                bind:value={accentColor}
                class="h-9 w-12 cursor-pointer rounded border border-surface-600/50 bg-transparent"
              />
              <input
                type="text"
                bind:value={accentColor}
                class="flex-1 rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white font-mono
									focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
              />
            </div>
          </div>
        </div>

        <div>
          <label for="logo-url" class="block text-sm font-medium text-surface-300 mb-1.5"
            >Logo URL</label
          >
          <input
            id="logo-url"
            type="url"
            bind:value={logoUrl}
            placeholder="https://example.com/logo.svg"
            class="w-full rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white
							placeholder:text-surface-500 focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          />
        </div>

        <div>
          <label for="favicon-url" class="block text-sm font-medium text-surface-300 mb-1.5"
            >Favicon URL</label
          >
          <input
            id="favicon-url"
            type="url"
            bind:value={faviconUrl}
            placeholder="https://example.com/favicon.ico"
            class="w-full rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white
							placeholder:text-surface-500 focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          />
        </div>

        <!-- Preview -->
        <div class="rounded-lg border border-surface-600/50 bg-surface-900/50 p-4">
          <p class="text-xs font-medium uppercase tracking-wider text-surface-500 mb-3">Preview</p>
          <div class="flex items-center gap-3">
            {#if logoUrl}
              <img src={logoUrl} alt="Logo preview" class="h-8 w-8 rounded-lg object-contain" />
            {:else}
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                style="background-color: {primaryColor}"
              >
                {appName.charAt(0)}
              </div>
            {/if}
            <span class="text-lg font-bold text-white">{appName}</span>
          </div>
          <div class="mt-3 flex gap-2">
            <div class="h-6 w-20 rounded" style="background-color: {primaryColor}"></div>
            <div class="h-6 w-20 rounded" style="background-color: {accentColor}"></div>
          </div>
        </div>

        <button
          onclick={saveBranding}
          disabled={saving}
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
						hover:bg-primary-500 disabled:opacity-50 transition-colors duration-150"
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  </div>

  <!-- Members -->
  <div class="rounded-xl border border-surface-700/50 bg-surface-800/50 overflow-hidden">
    <div class="flex items-center justify-between border-b border-surface-700/50 px-4 py-3">
      <h3 class="text-sm font-medium text-surface-300">Members ({data.members.length})</h3>
    </div>

    {#if data.members.length === 0}
      <div class="p-8 text-center">
        <p class="text-surface-400">No members in this tenant.</p>
      </div>
    {:else}
      <div class="divide-y divide-surface-700/50">
        {#each data.members as member}
          <div class="flex items-center gap-4 px-4 py-3">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-700/50 text-sm font-medium text-surface-300"
            >
              {member.userName?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-white truncate">{member.userName}</p>
              <p class="text-xs text-surface-500 truncate">{member.userEmail}</p>
            </div>
            <span
              class="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium capitalize {getRoleColor(
                member.role,
              )}"
            >
              {member.role}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
