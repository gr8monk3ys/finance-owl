<script lang="ts">
	import { Button } from '$components/ui';

	interface Bill {
		id?: string;
		name: string;
		merchantName?: string;
		estimatedAmount: number;
		expectedDate: string;
		categoryName?: string;
		categoryColor?: string;
	}

	interface Props {
		bills: Bill[];
		onSelectDay?: (date: string, bills: Bill[]) => void;
	}

	let { bills, onSelectDay }: Props = $props();

	let currentDate = $state(new Date());
	let selectedDate = $state<string | null>(null);

	const currentYear = $derived(currentDate.getFullYear());
	const currentMonth = $derived(currentDate.getMonth());

	const monthLabel = $derived(
		currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	);

	function prevMonth(): void {
		const d = new Date(currentDate);
		d.setMonth(d.getMonth() - 1);
		currentDate = d;
		selectedDate = null;
	}

	function nextMonth(): void {
		const d = new Date(currentDate);
		d.setMonth(d.getMonth() + 1);
		currentDate = d;
		selectedDate = null;
	}

	function goToToday(): void {
		currentDate = new Date();
		selectedDate = null;
	}

	// Build calendar grid
	const calendarDays = $derived.by(() => {
		const firstDay = new Date(currentYear, currentMonth, 1);
		const lastDay = new Date(currentYear, currentMonth + 1, 0);
		const startDayOfWeek = firstDay.getDay();
		const daysInMonth = lastDay.getDate();

		const days: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

		// Previous month padding
		const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
		for (let i = startDayOfWeek - 1; i >= 0; i--) {
			const day = prevMonthLastDay - i;
			const d = new Date(currentYear, currentMonth - 1, day);
			days.push({
				day,
				isCurrentMonth: false,
				dateStr: d.toISOString().split('T')[0]
			});
		}

		// Current month
		for (let day = 1; day <= daysInMonth; day++) {
			const d = new Date(currentYear, currentMonth, day);
			days.push({
				day,
				isCurrentMonth: true,
				dateStr: d.toISOString().split('T')[0]
			});
		}

		// Next month padding
		const remaining = 42 - days.length;
		for (let day = 1; day <= remaining; day++) {
			const d = new Date(currentYear, currentMonth + 1, day);
			days.push({
				day,
				isCurrentMonth: false,
				dateStr: d.toISOString().split('T')[0]
			});
		}

		return days;
	});

	// Group bills by date
	const billsByDate = $derived.by(() => {
		const map = new Map<string, Bill[]>();
		for (const bill of bills) {
			const date = bill.expectedDate;
			if (!map.has(date)) {
				map.set(date, []);
			}
			map.get(date)!.push(bill);
		}
		return map;
	});

	const todayStr = $derived(new Date().toISOString().split('T')[0]);

	const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function handleDayClick(dateStr: string) {
		if (selectedDate === dateStr) {
			selectedDate = null;
		} else {
			selectedDate = dateStr;
		}
		const dayBills = billsByDate.get(dateStr) ?? [];
		onSelectDay?.(dateStr, dayBills);
	}

	function getBillStatus(bill: Bill): 'overdue' | 'today' | 'upcoming' {
		if (bill.expectedDate < todayStr) return 'overdue';
		if (bill.expectedDate === todayStr) return 'today';
		return 'upcoming';
	}

	// Bills for the selected day
	const selectedDayBills = $derived(
		selectedDate ? (billsByDate.get(selectedDate) ?? []) : []
	);

	// Monthly totals
	const monthBills = $derived.by(() => {
		const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
		const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
		return bills.filter((b) => b.expectedDate >= monthStart && b.expectedDate <= monthEnd);
	});

	const monthTotal = $derived(
		monthBills.reduce((sum, b) => sum + b.estimatedAmount, 0)
	);
</script>

