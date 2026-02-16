import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { debts, debtPayments } from './debt-payoff.schema';

interface DebtSnapshot {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

export interface MonthEntry {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface DebtSchedule {
  debtId: string;
  debtName: string;
  startingBalance: number;
  interestRate: number;
  months: MonthEntry[];
  totalPaid: number;
  totalInterest: number;
  payoffMonth: number;
}

export interface PayoffPlan {
  strategy: string;
  extraMonthlyPayment: number;
  schedules: DebtSchedule[];
  totalMonths: number;
  totalPaid: number;
  totalInterest: number;
  debtFreeDate: string;
  interestSavedVsMinimum: number;
  minimumOnlyTotalInterest: number;
  minimumOnlyTotalMonths: number;
}

@Injectable()
export class DebtPayoffService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getDebts(userId: string) {
    const rows = await this.db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(desc(debts.createdAt));

    return rows.map((debt) => {
      const progress =
        debt.originalBalance && debt.originalBalance > 0
          ? Math.min(
              ((debt.originalBalance - debt.currentBalance) /
                debt.originalBalance) *
                100,
              100,
            )
          : 0;

      return { ...debt, progress };
    });
  }

  async findById(userId: string, id: string) {
    const [debt] = await this.db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .limit(1);

    if (!debt) throw new NotFoundException('Debt not found');
    return debt;
  }

  async addDebt(
    userId: string,
    data: {
      name: string;
      type: string;
      currentBalance: number;
      interestRate: number;
      minimumPayment: number;
      originalBalance?: number;
      lender?: string;
      dueDay?: number;
    },
  ) {
    const [debt] = await this.db
      .insert(debts)
      .values({
        userId,
        name: data.name,
        type: data.type,
        currentBalance: data.currentBalance,
        interestRate: data.interestRate,
        minimumPayment: data.minimumPayment,
        originalBalance: data.originalBalance ?? data.currentBalance,
        lender: data.lender,
        dueDay: data.dueDay,
      })
      .returning();

    return debt;
  }

  async updateDebt(
    userId: string,
    id: string,
    data: {
      name?: string;
      type?: string;
      currentBalance?: number;
      interestRate?: number;
      minimumPayment?: number;
      originalBalance?: number;
      lender?: string;
      dueDay?: number;
    },
  ) {
    await this.findById(userId, id);

    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    // If balance goes to zero or below, mark as paid off
    if (data.currentBalance !== undefined && data.currentBalance <= 0) {
      updateData.isPaidOff = 1;
      updateData.paidOffDate = new Date().toISOString();
      updateData.currentBalance = 0;
    }

    const [updated] = await this.db
      .update(debts)
      .set(updateData)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning();

    return updated;
  }

  async removeDebt(userId: string, id: string) {
    await this.findById(userId, id);
    await this.db
      .delete(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));
  }

  async recordPayment(
    userId: string,
    debtId: string,
    data: {
      amount: number;
      date?: string;
      isExtra?: boolean;
      notes?: string;
    },
  ) {
    const debt = await this.findById(userId, debtId);

    const paymentDate = data.date || new Date().toISOString().split('T')[0];

    // Calculate interest and principal split
    const monthlyRate = debt.interestRate / 100 / 12;
    const interestPortion = debt.currentBalance * monthlyRate;
    const principalPortion = Math.max(0, data.amount - interestPortion);
    const newBalance = Math.max(0, debt.currentBalance - principalPortion);

    const [payment] = await this.db
      .insert(debtPayments)
      .values({
        debtId,
        userId,
        amount: data.amount,
        date: paymentDate,
        principal: principalPortion,
        interest: interestPortion,
        balanceAfter: newBalance,
        isExtra: data.isExtra ? 1 : 0,
        notes: data.notes,
      })
      .returning();

    // Update debt balance
    const isPaidOff = newBalance <= 0;
    await this.db
      .update(debts)
      .set({
        currentBalance: newBalance,
        isPaidOff: isPaidOff ? 1 : 0,
        paidOffDate: isPaidOff ? new Date().toISOString() : debt.paidOffDate,
        updatedAt: new Date(),
      })
      .where(eq(debts.id, debtId));

    return payment;
  }

