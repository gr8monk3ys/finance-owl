import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { cancellationRequests } from './cancellation.schema';
import {
  findCancellationInfo,
  getGenericCancellationInfo,
  type CancellationInfo,
} from './cancellation-instructions';

const FREQUENCY_ANNUAL_MULTIPLIER: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

@Injectable()
export class CancellationService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async requestCancellation(
    userId: string,
    subscriptionId: string,
    reason?: string,
  ) {
    // Verify subscription belongs to user
    const [subscription] = await this.db
      .select()
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.id, subscriptionId),
          eq(schema.recurringTransactions.userId, userId),
        ),
      )
      .limit(1);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Generate cancellation instructions
    const merchantName =
      subscription.merchantName || subscription.name;
    const instructions = this.getCancellationInstructions(merchantName);

    const [request] = await this.db
      .insert(cancellationRequests)
      .values({
        userId,
        subscriptionId,
        status: 'pending',
        method: instructions.methods[0] || 'self_service',
        cancellationInstructions: JSON.stringify(instructions.steps),
        providerContactInfo: JSON.stringify({
          phone: instructions.phone || null,
          email: instructions.email || null,
          website: instructions.website || null,
          chatUrl: instructions.chatUrl || null,
        }),
        reason: reason || null,
      })
      .returning();

    return {
      ...request,
      cancellationInstructions: instructions.steps,
      providerContactInfo: {
        phone: instructions.phone || null,
        email: instructions.email || null,
        website: instructions.website || null,
        chatUrl: instructions.chatUrl || null,
      },
    };
  }

  async getCancellationRequests(userId: string) {
    const requests = await this.db
      .select({
        id: cancellationRequests.id,
        subscriptionId: cancellationRequests.subscriptionId,
        status: cancellationRequests.status,
        method: cancellationRequests.method,
        cancellationInstructions: cancellationRequests.cancellationInstructions,
        providerContactInfo: cancellationRequests.providerContactInfo,
        cancellationConfirmedAt: cancellationRequests.cancellationConfirmedAt,
        reason: cancellationRequests.reason,
        notes: cancellationRequests.notes,
        createdAt: cancellationRequests.createdAt,
        updatedAt: cancellationRequests.updatedAt,
        subscriptionName: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
      })
      .from(cancellationRequests)
      .leftJoin(
        schema.recurringTransactions,
        eq(
          cancellationRequests.subscriptionId,
          schema.recurringTransactions.id,
        ),
      )
      .where(eq(cancellationRequests.userId, userId))
      .orderBy(desc(cancellationRequests.createdAt));

    return requests.map((r) => ({
      ...r,
      cancellationInstructions: r.cancellationInstructions
        ? JSON.parse(r.cancellationInstructions)
        : [],
      providerContactInfo: r.providerContactInfo
        ? JSON.parse(r.providerContactInfo)
        : null,
    }));
  }

  async getCancellationRequest(userId: string, id: string) {
    const [request] = await this.db
      .select({
        id: cancellationRequests.id,
        subscriptionId: cancellationRequests.subscriptionId,
        status: cancellationRequests.status,
        method: cancellationRequests.method,
        cancellationInstructions: cancellationRequests.cancellationInstructions,
        providerContactInfo: cancellationRequests.providerContactInfo,
        cancellationConfirmedAt: cancellationRequests.cancellationConfirmedAt,
        reason: cancellationRequests.reason,
        notes: cancellationRequests.notes,
        createdAt: cancellationRequests.createdAt,
        updatedAt: cancellationRequests.updatedAt,
        subscriptionName: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
        isActive: schema.recurringTransactions.isActive,
      })
      .from(cancellationRequests)
      .leftJoin(
        schema.recurringTransactions,
        eq(
          cancellationRequests.subscriptionId,
          schema.recurringTransactions.id,
        ),
      )
      .where(
        and(
          eq(cancellationRequests.id, id),
          eq(cancellationRequests.userId, userId),
        ),
      )
      .limit(1);

    if (!request) {
      throw new NotFoundException('Cancellation request not found');
    }

    return {
      ...request,
      cancellationInstructions: request.cancellationInstructions
        ? JSON.parse(request.cancellationInstructions)
        : [],
      providerContactInfo: request.providerContactInfo
        ? JSON.parse(request.providerContactInfo)
        : null,
    };
  }

  async updateStatus(
    userId: string,
    id: string,
    status: string,
    notes?: string,
  ) {
    await this.getCancellationRequest(userId, id);

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const [updated] = await this.db
      .update(cancellationRequests)
      .set(updateData)
      .where(
        and(
          eq(cancellationRequests.id, id),
          eq(cancellationRequests.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async confirmCancellation(userId: string, id: string) {
    const request = await this.getCancellationRequest(userId, id);

    // Mark cancellation request as completed
    const [updated] = await this.db
      .update(cancellationRequests)
      .set({
        status: 'completed',
        cancellationConfirmedAt: new Date().toISOString(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cancellationRequests.id, id),
          eq(cancellationRequests.userId, userId),
        ),
      )
      .returning();

    // Deactivate the subscription
    await this.db
      .update(schema.recurringTransactions)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.recurringTransactions.id, request.subscriptionId),
          eq(schema.recurringTransactions.userId, userId),
        ),
      );

    return updated;
  }

  getCancellationInstructions(merchantName: string): CancellationInfo {
    const info = findCancellationInfo(merchantName);
    if (info) {
      return info;
    }
    return getGenericCancellationInfo(merchantName);
  }

  async getCancellationInstructionsForSubscription(
    userId: string,
    subscriptionId: string,
  ) {
    const [subscription] = await this.db
      .select({
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.id, subscriptionId),
          eq(schema.recurringTransactions.userId, userId),
        ),
      )
      .limit(1);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const merchantName =
      subscription.merchantName || subscription.name;
    return this.getCancellationInstructions(merchantName);
  }

  async getCancellationStats(userId: string) {
    const requests = await this.db
      .select({
        status: cancellationRequests.status,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
      })
      .from(cancellationRequests)
      .leftJoin(
        schema.recurringTransactions,
        eq(
          cancellationRequests.subscriptionId,
          schema.recurringTransactions.id,
        ),
      )
      .where(eq(cancellationRequests.userId, userId));

    let totalRequested = 0;
    let totalCompleted = 0;
    let estimatedMonthlySavings = 0;
    let estimatedAnnualSavings = 0;

    for (const req of requests) {
      totalRequested++;

      if (req.status === 'completed' && req.estimatedAmount && req.frequency) {
        totalCompleted++;
        const annualMultiplier =
          FREQUENCY_ANNUAL_MULTIPLIER[req.frequency] ?? 12;
        const annualAmount = req.estimatedAmount * annualMultiplier;
        estimatedAnnualSavings += annualAmount;
        estimatedMonthlySavings += annualAmount / 12;
      }
    }

    return {
      totalRequested,
      totalCompleted,
      totalPending: totalRequested - totalCompleted,
      estimatedMonthlySavings:
        Math.round(estimatedMonthlySavings * 100) / 100,
      estimatedAnnualSavings:
        Math.round(estimatedAnnualSavings * 100) / 100,
    };
  }
}