<div class="space-y-4">
	<!-- Calendar navigation -->
	<div class="flex items-center justify-between">
		<Button variant="ghost" size="sm" onclick={prevMonth}>
			<svg
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</Button>
		<div class="flex items-center gap-2">
			<h3 class="text-lg font-semibold text-white">{monthLabel}</h3>
			<button
				type="button"
				class="rounded px-2 py-0.5 text-xs text-primary-400 hover:bg-surface-700"
				onclick={goToToday}
			>
				Today
			</button>
		</div>
		<Button variant="ghost" size="sm" onclick={nextMonth}>
			<svg
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
		</Button>
	</div>

	<!-- Weekday headers -->
	<div class="grid grid-cols-7 border-b border-surface-700">
		{#each weekdays as day}
			<div class="py-2 text-center text-xs font-medium text-surface-400">
				{day}
			</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="grid grid-cols-7">
		{#each calendarDays as calDay}
			<button
				type="button"
				class="min-h-[80px] border-b border-r border-surface-700 p-1 text-left transition hover:bg-surface-700/50 {calDay.isCurrentMonth
					? ''
					: 'bg-surface-900/30'} {selectedDate === calDay.dateStr
					? 'ring-1 ring-primary-500 bg-primary-500/5'
					: ''}"
				onclick={() => handleDayClick(calDay.dateStr)}
			>
				<p
					class="text-xs font-medium {calDay.dateStr === todayStr
						? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white'
						: calDay.isCurrentMonth
							? 'text-surface-300'
							: 'text-surface-600'}"
				>
					{calDay.day}
				</p>

				{#if billsByDate.has(calDay.dateStr)}
					<div class="mt-1 space-y-0.5">
						{#each (billsByDate.get(calDay.dateStr) ?? []).slice(0, 3) as bill}
							{@const status = getBillStatus(bill)}
							<div
								class="flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs"
								style="background-color: {status === 'overdue'
									? 'rgba(239, 68, 68, 0.12)'
									: bill.categoryColor
										? bill.categoryColor + '20'
										: 'rgba(139, 92, 246, 0.12)'};
								color: {status === 'overdue'
									? '#ef4444'
									: bill.categoryColor ?? '#a78bfa'}"
								title="{bill.merchantName || bill.name}: {fmt(bill.estimatedAmount)}"
							>
								{#if status === 'overdue'}
									<svg class="h-2.5 w-2.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
											clip-rule="evenodd"
										/>
									</svg>
								{/if}
								<span class="truncate">{fmt(bill.estimatedAmount)}</span>
							</div>
						{/each}
						{#if (billsByDate.get(calDay.dateStr) ?? []).length > 3}
							<p class="px-1 text-xs text-surface-500">
								+{(billsByDate.get(calDay.dateStr) ?? []).length - 3} more
							</p>
						{/if}
					</div>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Selected day detail -->
	{#if selectedDate && selectedDayBills.length > 0}
		<div class="rounded-xl bg-surface-800 p-4">
			<h4 class="text-sm font-semibold text-white">
				Bills for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric'
				})}
			</h4>
			<div class="mt-2 divide-y divide-surface-700">
				{#each selectedDayBills as bill}
					{@const status = getBillStatus(bill)}
					<div class="flex items-center justify-between py-2.5">
						<div class="flex items-center gap-3">
							{#if status === 'overdue'}
								<span class="flex h-6 w-6 items-center justify-center rounded-full bg-red-400/10">
									<svg class="h-3.5 w-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
											clip-rule="evenodd"
										/>
									</svg>
								</span>
							{:else if bill.categoryColor}
								<span
									class="h-2.5 w-2.5 rounded-full"
									style="background-color: {bill.categoryColor}"
								></span>
							{/if}
							<div>
								<p class="text-sm font-medium text-white">
									{bill.merchantName || bill.name}
								</p>
								<p class="text-xs text-surface-500">
									{#if status === 'overdue'}
										<span class="text-red-400">Overdue</span>
									{:else if status === 'today'}
										<span class="text-amber-400">Due today</span>
									{:else}
										Upcoming
									{/if}
									{#if bill.categoryName}
										<span style="color: {bill.categoryColor}"> - {bill.categoryName}</span>
									{/if}
								</p>
							</div>
						</div>
						<span class="text-sm font-semibold text-white">
							{fmt(bill.estimatedAmount)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{:else if selectedDate}
		<div class="rounded-xl bg-surface-800 p-4 text-center">
			<p class="text-sm text-surface-500">No bills due on this day</p>
		</div>
	{/if}

	<!-- Monthly total -->
	<div class="flex items-center justify-between rounded-xl bg-surface-800 px-4 py-3">
		<span class="text-sm text-surface-400">Total for {monthLabel}</span>
		<div class="text-right">
			<span class="text-sm font-bold text-white">{fmt(monthTotal)}</span>
			<span class="ml-1 text-xs text-surface-500">
				({monthBills.length} bill{monthBills.length !== 1 ? 's' : ''})
			</span>
		</div>
	</div>
</div>
