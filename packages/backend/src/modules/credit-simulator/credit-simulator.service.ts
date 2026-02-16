import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface SimulationScenario {
  type:
    | 'pay_debt'
    | 'open_card'
    | 'close_card'
    | 'hard_inquiry'
    | 'on_time_payments'
    | 'increase_limit';
  parameters: Record<string, number>;
}

export interface SimulationResult {
  scenarioType: string;
  parameters: Record<string, number>;
  currentScore: number;
  estimatedImpact: number;
  estimatedNewScore: number;
  explanation: string;
}

@Injectable()
export class CreditSimulatorService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getProfile(userId: string) {
    const [profile] = await this.db
      .select()
      .from(schema.creditProfiles)
      .where(eq(schema.creditProfiles.userId, userId))
      .orderBy(desc(schema.creditProfiles.updatedAt))
      .limit(1);

    return profile ?? null;
  }

  async upsertProfile(
    userId: string,
    data: {
      currentScore: number;
      scoreDate: string;
      paymentHistory: number;
      creditUtilization: number;
      accountAge: number;
      totalAccounts: number;
      hardInquiries: number;
      derogatoryMarks: number;
      totalDebt: number;
      availableCredit: number;
    },
  ) {
    const existing = await this.db
      .select({ id: schema.creditProfiles.id })
      .from(schema.creditProfiles)
      .where(eq(schema.creditProfiles.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(schema.creditProfiles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.creditProfiles.id, existing[0].id))
        .returning();

      return updated;
    }

    const [created] = await this.db
      .insert(schema.creditProfiles)
      .values({ userId, ...data })
      .returning();

    return created;
  }

  async simulate(
    userId: string,
    scenario: SimulationScenario,
  ): Promise<SimulationResult> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new NotFoundException(
        'Credit profile not found. Please create a profile first.',
      );
    }

    const { impact, explanation } = this.calculateImpact(profile, scenario);
    const estimatedNewScore = this.clampScore(profile.currentScore + impact);

    // Save simulation to history
    await this.db.insert(schema.creditSimulations).values({
      userId,
      profileId: profile.id,
      scenarioType: scenario.type,
      parameters: JSON.stringify(scenario.parameters),
      estimatedImpact: impact,
      estimatedNewScore,
    });

    return {
      scenarioType: scenario.type,
      parameters: scenario.parameters,
      currentScore: profile.currentScore,
      estimatedImpact: impact,
      estimatedNewScore,
      explanation,
    };
  }

  async getSimulationHistory(userId: string) {
    const simulations = await this.db
      .select()
      .from(schema.creditSimulations)
      .where(eq(schema.creditSimulations.userId, userId))
      .orderBy(desc(schema.creditSimulations.createdAt))
      .limit(50);

    return simulations.map((sim) => ({
      ...sim,
      parameters: JSON.parse(sim.parameters),
    }));
  }

  private calculateImpact(
    profile: typeof schema.creditProfiles.$inferSelect,
    scenario: SimulationScenario,
  ): { impact: number; explanation: string } {
    switch (scenario.type) {
      case 'pay_debt':
        return this.simulatePayDebt(profile, scenario.parameters);
      case 'open_card':
        return this.simulateOpenCard(profile, scenario.parameters);
      case 'close_card':
        return this.simulateCloseCard(profile, scenario.parameters);
      case 'hard_inquiry':
        return this.simulateHardInquiry(profile);
      case 'on_time_payments':
        return this.simulateOnTimePayments(profile, scenario.parameters);
      case 'increase_limit':
        return this.simulateIncreaseLimit(profile, scenario.parameters);
      default:
        return { impact: 0, explanation: 'Unknown scenario type.' };
    }
  }

  private simulatePayDebt(
    profile: typeof schema.creditProfiles.$inferSelect,
    params: Record<string, number>,
  ): { impact: number; explanation: string } {
    const paymentAmount = params.amount ?? 0;
    if (paymentAmount <= 0 || profile.availableCredit <= 0) {
      return { impact: 0, explanation: 'No meaningful debt payment to simulate.' };
    }

    const currentUtilization = profile.creditUtilization;
    const totalCredit = profile.availableCredit + profile.totalDebt;
    const newDebt = Math.max(0, profile.totalDebt - paymentAmount);
    const newUtilization = totalCredit > 0 ? newDebt / totalCredit : 0;
    const utilizationDrop = currentUtilization - newUtilization;

    // Utilization improvement: 10-50 points depending on how much it drops
    const impact = Math.round(utilizationDrop * 100 * 0.5);
    const clampedImpact = Math.max(10, Math.min(50, impact));

    return {
      impact: clampedImpact,
      explanation: `Paying off $${paymentAmount.toLocaleString()} would reduce your utilization from ${(currentUtilization * 100).toFixed(0)}% to ${(newUtilization * 100).toFixed(0)}%, potentially increasing your score by ${clampedImpact} points.`,
    };
  }

  private simulateOpenCard(
    profile: typeof schema.creditProfiles.$inferSelect,
    params: Record<string, number>,
  ): { impact: number; explanation: string } {
    const newCreditLimit = params.creditLimit ?? 5000;

    // Hard inquiry penalty: -5 to -15
    const inquiryPenalty = -(5 + Math.min(10, profile.hardInquiries * 2));

    // Utilization benefit from increased available credit
    const totalCredit = profile.availableCredit + profile.totalDebt + newCreditLimit;
    const newUtilization = totalCredit > 0 ? profile.totalDebt / totalCredit : 0;
    const utilizationBenefit = Math.round(
      (profile.creditUtilization - newUtilization) * 100 * 0.3,
    );
    const clampedBenefit = Math.max(5, Math.min(20, utilizationBenefit));

    const impact = inquiryPenalty + clampedBenefit;

    return {
      impact,
      explanation: `Opening a new card with $${newCreditLimit.toLocaleString()} limit would cause a hard inquiry (${inquiryPenalty} points) but lower your utilization (+${clampedBenefit} points), for a net impact of ${impact > 0 ? '+' : ''}${impact} points.`,
    };
  }

  private simulateCloseCard(
    profile: typeof schema.creditProfiles.$inferSelect,
    params: Record<string, number>,
  ): { impact: number; explanation: string } {
    const cardLimit = params.creditLimit ?? 5000;
    const cardAgeMonths = params.cardAgeMonths ?? 24;

    // Higher utilization from losing available credit
    const newAvailable = Math.max(0, profile.availableCredit - cardLimit);
    const totalCredit = newAvailable + profile.totalDebt;
    const newUtilization = totalCredit > 0 ? profile.totalDebt / totalCredit : 0;
    const utilizationIncrease = newUtilization - profile.creditUtilization;
    const utilizationPenalty = -Math.round(
      Math.max(5, Math.min(20, utilizationIncrease * 100 * 0.5)),
    );

    // Lower average age penalty
    const agePenalty = cardAgeMonths > profile.accountAge ? -5 : -3;

    const impact = utilizationPenalty + agePenalty;

    return {
      impact,
      explanation: `Closing a card with $${cardLimit.toLocaleString()} limit would increase your utilization (${utilizationPenalty} points) and reduce your average account age (${agePenalty} points), for a total impact of ${impact} points.`,
    };
  }

  private simulateHardInquiry(
    profile: typeof schema.creditProfiles.$inferSelect,
  ): { impact: number; explanation: string } {
    // Each inquiry typically costs 2-5 points, more if you already have many
    const basePenalty = -3;
    const extraPenalty = profile.hardInquiries >= 3 ? -2 : 0;
    const impact = basePenalty + extraPenalty;

    return {
      impact,
      explanation: `A hard inquiry would temporarily reduce your score by ${Math.abs(impact)} points. You currently have ${profile.hardInquiries} inquiries on file.`,
    };
  }

  private simulateOnTimePayments(
    profile: typeof schema.creditProfiles.$inferSelect,
    params: Record<string, number>,
  ): { impact: number; explanation: string } {
    const months = params.months ?? 6;
    const periodsOfSix = Math.floor(months / 6);

    if (periodsOfSix <= 0) {
      return {
        impact: 0,
        explanation: 'At least 6 months of on-time payments are needed to see improvement.',
      };
    }

    // +5 to +15 per 6-month period, with diminishing returns
    const baseGain = profile.paymentHistory < 0.9 ? 15 : 10;
    const impact = Math.min(
      45,
      periodsOfSix * Math.max(5, baseGain - (periodsOfSix - 1) * 2),
    );

    return {
      impact,
      explanation: `Making ${months} months of on-time payments would demonstrate payment reliability, potentially increasing your score by ${impact} points.`,
    };
  }

  private simulateIncreaseLimit(
    profile: typeof schema.creditProfiles.$inferSelect,
    params: Record<string, number>,
  ): { impact: number; explanation: string } {
    const increaseAmount = params.amount ?? 5000;

    const totalCredit = profile.availableCredit + profile.totalDebt + increaseAmount;
    const newUtilization = totalCredit > 0 ? profile.totalDebt / totalCredit : 0;
    const utilizationDrop = profile.creditUtilization - newUtilization;

    const impact = Math.round(
      Math.max(5, Math.min(30, utilizationDrop * 100 * 0.5)),
    );

    return {
      impact,
      explanation: `Increasing your credit limit by $${increaseAmount.toLocaleString()} would lower your utilization from ${(profile.creditUtilization * 100).toFixed(0)}% to ${(newUtilization * 100).toFixed(0)}%, potentially boosting your score by ${impact} points.`,
    };
  }

  private clampScore(score: number): number {
    return Math.max(300, Math.min(850, score));
  }
}
