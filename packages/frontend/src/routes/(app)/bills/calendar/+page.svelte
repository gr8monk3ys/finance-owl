<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let viewMode = $state<'month' | 'week'>('month');
	let selectedDate = $state<string | null>(null);
	let showDayDetail = $state(false);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
		}
	});

	// Current month/year navigation
	const year = $derived(data.year);
	const month = $derived(data.month);

	const monthLabel = $derived(
		new Date(year, month - 1, 1).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		})
	);

	function prevMonth() {
		let newMonth = month - 1;
		let newYear = year;
		if (newMonth < 1) {
			newMonth = 12;
			newYear--;
		}
		goto(`/bills/calendar?year=${newYear}&month=${newMonth}`);
	}

	function nextMonth() {
		let newMonth = month + 1;
		let newYear = year;
		if (newMonth > 12) {
			newMonth = 1;
			newYear++;
		}
		goto(`/bills/calendar?year=${newYear}&month=${newMonth}`);
	}

	function goToToday() {
		const now = new Date();
		goto(`/bills/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
	}

	// Build the full calendar grid (6 weeks x 7 days)
	const calendarGrid = $derived.by(() => {
		const firstDay = new Date(year, month - 1, 1);
		const lastDay = new Date(year, month, 0);
		const startDayOfWeek = firstDay.getDay();
		const daysInMonth = lastDay.getDate();

		const days: {
			day: number;
			isCurrentMonth: boolean;
			dateStr: string;
			bills: any[];
			totalDue: number;
			isToday: boolean;
			isPast: boolean;
		}[] = [];

		// Build a map from data.calendar
		const calendarMap = new Map<string, any>();
		for (const calDay of data.calendar) {
			calendarMap.set(calDay.date, calDay);
		}

		const todayStr = new Date().toISOString().split('T')[0];

		// Previous month padding
		const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
		for (let i = startDayOfWeek - 1; i >= 0; i--) {
			const day = prevMonthLastDay - i;
			const d = new Date(year, month - 2, day);
			const dateStr = d.toISOString().split('T')[0];
			days.push({
				day,
				isCurrentMonth: false,
				dateStr,
				bills: [],
				totalDue: 0,
				isToday: dateStr === todayStr,
				isPast: dateStr < todayStr
			});
		}

		// Current month
		for (let day = 1; day <= daysInMonth; day++) {
			const d = new Date(year, month - 1, day);
			const dateStr = d.toISOString().split('T')[0];
			const calDay = calendarMap.get(dateStr);
			days.push({
				day,
				isCurrentMonth: true,
				dateStr,
				bills: calDay?.bills ?? [],
				totalDue: calDay?.totalDue ?? 0,
				isToday: dateStr === todayStr,
				isPast: dateStr < todayStr
			});
		}

		// Next month padding
		const remaining = 42 - days.length;
		for (let day = 1; day <= remaining; day++) {
			const d = new Date(year, month, day);
			const dateStr = d.toISOString().split('T')[0];
			days.push({
				day,
				isCurrentMonth: false,
				dateStr,
				bills: [],
				totalDue: 0,
				isToday: dateStr === todayStr,
				isPast: dateStr < todayStr
			});
		}

		return days;
	});

	// Week view: get current week from calendar data
	const weekDays = $derived.by(() => {
		const todayStr = new Date().toISOString().split('T')[0];
		const today = new Date(todayStr + 'T00:00:00');
		const dayOfWeek = today.getDay();
		const weekStart = new Date(today);
		weekStart.setDate(weekStart.getDate() - dayOfWeek);

		const days: typeof calendarGrid = [];
		for (let i = 0; i < 7; i++) {
			const d = new Date(weekStart);
			d.setDate(d.getDate() + i);
			const dateStr = d.toISOString().split('T')[0];

			// Find matching calendar day from grid
			const calDay = calendarGrid.find((cd) => cd.dateStr === dateStr);
			days.push(
				calDay ?? {
					day: d.getDate(),
					isCurrentMonth: true,
					dateStr,
					bills: [],
					totalDue: 0,
					isToday: dateStr === todayStr,
					isPast: dateStr < todayStr
				}
			);
		}
		return days;
	});

	const displayDays = $derived(viewMode === 'month' ? calendarGrid : weekDays);

	// Selected day detail
	const selectedDayBills = $derived.by(() => {
		if (!selectedDate) return [];
		const day = calendarGrid.find((d) => d.dateStr === selectedDate);
		return day?.bills ?? [];
	});

	function openDay(dateStr: string) {
		selectedDate = dateStr;
		showDayDetail = true;
	}

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function formatFullDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getBillColor(bill: any): string {
		if (bill.isPaid) return '#22c55e'; // green
		if (bill.isOverdue) return '#ef4444'; // red
		return '#eab308'; // yellow
	}

	function getBillBgColor(bill: any): string {
		if (bill.isPaid) return 'rgba(34, 197, 94, 0.12)';
		if (bill.isOverdue) return 'rgba(239, 68, 68, 0.12)';
		return 'rgba(234, 179, 8, 0.12)';
	}

	function getBillLabel(bill: any): string {
		if (bill.isPaid) return 'Paid';
		if (bill.isOverdue) return 'Overdue';
		return 'Upcoming';
	}

	const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<svelte:head>
	<title>Bill Calendar - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Bill Calendar</h2>
			<p class="mt-1 text-sm text-surface-400">Track when your bills are due</p>
		</div>
		<div class="flex items-center gap-2">
			<a href="/bills" class="text-sm text-primary-400 hover:text-primary-300">
				Back to Bills
			</a>
		</div>
	</div>

	<!-- Month summary bar -->
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<p class="text-xs font-medium uppercase text-surface-400">Total Due</p>
			<p class="mt-1 text-xl font-bold text-white">{fmt(data.summary.totalDue)}</p>
			<p class="mt-0.5 text-xs text-surface-500">
				{data.summary.billCount} bill{data.summary.billCount !== 1 ? 's' : ''}
			</p>
		</Card>
		<Card>
			<p class="text-xs font-medium uppercase text-surface-400">Paid</p>
			<p class="mt-1 text-xl font-bold text-green-400">{fmt(data.summary.totalPaid)}</p>
			<p class="mt-0.5 text-xs text-surface-500">
				{data.summary.paidCount} paid
			</p>
		</Card>
		<Card>
			<p class="text-xs font-medium uppercase text-surface-400">Upcoming</p>
			<p class="mt-1 text-xl font-bold text-yellow-400">{fmt(data.summary.totalUpcoming)}</p>
			<p class="mt-0.5 text-xs text-surface-500">
				Still due this month
			</p>
		</Card>
		<Card>
			<p class="text-xs font-medium uppercase text-surface-400">Overdue</p>
			<p class="mt-1 text-xl font-bold {data.summary.overdueCount > 0 ? 'text-red-400' : 'text-surface-500'}">
				{data.summary.overdueCount}
			</p>
			<p class="mt-0.5 text-xs text-surface-500">
				{#if data.summary.nextDueDate}
					Next: {fmt(data.summary.nextDueAmount ?? 0)}
				{:else}
					No upcoming
				{/if}
			</p>
		</Card>
	</div>

	<!-- Calendar card -->
	<Card padding="none">
		<!-- Calendar navigation -->
		<div class="flex items-center justify-between border-b border-surface-700 px-4 py-3">
			<div class="flex items-center gap-2">
				<button
					aria-label="Previous month"
					type="button"
					class="rounded-lg p-1.5 text-surface-400 transition hover:bg-surface-700 hover:text-white"
					onclick={prevMonth}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<h3 class="min-w-[180px] text-center text-lg font-semibold text-white">{monthLabel}</h3>
				<button
					aria-label="Next month"
					type="button"
					class="rounded-lg p-1.5 text-surface-400 transition hover:bg-surface-700 hover:text-white"
					onclick={nextMonth}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
				<button
					type="button"
					class="ml-2 rounded-md px-2.5 py-1 text-xs font-medium text-primary-400 transition hover:bg-surface-700"
					onclick={goToToday}
				>
					Today
				</button>
			</div>

			<!-- View toggle -->
			<div class="flex rounded-lg bg-surface-800 p-0.5">
				<button
					type="button"
					class="rounded-md px-3 py-1 text-xs font-medium transition {viewMode === 'month'
						? 'bg-surface-600 text-white'
						: 'text-surface-400 hover:text-white'}"
					onclick={() => (viewMode = 'month')}
				>
					Month
				</button>
				<button
					type="button"
					class="rounded-md px-3 py-1 text-xs font-medium transition {viewMode === 'week'
						? 'bg-surface-600 text-white'
						: 'text-surface-400 hover:text-white'}"
					onclick={() => (viewMode = 'week')}
				>
					Week
				</button>
			</div>
		</div>

		<!-- Weekday headers -->
		<div class="grid grid-cols-7 border-b border-surface-700">
			{#each weekdays as day}
				<div class="py-2 text-center text-xs font-medium uppercase tracking-wide text-surface-500">
					{day}
				</div>
			{/each}
		</div>

		<!-- Calendar grid -->
		<div class="grid grid-cols-7">
			{#each displayDays as calDay}
				<button
					type="button"
					class="group relative min-h-[90px] border-b border-r border-surface-700/50 p-1.5 text-left transition hover:bg-surface-700/30
						{calDay.isCurrentMonth ? '' : 'bg-surface-900/40'}
						{calDay.isToday ? 'ring-1 ring-inset ring-primary-500/50 bg-primary-500/5' : ''}"
					onclick={() => openDay(calDay.dateStr)}
				>
					<!-- Day number -->
					<p
						class="mb-1 text-xs font-medium
							{calDay.isToday
								? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white'
								: calDay.isCurrentMonth
									? 'text-surface-300'
									: 'text-surface-600'}"
					>
						{calDay.day}
					</p>

					<!-- Bills on this day -->
					{#if calDay.bills.length > 0}
						<div class="space-y-0.5">
							{#each calDay.bills.slice(0, 2) as bill}
								<div
									class="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium"
									style="background-color: {getBillBgColor(bill)}; color: {getBillColor(bill)}"
									title="{bill.name}: {fmt(bill.amount)} - {getBillLabel(bill)}"
								>
									{#if bill.isPaid}
										<svg class="h-2.5 w-2.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
										</svg>
									{:else if bill.isOverdue}
										<svg class="h-2.5 w-2.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
										</svg>
									{/if}
									<span class="truncate">{fmt(bill.amount)}</span>
								</div>
							{/each}
							{#if calDay.bills.length > 2}
								<p class="px-1 text-[10px] text-surface-500">
									+{calDay.bills.length - 2} more
								</p>
							{/if}
						</div>
					{/if}

					<!-- Total due indicator -->
					{#if calDay.totalDue > 0}
						<div class="absolute bottom-1 right-1 rounded bg-surface-700/80 px-1 text-[9px] font-medium text-surface-400 opacity-0 transition group-hover:opacity-100">
							{fmt(calDay.totalDue)}
						</div>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Legend -->
		<div class="flex items-center gap-4 border-t border-surface-700 px-4 py-2.5">
			<div class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-full bg-green-500"></span>
				<span class="text-xs text-surface-400">Paid</span>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-full bg-red-500"></span>
				<span class="text-xs text-surface-400">Overdue</span>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
				<span class="text-xs text-surface-400">Upcoming</span>
			</div>
		</div>
	</Card>
</div>

<!-- Day Detail Modal -->
<Modal open={showDayDetail} onclose={() => (showDayDetail = false)} title={selectedDate ? formatFullDate(selectedDate) : 'Day Detail'}>
	{#if selectedDayBills.length > 0}
		<div class="space-y-3">
			{#each selectedDayBills as bill}
				<div
					class="flex items-center justify-between rounded-lg p-3"
					style="background-color: {getBillBgColor(bill)}"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<p class="truncate text-sm font-medium text-white">{bill.name}</p>
							<span
								class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
								style="background-color: {getBillBgColor(bill)}; color: {getBillColor(bill)}"
							>
								{getBillLabel(bill)}
							</span>
						</div>
						<div class="mt-1 flex items-center gap-2 text-xs text-surface-400">
							<span>{bill.category}</span>
							<span>-</span>
							<span class="capitalize">{bill.frequency}</span>
							{#if bill.accountName}
								<span>-</span>
								<span>{bill.accountName}</span>
							{/if}
						</div>
					</div>
					<div class="ml-3 flex items-center gap-2">
						<span class="text-sm font-bold text-white">{fmt(bill.amount)}</span>
						{#if !bill.isPaid}
							<form method="POST" action="?/markPaid" use:enhance>
								<input type="hidden" name="id" value={bill.id} />
								<Button type="submit" size="sm" variant="primary">
									Mark Paid
								</Button>
							</form>
						{/if}
					</div>
				</div>
			{/each}

			<!-- Day total -->
			<div class="flex items-center justify-between border-t border-surface-700 pt-3">
				<span class="text-sm text-surface-400">Total for this day</span>
				<span class="text-sm font-bold text-white">
					{fmt(selectedDayBills.reduce((sum: number, b: any) => sum + b.amount, 0))}
				</span>
			</div>
		</div>
	{:else}
		<div class="py-8 text-center">
			<svg class="mx-auto h-12 w-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
			<p class="mt-3 text-sm text-surface-400">No bills due on this day</p>
		</div>
	{/if}
</Modal>
