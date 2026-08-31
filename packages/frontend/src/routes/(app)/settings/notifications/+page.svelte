<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import { Button, Card } from '$components/ui';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let saving = $state(false);
  let billReminderDays = $state(3);

  $effect(() => {
    if (data.preferences) {
      billReminderDays = data.preferences.billReminderDaysBefore;
    }
  });
</script>

<svelte:head>
  <title>Notification Preferences - Finance Owl</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
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
    <h1 class="text-2xl font-bold text-white">Notification Preferences</h1>
  </div>

  {#if form?.success}
    <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
      Notification preferences saved successfully.
    </div>
  {/if}

  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
      {form.error}
    </div>
  {/if}

  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        saving = false;
        await update();
      };
    }}
  >
    <!-- Email Notification Toggles -->
    <Card padding="none">
      <div class="space-y-6 p-6">
        <div>
          <h2 class="text-lg font-semibold text-white">Email Notifications</h2>
          <p class="mt-1 text-sm text-surface-400">
            Choose which email notifications you would like to receive. In-app notifications are
            always enabled.
          </p>
        </div>

        <div class="space-y-4">
          <label class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-white">Bill Reminders</p>
              <p class="text-xs text-surface-400">
                Get email reminders before upcoming recurring bills and subscriptions are due.
              </p>
            </div>
            <div class="relative">
              <input
                type="checkbox"
                name="emailBillReminders"
                checked={data.preferences.emailBillReminders}
                class="peer sr-only"
                id="emailBillReminders"
              />
              <label
                for="emailBillReminders"
                class="block h-6 w-11 cursor-pointer rounded-full bg-surface-600 transition-colors peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-500"
              ></label>
              <label
                for="emailBillReminders"
                class="absolute left-0.5 top-0.5 block h-5 w-5 cursor-pointer rounded-full bg-white transition-transform peer-checked:translate-x-5"
              ></label>
            </div>
          </label>

          <label class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-white">Budget Alerts</p>
              <p class="text-xs text-surface-400">
                Receive an email when a budget is close to or exceeds its spending limit.
              </p>
            </div>
            <div class="relative">
              <input
                type="checkbox"
                name="emailBudgetAlerts"
                checked={data.preferences.emailBudgetAlerts}
                class="peer sr-only"
                id="emailBudgetAlerts"
              />
              <label
                for="emailBudgetAlerts"
                class="block h-6 w-11 cursor-pointer rounded-full bg-surface-600 transition-colors peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-500"
              ></label>
              <label
                for="emailBudgetAlerts"
                class="absolute left-0.5 top-0.5 block h-5 w-5 cursor-pointer rounded-full bg-white transition-transform peer-checked:translate-x-5"
              ></label>
            </div>
          </label>

          <label class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-white">Anomaly Alerts</p>
              <p class="text-xs text-surface-400">
                Get notified about unusual transactions or unexpected spending patterns.
              </p>
            </div>
            <div class="relative">
              <input
                type="checkbox"
                name="emailAnomalies"
                checked={data.preferences.emailAnomalies}
                class="peer sr-only"
                id="emailAnomalies"
              />
              <label
                for="emailAnomalies"
                class="block h-6 w-11 cursor-pointer rounded-full bg-surface-600 transition-colors peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-500"
              ></label>
              <label
                for="emailAnomalies"
                class="absolute left-0.5 top-0.5 block h-5 w-5 cursor-pointer rounded-full bg-white transition-transform peer-checked:translate-x-5"
              ></label>
            </div>
          </label>

          <label class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-white">Weekly Digest</p>
              <p class="text-xs text-surface-400">
                Receive a weekly email summary of your spending, top categories, and upcoming bills.
              </p>
            </div>
            <div class="relative">
              <input
                type="checkbox"
                name="emailWeeklyDigest"
                checked={data.preferences.emailWeeklyDigest}
                class="peer sr-only"
                id="emailWeeklyDigest"
              />
              <label
                for="emailWeeklyDigest"
                class="block h-6 w-11 cursor-pointer rounded-full bg-surface-600 transition-colors peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-500"
              ></label>
              <label
                for="emailWeeklyDigest"
                class="absolute left-0.5 top-0.5 block h-5 w-5 cursor-pointer rounded-full bg-white transition-transform peer-checked:translate-x-5"
              ></label>
            </div>
          </label>
        </div>
      </div>
    </Card>

    <!-- Bill Reminder Timing -->
    <Card padding="none">
      <div class="mt-6 space-y-4 p-6">
        <div>
          <h2 class="text-lg font-semibold text-white">Reminder Timing</h2>
          <p class="mt-1 text-sm text-surface-400">
            Control when you receive bill reminders before a payment is due.
          </p>
        </div>

        <div>
          <label for="billReminderDaysBefore" class="block text-sm font-medium text-white">
            Days before due date
          </label>
          <p class="mb-3 text-xs text-surface-400">
            You will be reminded this many days before each bill is due.
          </p>
          <div class="flex items-center gap-4">
            <input
              type="range"
              id="billReminderDaysBefore"
              name="billReminderDaysBefore"
              min="1"
              max="7"
              bind:value={billReminderDays}
              class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-600 accent-primary-600"
            />
            <span
              class="flex h-8 w-12 items-center justify-center rounded-lg bg-surface-700 text-sm font-medium text-white"
            >
              {billReminderDays}d
            </span>
          </div>
          <div class="mt-1 flex justify-between text-xs text-surface-500">
            <span>1 day</span>
            <span>7 days</span>
          </div>
        </div>
      </div>
    </Card>

    <!-- Save button -->
    <div class="mt-6">
      <Button type="submit" loading={saving} class="w-full sm:w-auto">Save Preferences</Button>
    </div>
  </form>
</div>
