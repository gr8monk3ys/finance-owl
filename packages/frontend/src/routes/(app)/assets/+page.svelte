<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button, Modal } from '$components/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let activeTab = $state<'properties' | 'vehicles'>('properties');
  let showAddPropertyModal = $state(false);
  let showAddVehicleModal = $state(false);
  let editingProperty = $state<any>(null);
  let editingVehicle = $state<any>(null);

  $effect(() => {
    if (form?.success) {
      invalidateAll();
      showAddPropertyModal = false;
      showAddVehicleModal = false;
      editingProperty = null;
      editingVehicle = null;
    }
  });

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function fmtDate(dateStr: string | null): string {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function gainLoss(
    current: number,
    purchase: number | null,
  ): { value: number; pct: string; positive: boolean } {
    if (!purchase || purchase === 0) return { value: 0, pct: '0%', positive: true };
    const diff = current - purchase;
    const pct = ((diff / purchase) * 100).toFixed(1);
    return { value: diff, pct: `${diff >= 0 ? '+' : ''}${pct}%`, positive: diff >= 0 };
  }

  function propertyTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      primary_residence: 'Primary Residence',
      rental: 'Rental',
      vacation: 'Vacation',
      investment: 'Investment',
      land: 'Land',
    };
    return labels[type] || type;
  }

  function propertyTypeBadgeColor(type: string): string {
    const colors: Record<string, string> = {
      primary_residence: 'bg-blue-900/50 text-blue-300',
      rental: 'bg-green-900/50 text-green-300',
      vacation: 'bg-purple-900/50 text-purple-300',
      investment: 'bg-yellow-900/50 text-yellow-300',
      land: 'bg-amber-900/50 text-amber-300',
    };
    return colors[type] || 'bg-surface-700 text-surface-300';
  }

  function conditionBadgeColor(condition: string): string {
    const colors: Record<string, string> = {
      excellent: 'bg-green-900/50 text-green-300',
      good: 'bg-blue-900/50 text-blue-300',
      fair: 'bg-yellow-900/50 text-yellow-300',
      poor: 'bg-red-900/50 text-red-300',
    };
    return colors[condition] || 'bg-surface-700 text-surface-300';
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const currentYear = new Date().getFullYear();
</script>

<svelte:head>
  <title>Assets - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold text-white">Assets</h2>
    <div class="flex gap-2">
      {#if activeTab === 'properties'}
        <Button onclick={() => (showAddPropertyModal = true)}>Add Property</Button>
      {:else}
        <Button onclick={() => (showAddVehicleModal = true)}>Add Vehicle</Button>
      {/if}
    </div>
  </div>

  <!-- Error -->
  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
  {/if}

  <!-- Summary Cards -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <p class="text-sm text-surface-400">Total Property Value</p>
      <p class="mt-1 text-xl font-bold text-white">{fmt(data.summary.totalPropertyValue)}</p>
      <p class="mt-1 text-xs text-surface-500">
        {data.summary.propertyCount}
        {data.summary.propertyCount === 1 ? 'property' : 'properties'}
      </p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Total Vehicle Value</p>
      <p class="mt-1 text-xl font-bold text-white">{fmt(data.summary.totalVehicleValue)}</p>
      <p class="mt-1 text-xs text-surface-500">
        {data.summary.vehicleCount}
        {data.summary.vehicleCount === 1 ? 'vehicle' : 'vehicles'}
      </p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Combined Assets</p>
      <p class="mt-1 text-xl font-bold text-primary-400">{fmt(data.summary.totalAssetValue)}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Equity</p>
      <p
        class="mt-1 text-xl font-bold {data.summary.equity >= 0
          ? 'text-green-400'
          : 'text-red-400'}"
      >
        {fmt(data.summary.equity)}
      </p>
      {#if data.summary.totalLinkedLoanBalance > 0}
        <p class="mt-1 text-xs text-surface-500">
          Loans: {fmt(data.summary.totalLinkedLoanBalance)}
        </p>
      {/if}
    </Card>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 rounded-lg bg-surface-800 p-1">
    <button
      class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'properties'
        ? 'bg-primary-600 text-white'
        : 'text-surface-400 hover:text-white'}"
      onclick={() => (activeTab = 'properties')}
    >
      Properties ({data.properties.length})
    </button>
    <button
      class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'vehicles'
        ? 'bg-primary-600 text-white'
        : 'text-surface-400 hover:text-white'}"
      onclick={() => (activeTab = 'vehicles')}
    >
      Vehicles ({data.vehicles.length})
    </button>
  </div>

  <!-- Properties Tab -->
  {#if activeTab === 'properties'}
    {#if data.properties.length === 0}
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
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <p class="mt-4 text-lg text-surface-300">No properties yet</p>
          <p class="mt-1 text-sm text-surface-500">Add your real estate to track your net worth.</p>
          <div class="mt-4">
            <Button onclick={() => (showAddPropertyModal = true)}>Add Property</Button>
          </div>
        </div>
      </Card>
    {:else}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.properties as property}
          {@const gl = gainLoss(property.currentValue, property.purchasePrice)}
          <Card class="relative overflow-hidden">
            <!-- Type accent bar -->
            <div
              class="absolute left-0 top-0 h-1 w-full {property.propertyType === 'primary_residence'
                ? 'bg-blue-500'
                : property.propertyType === 'rental'
                  ? 'bg-green-500'
                  : property.propertyType === 'vacation'
                    ? 'bg-purple-500'
                    : property.propertyType === 'investment'
                      ? 'bg-yellow-500'
                      : 'bg-amber-500'}"
            ></div>

            <div class="pt-2">
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="truncate font-medium text-white">{property.name}</p>
                    <span
                      class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {propertyTypeBadgeColor(
                        property.propertyType,
                      )}"
                    >
                      {propertyTypeLabel(property.propertyType)}
                    </span>
                  </div>
                  {#if property.address || property.city}
                    <p class="mt-0.5 truncate text-xs text-surface-500">
                      {[property.address, property.city, property.state].filter(Boolean).join(', ')}
                      {#if property.zipCode}
                        {property.zipCode}{/if}
                    </p>
                  {/if}
                </div>
                <div class="ml-2 flex items-center gap-1">
                  <form
                    method="POST"
                    action="?/estimateProperty"
                    use:enhance={() => {
                      return async ({ update }) => {
                        await update();
                      };
                    }}
                  >
                    <input type="hidden" name="id" value={property.id} />
                    <button
                      type="submit"
                      class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-primary-400"
                      title="Re-estimate value"
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </form>
                  <button
                    class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
                    onclick={() => (editingProperty = property)}
                    title="Edit property"
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
                </div>
              </div>

              <!-- Value -->
              <div class="mt-4">
                <p class="text-2xl font-bold text-white">{fmt(property.currentValue)}</p>
                <div class="mt-1 flex items-center gap-3 text-sm">
                  {#if property.purchasePrice}
                    <span class="text-surface-500">Purchased: {fmt(property.purchasePrice)}</span>
                    <span class="{gl.positive ? 'text-green-400' : 'text-red-400'} font-medium">
                      {gl.pct}
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Footer details -->
              <div
                class="mt-3 flex items-center justify-between border-t border-surface-700 pt-3 text-xs text-surface-500"
              >
                <span>Last valued: {fmtDate(property.lastValuationDate)}</span>
                {#if property.monthlyRent}
                  <span class="text-green-400">Rent: {fmt(property.monthlyRent)}/mo</span>
                {/if}
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Vehicles Tab -->
  {#if activeTab === 'vehicles'}
    {#if data.vehicles.length === 0}
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
              d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
            />
          </svg>
          <p class="mt-4 text-lg text-surface-300">No vehicles yet</p>
          <p class="mt-1 text-sm text-surface-500">
            Add your vehicles to track depreciation and net worth.
          </p>
          <div class="mt-4">
            <Button onclick={() => (showAddVehicleModal = true)}>Add Vehicle</Button>
          </div>
        </div>
      </Card>
    {:else}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.vehicles as vehicle}
          {@const gl = gainLoss(vehicle.currentValue, vehicle.purchasePrice)}
          <Card class="relative overflow-hidden">
            <!-- Condition accent bar -->
            <div
              class="absolute left-0 top-0 h-1 w-full {vehicle.condition === 'excellent'
                ? 'bg-green-500'
                : vehicle.condition === 'good'
                  ? 'bg-blue-500'
                  : vehicle.condition === 'fair'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'}"
            ></div>

            <div class="pt-2">
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <p class="truncate font-medium text-white">
                    {vehicle.year}
                    {vehicle.make}
                    {vehicle.model}
                    {#if vehicle.trim}
                      <span class="text-surface-400">{vehicle.trim}</span>
                    {/if}
                  </p>
                  <div class="mt-1 flex items-center gap-2">
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-medium {conditionBadgeColor(
                        vehicle.condition,
                      )}"
                    >
                      {capitalize(vehicle.condition)}
                    </span>
                    {#if vehicle.mileage}
                      <span class="text-xs text-surface-500"
                        >{vehicle.mileage.toLocaleString()} mi</span
                      >
                    {/if}
                  </div>
                </div>
                <div class="ml-2 flex items-center gap-1">
                  <form
                    method="POST"
                    action="?/estimateVehicle"
                    use:enhance={() => {
                      return async ({ update }) => {
                        await update();
                      };
                    }}
                  >
                    <input type="hidden" name="id" value={vehicle.id} />
                    <button
                      type="submit"
                      class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-primary-400"
                      title="Re-estimate value"
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </form>
                  <button
                    class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
                    onclick={() => (editingVehicle = vehicle)}
                    title="Edit vehicle"
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
                </div>
              </div>

              <!-- Value -->
              <div class="mt-4">
                <p class="text-2xl font-bold text-white">{fmt(vehicle.currentValue)}</p>
                <div class="mt-1 flex items-center gap-3 text-sm">
                  {#if vehicle.purchasePrice}
                    <span class="text-surface-500">Purchased: {fmt(vehicle.purchasePrice)}</span>
                    <span class="{gl.positive ? 'text-green-400' : 'text-red-400'} font-medium">
                      {gl.pct}
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Footer details -->
              <div
                class="mt-3 flex items-center justify-between border-t border-surface-700 pt-3 text-xs text-surface-500"
              >
                <span>Last valued: {fmtDate(vehicle.lastValuationDate)}</span>
                {#if vehicle.monthlyPayment}
                  <span class="text-yellow-400">Payment: {fmt(vehicle.monthlyPayment)}/mo</span>
                {/if}
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Add Property Modal -->
<Modal
  open={showAddPropertyModal}
  onclose={() => (showAddPropertyModal = false)}
  title="Add Property"
>
  <form
    method="POST"
    action="?/createProperty"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="propName" class="block text-sm font-medium text-surface-300">Property Name</label>
      <input
        id="propName"
        name="name"
        type="text"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="My Home"
      />
    </div>

    <div>
      <label for="propType" class="block text-sm font-medium text-surface-300">Property Type</label>
      <select
        id="propType"
        name="propertyType"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="primary_residence">Primary Residence</option>
        <option value="rental">Rental Property</option>
        <option value="vacation">Vacation Home</option>
        <option value="investment">Investment Property</option>
        <option value="land">Land</option>
      </select>
    </div>

    <div>
      <label for="propAddress" class="block text-sm font-medium text-surface-300">Address</label>
      <input
        id="propAddress"
        name="address"
        type="text"
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="123 Main St"
      />
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div>
        <label for="propCity" class="block text-sm font-medium text-surface-300">City</label>
        <input
          id="propCity"
          name="city"
          type="text"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Denver"
        />
      </div>
      <div>
        <label for="propState" class="block text-sm font-medium text-surface-300">State</label>
        <input
          id="propState"
          name="state"
          type="text"
          maxlength="2"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="CO"
        />
      </div>
      <div>
        <label for="propZip" class="block text-sm font-medium text-surface-300">Zip</label>
        <input
          id="propZip"
          name="zipCode"
          type="text"
          maxlength="10"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="80202"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="propPurchasePrice" class="block text-sm font-medium text-surface-300"
          >Purchase Price</label
        >
        <input
          id="propPurchasePrice"
          name="purchasePrice"
          type="number"
          step="0.01"
          min="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="350000"
        />
      </div>
      <div>
        <label for="propPurchaseDate" class="block text-sm font-medium text-surface-300"
          >Purchase Date</label
        >
        <input
          id="propPurchaseDate"
          name="purchaseDate"
          type="date"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div>
      <label for="propCurrentValue" class="block text-sm font-medium text-surface-300"
        >Current Value</label
      >
      <input
        id="propCurrentValue"
        name="currentValue"
        type="number"
        step="0.01"
        min="0"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="400000"
      />
    </div>

    <div>
      <label for="propMortgage" class="block text-sm font-medium text-surface-300"
        >Linked Mortgage Account</label
      >
      <select
        id="propMortgage"
        name="mortgageAccountId"
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">None</option>
        {#each data.loanAccounts.filter((a: any) => a.type === 'mortgage') as acct}
          <option value={acct.id}>{acct.name} ({acct.institutionName || 'Manual'})</option>
        {/each}
      </select>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div>
        <label for="propRent" class="block text-sm font-medium text-surface-300">Monthly Rent</label
        >
        <input
          id="propRent"
          name="monthlyRent"
          type="number"
          step="0.01"
          min="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="2000"
        />
      </div>
      <div>
        <label for="propTax" class="block text-sm font-medium text-surface-300">Annual Tax</label>
        <input
          id="propTax"
          name="annualPropertyTax"
          type="number"
          step="0.01"
          min="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="5000"
        />
      </div>
      <div>
        <label for="propInsurance" class="block text-sm font-medium text-surface-300"
          >Annual Ins.</label
        >
        <input
          id="propInsurance"
          name="annualInsurance"
          type="number"
          step="0.01"
          min="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="1500"
        />
      </div>
    </div>

    <div>
      <label for="propNotes" class="block text-sm font-medium text-surface-300">Notes</label>
      <textarea
        id="propNotes"
        name="notes"
        rows="2"
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="Any notes about this property..."></textarea>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showAddPropertyModal = false)}
        >Cancel</Button
      >
      <Button type="submit">Add Property</Button>
    </div>
  </form>
</Modal>

<!-- Edit Property Modal -->
<Modal
  open={editingProperty !== null}
  onclose={() => (editingProperty = null)}
  title="Edit Property"
>
  {#if editingProperty}
    <form
      method="POST"
      action="?/updateProperty"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
        };
      }}
      class="space-y-4"
    >
      <input type="hidden" name="id" value={editingProperty.id} />

      <div>
        <label for="editPropName" class="block text-sm font-medium text-surface-300"
          >Property Name</label
        >
        <input
          id="editPropName"
          name="name"
          type="text"
          required
          value={editingProperty.name}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div>
        <label for="editPropType" class="block text-sm font-medium text-surface-300"
          >Property Type</label
        >
        <select
          id="editPropType"
          name="propertyType"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option
            value="primary_residence"
            selected={editingProperty.propertyType === 'primary_residence'}
            >Primary Residence</option
          >
          <option value="rental" selected={editingProperty.propertyType === 'rental'}
            >Rental Property</option
          >
          <option value="vacation" selected={editingProperty.propertyType === 'vacation'}
            >Vacation Home</option
          >
          <option value="investment" selected={editingProperty.propertyType === 'investment'}
            >Investment Property</option
          >
          <option value="land" selected={editingProperty.propertyType === 'land'}>Land</option>
        </select>
      </div>

      <div>
        <label for="editPropAddress" class="block text-sm font-medium text-surface-300"
          >Address</label
        >
        <input
          id="editPropAddress"
          name="address"
          type="text"
          value={editingProperty.address || ''}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label for="editPropCity" class="block text-sm font-medium text-surface-300">City</label>
          <input
            id="editPropCity"
            name="city"
            type="text"
            value={editingProperty.city || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editPropState" class="block text-sm font-medium text-surface-300">State</label
          >
          <input
            id="editPropState"
            name="state"
            type="text"
            maxlength="2"
            value={editingProperty.state || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editPropZip" class="block text-sm font-medium text-surface-300">Zip</label>
          <input
            id="editPropZip"
            name="zipCode"
            type="text"
            maxlength="10"
            value={editingProperty.zipCode || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="editPropPurchasePrice" class="block text-sm font-medium text-surface-300"
            >Purchase Price</label
          >
          <input
            id="editPropPurchasePrice"
            name="purchasePrice"
            type="number"
            step="0.01"
            min="0"
            value={editingProperty.purchasePrice || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editPropPurchaseDate" class="block text-sm font-medium text-surface-300"
            >Purchase Date</label
          >
          <input
            id="editPropPurchaseDate"
            name="purchaseDate"
            type="date"
            value={editingProperty.purchaseDate || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label for="editPropValue" class="block text-sm font-medium text-surface-300"
          >Current Value</label
        >
        <input
          id="editPropValue"
          name="currentValue"
          type="number"
          step="0.01"
          min="0"
          required
          value={editingProperty.currentValue}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div>
        <label for="editPropMortgage" class="block text-sm font-medium text-surface-300"
          >Linked Mortgage Account</label
        >
        <select
          id="editPropMortgage"
          name="mortgageAccountId"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">None</option>
          {#each data.loanAccounts.filter((a: any) => a.type === 'mortgage') as acct}
            <option value={acct.id} selected={editingProperty.mortgageAccountId === acct.id}>
              {acct.name} ({acct.institutionName || 'Manual'})
            </option>
          {/each}
        </select>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label for="editPropRent" class="block text-sm font-medium text-surface-300"
            >Monthly Rent</label
          >
          <input
            id="editPropRent"
            name="monthlyRent"
            type="number"
            step="0.01"
            min="0"
            value={editingProperty.monthlyRent || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editPropTax" class="block text-sm font-medium text-surface-300"
            >Annual Tax</label
          >
          <input
            id="editPropTax"
            name="annualPropertyTax"
            type="number"
            step="0.01"
            min="0"
            value={editingProperty.annualPropertyTax || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editPropIns" class="block text-sm font-medium text-surface-300"
            >Annual Ins.</label
          >
          <input
            id="editPropIns"
            name="annualInsurance"
            type="number"
            step="0.01"
            min="0"
            value={editingProperty.annualInsurance || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label for="editPropNotes" class="block text-sm font-medium text-surface-300">Notes</label>
        <textarea
          id="editPropNotes"
          name="notes"
          rows="2"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >{editingProperty.notes || ''}</textarea
        >
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <Button variant="ghost" type="button" onclick={() => (editingProperty = null)}
          >Cancel</Button
        >
        <Button type="submit">Save Changes</Button>
      </div>
    </form>

    <form
      method="POST"
      action="?/deleteProperty"
      use:enhance
      class="mt-3 border-t border-surface-700 pt-3"
    >
      <input type="hidden" name="id" value={editingProperty.id} />
      <Button type="submit" variant="danger" size="sm">Delete Property</Button>
    </form>
  {/if}
</Modal>

<!-- Add Vehicle Modal -->
<Modal open={showAddVehicleModal} onclose={() => (showAddVehicleModal = false)} title="Add Vehicle">
  <form
    method="POST"
    action="?/createVehicle"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="vehMake" class="block text-sm font-medium text-surface-300">Make</label>
        <input
          id="vehMake"
          name="make"
          type="text"
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Toyota"
        />
      </div>
      <div>
        <label for="vehModel" class="block text-sm font-medium text-surface-300">Model</label>
        <input
          id="vehModel"
          name="model"
          type="text"
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Camry"
        />
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div>
        <label for="vehYear" class="block text-sm font-medium text-surface-300">Year</label>
        <input
          id="vehYear"
          name="year"
          type="number"
          min="1900"
          max={currentYear + 1}
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder={String(currentYear)}
        />
      </div>
      <div>
        <label for="vehTrim" class="block text-sm font-medium text-surface-300">Trim</label>
        <input
          id="vehTrim"
          name="trim"
          type="text"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="SE"
        />
      </div>
      <div>
        <label for="vehVin" class="block text-sm font-medium text-surface-300">VIN</label>
        <input
          id="vehVin"
          name="vin"
          type="text"
          maxlength="17"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Optional"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="vehMileage" class="block text-sm font-medium text-surface-300">Mileage</label>
        <input
          id="vehMileage"
          name="mileage"
          type="number"
          min="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="45000"
        />
      </div>
      <div>
        <label for="vehCondition" class="block text-sm font-medium text-surface-300"
          >Condition</label
        >
        <select
          id="vehCondition"
          name="condition"
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="excellent">Excellent</option>
          <option value="good" selected>Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="vehPurchasePrice" class="block text-sm font-medium text-surface-300"
          >Purchase Price</label
        >
        <input
          id="vehPurchasePrice"
          name="purchasePrice"
          type="number"
          step="0.01"
          min="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="28000"
        />
      </div>
      <div>
        <label for="vehPurchaseDate" class="block text-sm font-medium text-surface-300"
          >Purchase Date</label
        >
        <input
          id="vehPurchaseDate"
          name="purchaseDate"
          type="date"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div>
      <label for="vehCurrentValue" class="block text-sm font-medium text-surface-300"
        >Current Value</label
      >
      <input
        id="vehCurrentValue"
        name="currentValue"
        type="number"
        step="0.01"
        min="0"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="22000"
      />
    </div>

    <div>
      <label for="vehLoan" class="block text-sm font-medium text-surface-300"
        >Linked Auto Loan Account</label
      >
      <select
        id="vehLoan"
        name="loanAccountId"
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">None</option>
        {#each data.loanAccounts.filter((a: any) => a.type === 'loan') as acct}
          <option value={acct.id}>{acct.name} ({acct.institutionName || 'Manual'})</option>
        {/each}
      </select>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="vehPayment" class="block text-sm font-medium text-surface-300"
          >Monthly Payment</label
        >
        <input
          id="vehPayment"
          name="monthlyPayment"
          type="number"
          step="0.01"
          min="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="450"
        />
      </div>
      <div>
        <label for="vehInsurance" class="block text-sm font-medium text-surface-300"
          >Annual Insurance</label
        >
        <input
          id="vehInsurance"
          name="annualInsurance"
          type="number"
          step="0.01"
          min="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="1200"
        />
      </div>
    </div>

    <div>
      <label for="vehNotes" class="block text-sm font-medium text-surface-300">Notes</label>
      <textarea
        id="vehNotes"
        name="notes"
        rows="2"
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="Any notes about this vehicle..."></textarea>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showAddVehicleModal = false)}
        >Cancel</Button
      >
      <Button type="submit">Add Vehicle</Button>
    </div>
  </form>
</Modal>

<!-- Edit Vehicle Modal -->
<Modal open={editingVehicle !== null} onclose={() => (editingVehicle = null)} title="Edit Vehicle">
  {#if editingVehicle}
    <form
      method="POST"
      action="?/updateVehicle"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
        };
      }}
      class="space-y-4"
    >
      <input type="hidden" name="id" value={editingVehicle.id} />

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="editVehMake" class="block text-sm font-medium text-surface-300">Make</label>
          <input
            id="editVehMake"
            name="make"
            type="text"
            required
            value={editingVehicle.make}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editVehModel" class="block text-sm font-medium text-surface-300">Model</label>
          <input
            id="editVehModel"
            name="model"
            type="text"
            required
            value={editingVehicle.model}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label for="editVehYear" class="block text-sm font-medium text-surface-300">Year</label>
          <input
            id="editVehYear"
            name="year"
            type="number"
            min="1900"
            max={currentYear + 1}
            required
            value={editingVehicle.year}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editVehTrim" class="block text-sm font-medium text-surface-300">Trim</label>
          <input
            id="editVehTrim"
            name="trim"
            type="text"
            value={editingVehicle.trim || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editVehVin" class="block text-sm font-medium text-surface-300">VIN</label>
          <input
            id="editVehVin"
            name="vin"
            type="text"
            maxlength="17"
            value={editingVehicle.vin || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="editVehMileage" class="block text-sm font-medium text-surface-300"
            >Mileage</label
          >
          <input
            id="editVehMileage"
            name="mileage"
            type="number"
            min="0"
            value={editingVehicle.mileage || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editVehCondition" class="block text-sm font-medium text-surface-300"
            >Condition</label
          >
          <select
            id="editVehCondition"
            name="condition"
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="excellent" selected={editingVehicle.condition === 'excellent'}
              >Excellent</option
            >
            <option value="good" selected={editingVehicle.condition === 'good'}>Good</option>
            <option value="fair" selected={editingVehicle.condition === 'fair'}>Fair</option>
            <option value="poor" selected={editingVehicle.condition === 'poor'}>Poor</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="editVehPurchasePrice" class="block text-sm font-medium text-surface-300"
            >Purchase Price</label
          >
          <input
            id="editVehPurchasePrice"
            name="purchasePrice"
            type="number"
            step="0.01"
            min="0"
            value={editingVehicle.purchasePrice || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editVehPurchaseDate" class="block text-sm font-medium text-surface-300"
            >Purchase Date</label
          >
          <input
            id="editVehPurchaseDate"
            name="purchaseDate"
            type="date"
            value={editingVehicle.purchaseDate || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label for="editVehValue" class="block text-sm font-medium text-surface-300"
          >Current Value</label
        >
        <input
          id="editVehValue"
          name="currentValue"
          type="number"
          step="0.01"
          min="0"
          required
          value={editingVehicle.currentValue}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div>
        <label for="editVehLoan" class="block text-sm font-medium text-surface-300"
          >Linked Auto Loan Account</label
        >
        <select
          id="editVehLoan"
          name="loanAccountId"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">None</option>
          {#each data.loanAccounts.filter((a: any) => a.type === 'loan') as acct}
            <option value={acct.id} selected={editingVehicle.loanAccountId === acct.id}>
              {acct.name} ({acct.institutionName || 'Manual'})
            </option>
          {/each}
        </select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="editVehPayment" class="block text-sm font-medium text-surface-300"
            >Monthly Payment</label
          >
          <input
            id="editVehPayment"
            name="monthlyPayment"
            type="number"
            step="0.01"
            min="0"
            value={editingVehicle.monthlyPayment || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editVehInsurance" class="block text-sm font-medium text-surface-300"
            >Annual Insurance</label
          >
          <input
            id="editVehInsurance"
            name="annualInsurance"
            type="number"
            step="0.01"
            min="0"
            value={editingVehicle.annualInsurance || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label for="editVehNotes" class="block text-sm font-medium text-surface-300">Notes</label>
        <textarea
          id="editVehNotes"
          name="notes"
          rows="2"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >{editingVehicle.notes || ''}</textarea
        >
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <Button variant="ghost" type="button" onclick={() => (editingVehicle = null)}>Cancel</Button
        >
        <Button type="submit">Save Changes</Button>
      </div>
    </form>

    <form
      method="POST"
      action="?/deleteVehicle"
      use:enhance
      class="mt-3 border-t border-surface-700 pt-3"
    >
      <input type="hidden" name="id" value={editingVehicle.id} />
      <Button type="submit" variant="danger" size="sm">Delete Vehicle</Button>
    </form>
  {/if}
</Modal>