  async getPayments(userId: string, debtId: string) {
    await this.findById(userId, debtId);

    return this.db
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.debtId, debtId),
          eq(debtPayments.userId, userId),
        ),
      )
      .orderBy(desc(debtPayments.date));
  }

  async calculatePayoffPlan(
    userId: string,
    strategy: string,
    extraMonthlyPayment: number = 0,
    customOrder?: string[],
  ): Promise<PayoffPlan> {
    const allDebts = await this.db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.isPaidOff, 0)));

    if (allDebts.length === 0) {
      return {
        strategy,
        extraMonthlyPayment,
        schedules: [],
        totalMonths: 0,
        totalPaid: 0,
        totalInterest: 0,
        debtFreeDate: new Date().toISOString().split('T')[0],
        interestSavedVsMinimum: 0,
        minimumOnlyTotalInterest: 0,
        minimumOnlyTotalMonths: 0,
      };
    }

    const debtSnapshots: DebtSnapshot[] = allDebts.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.currentBalance,
      interestRate: d.interestRate,
      minimumPayment: d.minimumPayment,
    }));

    // Calculate minimum-only plan for comparison
    const minOnlyResult = this.simulatePayoff(
      debtSnapshots.map((d) => ({ ...d })),
      'avalanche',
      0,
    );

    // Calculate the requested strategy
    const result = this.simulatePayoff(
      debtSnapshots.map((d) => ({ ...d })),
      strategy,
      extraMonthlyPayment,
      customOrder,
    );

    const now = new Date();
    const debtFreeDate = new Date(
      now.getFullYear(),
      now.getMonth() + result.totalMonths,
      1,
    );

    return {
      strategy,
      extraMonthlyPayment,
      schedules: result.schedules,
      totalMonths: result.totalMonths,
      totalPaid: result.totalPaid,
      totalInterest: result.totalInterest,
      debtFreeDate: debtFreeDate.toISOString().split('T')[0],
      interestSavedVsMinimum: minOnlyResult.totalInterest - result.totalInterest,
      minimumOnlyTotalInterest: minOnlyResult.totalInterest,
      minimumOnlyTotalMonths: minOnlyResult.totalMonths,
    };
  }

  async compareStrategies(userId: string, extraMonthlyPayment: number = 0) {
    const [snowball, avalanche, minimumOnly] = await Promise.all([
      this.calculatePayoffPlan(userId, 'snowball', extraMonthlyPayment),
      this.calculatePayoffPlan(userId, 'avalanche', extraMonthlyPayment),
      this.calculatePayoffPlan(userId, 'avalanche', 0),
    ]);

    return {
      snowball: {
        strategy: 'snowball',
        totalMonths: snowball.totalMonths,
        totalInterest: snowball.totalInterest,
        totalPaid: snowball.totalPaid,
        debtFreeDate: snowball.debtFreeDate,
        interestSaved: minimumOnly.totalInterest - snowball.totalInterest,
      },
      avalanche: {
        strategy: 'avalanche',
        totalMonths: avalanche.totalMonths,
        totalInterest: avalanche.totalInterest,
        totalPaid: avalanche.totalPaid,
        debtFreeDate: avalanche.debtFreeDate,
        interestSaved: minimumOnly.totalInterest - avalanche.totalInterest,
      },
      minimumOnly: {
        strategy: 'minimum_only',
        totalMonths: minimumOnly.totalMonths,
        totalInterest: minimumOnly.totalInterest,
        totalPaid: minimumOnly.totalPaid,
        debtFreeDate: minimumOnly.debtFreeDate,
        interestSaved: 0,
      },
      extraMonthlyPayment,
    };
  }

  async getSummary(userId: string) {
    const allDebts = await this.db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId));

    const activeDebts = allDebts.filter((d) => d.isPaidOff === 0);
    const paidOffDebts = allDebts.filter((d) => d.isPaidOff === 1);

    const totalDebt = activeDebts.reduce(
      (sum, d) => sum + d.currentBalance,
      0,
    );
    const totalMinimumPayments = activeDebts.reduce(
      (sum, d) => sum + d.minimumPayment,
      0,
    );

    // Weighted average interest rate
    const weightedRate =
      totalDebt > 0
        ? activeDebts.reduce(
            (sum, d) => sum + d.interestRate * d.currentBalance,
            0,
          ) / totalDebt
        : 0;

    // Calculate estimated payoff dates using avalanche
    let avalancheMonths = 0;
    let snowballMonths = 0;
    if (activeDebts.length > 0) {
      const snapshots: DebtSnapshot[] = activeDebts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.currentBalance,
        interestRate: d.interestRate,
        minimumPayment: d.minimumPayment,
      }));
      const avalancheResult = this.simulatePayoff(
        snapshots.map((d) => ({ ...d })),
        'avalanche',
        0,
      );
      const snowballResult = this.simulatePayoff(
        snapshots.map((d) => ({ ...d })),
        'snowball',
        0,
      );
      avalancheMonths = avalancheResult.totalMonths;
      snowballMonths = snowballResult.totalMonths;
    }

    const now = new Date();
    const avalancheDate = new Date(
      now.getFullYear(),
      now.getMonth() + avalancheMonths,
      1,
    );
    const snowballDate = new Date(
      now.getFullYear(),
      now.getMonth() + snowballMonths,
      1,
    );

    return {
      totalDebt,
      totalMinimumPayments,
      weightedAvgRate: Math.round(weightedRate * 100) / 100,
      activeDebts: activeDebts.length,
      paidOffDebts: paidOffDebts.length,
      estimatedPayoffDate: avalancheDate.toISOString().split('T')[0],
      estimatedPayoffMonths: avalancheMonths,
      snowballPayoffDate: snowballDate.toISOString().split('T')[0],
      snowballPayoffMonths: snowballMonths,
    };
  }

  // ---- Core Payoff Simulation Engine ----

  private simulatePayoff(
    debtList: DebtSnapshot[],
    strategy: string,
    extraPayment: number,
    customOrder?: string[],
  ): {
    schedules: DebtSchedule[];
    totalMonths: number;
    totalPaid: number;
    totalInterest: number;
  } {
    const MAX_MONTHS = 600; // 50 years safety cap

    // Initialize schedules
    const scheduleMap = new Map<string, DebtSchedule>();
    for (const debt of debtList) {
      scheduleMap.set(debt.id, {
        debtId: debt.id,
        debtName: debt.name,
        startingBalance: debt.balance,
        interestRate: debt.interestRate,
        months: [],
        totalPaid: 0,
        totalInterest: 0,
        payoffMonth: 0,
      });
    }

    // Working balances
    const balances = new Map<string, number>();
    for (const debt of debtList) {
      balances.set(debt.id, debt.balance);
    }

    let month = 0;

    while (month < MAX_MONTHS) {
      // Check if all debts are paid off
      const activeDebts = debtList.filter(
        (d) => (balances.get(d.id) ?? 0) > 0,
      );
      if (activeDebts.length === 0) break;

      month++;

      // Sort active debts by strategy to determine priority for extra payment
      const prioritized = this.prioritizeDebts(
        activeDebts,
        balances,
        strategy,
        customOrder,
      );

      // Calculate total minimum payments needed
      let extraBudget = extraPayment;

      // Also add freed-up minimum payments from paid-off debts
      for (const debt of debtList) {
        const bal = balances.get(debt.id) ?? 0;
        if (bal <= 0) {
          extraBudget += debt.minimumPayment;
        }
      }

      // First pass: apply minimum payments + interest to all active debts
      for (const debt of activeDebts) {
        const balance = balances.get(debt.id) ?? 0;
        if (balance <= 0) continue;

        const monthlyRate = debt.interestRate / 100 / 12;
        const interestCharge = balance * monthlyRate;
        const minPayment = Math.min(debt.minimumPayment, balance + interestCharge);
        const principalPaid = Math.max(0, minPayment - interestCharge);
        const newBalance = Math.max(0, balance - principalPaid);

        balances.set(debt.id, newBalance);

        const schedule = scheduleMap.get(debt.id)!;
        schedule.months.push({
          month,
          payment: minPayment,
          principal: principalPaid,
          interest: interestCharge,
          remainingBalance: newBalance,
        });
        schedule.totalPaid += minPayment;
        schedule.totalInterest += interestCharge;

        if (newBalance <= 0 && schedule.payoffMonth === 0) {
          schedule.payoffMonth = month;
        }
      }

      // Second pass: apply extra payment to priority debt
      let remainingExtra = extraBudget;
      for (const debt of prioritized) {
        if (remainingExtra <= 0) break;

        const balance = balances.get(debt.id) ?? 0;
        if (balance <= 0) continue;

        const extraToApply = Math.min(remainingExtra, balance);
        const newBalance = Math.max(0, balance - extraToApply);
        balances.set(debt.id, newBalance);
        remainingExtra -= extraToApply;

        // Update the last month entry for this debt
        const schedule = scheduleMap.get(debt.id)!;
        const lastEntry = schedule.months[schedule.months.length - 1];
        if (lastEntry && lastEntry.month === month) {
          lastEntry.payment += extraToApply;
          lastEntry.principal += extraToApply;
          lastEntry.remainingBalance = newBalance;
          schedule.totalPaid += extraToApply;
        }

        if (newBalance <= 0 && schedule.payoffMonth === 0) {
          schedule.payoffMonth = month;
        }
      }
    }

    const schedules = Array.from(scheduleMap.values());
    const totalPaid = schedules.reduce((s, d) => s + d.totalPaid, 0);
    const totalInterest = schedules.reduce((s, d) => s + d.totalInterest, 0);

    return {
      schedules,
      totalMonths: month,
      totalPaid,
      totalInterest,
    };
  }

  private prioritizeDebts(
    activeDebts: DebtSnapshot[],
    balances: Map<string, number>,
    strategy: string,
    customOrder?: string[],
  ): DebtSnapshot[] {
    const sorted = [...activeDebts].filter(
      (d) => (balances.get(d.id) ?? 0) > 0,
    );

    switch (strategy) {
      case 'snowball':
        // Smallest balance first
        sorted.sort(
          (a, b) =>
            (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0),
        );
        break;

      case 'avalanche':
        // Highest interest rate first
        sorted.sort((a, b) => b.interestRate - a.interestRate);
        break;

      case 'custom':
        if (customOrder && customOrder.length > 0) {
          sorted.sort((a, b) => {
            const aIndex = customOrder.indexOf(a.id);
            const bIndex = customOrder.indexOf(b.id);
            // Debts not in custom order go to the end
            const aPos = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
            const bPos = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
            return aPos - bPos;
          });
        }
        break;

      default:
        // Default to avalanche
        sorted.sort((a, b) => b.interestRate - a.interestRate);
    }

    return sorted;
  }
}
