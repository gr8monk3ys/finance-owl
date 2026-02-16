import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { creditScores, creditFactors, creditAlerts } from './credit.schema';
import { CreditSimulatorService } from './credit-simulator.service';
import { BureauFactory } from './providers/bureau.factory';
import type { AddScoreDto } from './dto/add-score.dto';
import type { SimulateDto } from './dto/simulate.dto';

@Injectable()
export class CreditService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private simulatorService: CreditSimulatorService,
    private bureauFactory: BureauFactory,
  ) {}

  async getCurrentScore(userId: string) {
    const [latestScore] = await this.db
      .select()
      .from(creditScores)
      .where(eq(creditScores.userId, userId))
      .orderBy(desc(creditScores.createdAt))
      .limit(1);

    if (!latestScore) {
      return null;
    }

    const factors = await this.db
      .select()
      .from(creditFactors)
      .where(
        and(
          eq(creditFactors.userId, userId),
          eq(creditFactors.scoreId, latestScore.id),
        ),
      );

    return {
      ...latestScore,
      factors,
    };
  }

  async getScoreHistory(userId: string, months: number = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const start = startDate.toISOString().split('T')[0];

    return this.db
      .select({
        id: creditScores.id,
        score: creditScores.score,
        source: creditScores.source,
        scoreType: creditScores.scoreType,
        reportDate: creditScores.reportDate,
        createdAt: creditScores.createdAt,
      })
      .from(creditScores)
      .where(
        and(
          eq(creditScores.userId, userId),
          gte(creditScores.reportDate, start),
        ),
      )
      .orderBy(creditScores.reportDate);
  }

  async addScore(userId: string, dto: AddScoreDto) {
    const reportDate =
      dto.reportDate || new Date().toISOString().split('T')[0];

    // Check for previous score to generate alerts
    const [previousScore] = await this.db
      .select({ score: creditScores.score })
      .from(creditScores)
      .where(eq(creditScores.userId, userId))
      .orderBy(desc(creditScores.createdAt))
      .limit(1);

    // Insert the new score
    const [newScore] = await this.db
      .insert(creditScores)
      .values({
        userId,
        score: dto.score,
        source: dto.source,
        scoreType: dto.scoreType,
        reportDate,
      })
      .returning();

    // Insert factors if provided
    if (dto.factors && dto.factors.length > 0) {
      await this.db.insert(creditFactors).values(
        dto.factors.map((f) => ({
          userId,
          scoreId: newScore.id,
          factor: f.factor,
          value: f.value,
          impact: f.impact,
          status: f.status,
        })),
      );
    }

    // Generate score change alert
    if (previousScore) {
      const change = dto.score - previousScore.score;
      if (change !== 0) {
        await this.db.insert(creditAlerts).values({
          userId,
          alertType: 'score_change',
          description: `Your credit score ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change)} points to ${dto.score}.`,
          previousValue: String(previousScore.score),
          newValue: String(dto.score),
        });
      }
    }

    return this.getCurrentScore(userId);
  }

  async getFactors(userId: string) {
    // Get the latest score's factors
    const [latestScore] = await this.db
      .select({ id: creditScores.id })
      .from(creditScores)
      .where(eq(creditScores.userId, userId))
      .orderBy(desc(creditScores.createdAt))
      .limit(1);

    if (!latestScore) {
      return [];
    }

    return this.db
      .select()
      .from(creditFactors)
      .where(
        and(
          eq(creditFactors.userId, userId),
          eq(creditFactors.scoreId, latestScore.id),
        ),
      );
  }

  async getAlerts(userId: string) {
    return this.db
      .select()
      .from(creditAlerts)
      .where(eq(creditAlerts.userId, userId))
      .orderBy(desc(creditAlerts.createdAt))
      .limit(20);
  }

  async simulateScoreChange(userId: string, dto: SimulateDto) {
    const currentData = await this.getCurrentScore(userId);

    if (!currentData) {
      // If no score exists, use a default baseline
      const defaultFactors = [
        { factor: 'payment_history', value: '100%', impact: 'high', status: 'good' },
        { factor: 'credit_utilization', value: '30%', impact: 'high', status: 'fair' },
        { factor: 'credit_age', value: '3 years', impact: 'medium', status: 'fair' },
        { factor: 'total_accounts', value: '5', impact: 'medium', status: 'fair' },
        { factor: 'hard_inquiries', value: '1', impact: 'low', status: 'good' },
        { factor: 'derogatory_marks', value: '0', impact: 'low', status: 'good' },
      ];

      return this.simulatorService.simulate(700, defaultFactors, dto.scenario, {
        amount: dto.amount,
        currentUtilization: dto.currentUtilization,
        targetUtilization: dto.targetUtilization,
      });
    }

    return this.simulatorService.simulate(
      currentData.score,
      currentData.factors,
      dto.scenario,
      {
        amount: dto.amount,
        currentUtilization: dto.currentUtilization,
        targetUtilization: dto.targetUtilization,
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Bureau-backed methods
  // ---------------------------------------------------------------------------

  async getCreditReport(userId: string) {
    const provider = this.bureauFactory.getDefaultProvider();
    return provider.getCreditReport(userId);
  }

  async getCreditFactorsFromBureau(userId: string) {
    const provider = this.bureauFactory.getDefaultProvider();
    return provider.getCreditFactors(userId);
  }

  async fileDispute(userId: string, disputeData: {
    accountId: string;
    reason: 'not_mine' | 'incorrect_balance' | 'incorrect_status' | 'incorrect_date' | 'other';
    explanation: string;
    supportingDocuments?: string[];
  }) {
    const provider = this.bureauFactory.getDefaultProvider();
    return provider.fileDispute(userId, disputeData);
  }

  async getDisputes(userId: string) {
    // Return disputes from the credit alerts table where alertType matches dispute patterns
    // In a full implementation, disputes would have their own table; for now we
    // aggregate from bureau provider simulated state.
    return this.db
      .select()
      .from(creditAlerts)
      .where(
        and(
          eq(creditAlerts.userId, userId),
          eq(creditAlerts.alertType, 'dispute_filed'),
        ),
      )
      .orderBy(desc(creditAlerts.createdAt))
      .limit(20);
  }

  async getDisputeById(disputeId: string) {
    const provider = this.bureauFactory.getDefaultProvider();
    return provider.getDisputeStatus(disputeId);
  }

  async markAlertRead(userId: string, alertId: string) {
    const [alert] = await this.db
      .select()
      .from(creditAlerts)
      .where(
        and(
          eq(creditAlerts.id, alertId),
          eq(creditAlerts.userId, userId),
        ),
      )
      .limit(1);

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    await this.db
      .update(creditAlerts)
      .set({ isRead: 1 })
      .where(eq(creditAlerts.id, alertId));

    return { ...alert, isRead: 1 };
  }

  async setupMonitoring(userId: string) {
    const provider = this.bureauFactory.getDefaultProvider();
    const result = await provider.setupMonitoring(userId);

    // Record the enrollment as an alert
    await this.db.insert(creditAlerts).values({
      userId,
      alertType: 'monitoring_enrolled',
      description: `Credit monitoring enabled via ${result.bureau}. Alert types: ${result.alertTypes.join(', ')}.`,
    });

    return result;
  }
}
