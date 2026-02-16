import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { eq, and, desc, sql } from 'drizzle-orm';
import { CurrentUser } from '../../common/decorators';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { negotiationAttempts } from './negotiation-tracking.schema';
import { NegotiationAiService } from './negotiation-ai.service';
import {
  PROVIDER_DATABASE,
  normalizeProviderKey,
  getProvidersByCategory,
} from './providers';

// ─── DTOs ───────────────────────────────────────────────────────────────────

class StartAttemptDto {
  @IsString()
  provider!: string;

  @IsString()
  @IsIn([
    'internet',
    'cable',
    'phone',
    'insurance',
    'medical',
    'utility',
    'streaming',
    'utilities',
    'other',
  ])
  billType!: string;

  @IsNumber()
  @Type(() => Number)
  originalAmount!: number;

  @IsNumber()
  @Type(() => Number)
  targetAmount!: number;

  @IsOptional()
  @IsString()
  billId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['phone', 'email', 'chat', 'in_person'])
  method?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateAttemptDto {
  @IsOptional()
  @IsString()
  @IsIn(['planned', 'in_progress', 'succeeded', 'failed', 'pending_confirmation'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  negotiatedAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['phone', 'email', 'chat', 'in_person'])
  method?: string;
}

class GenerateEmailDto {
  @IsString()
  provider!: string;

  @IsString()
  @IsIn([
    'internet',
    'cable',
    'phone',
    'insurance',
    'medical',
    'utility',
    'streaming',
    'utilities',
    'other',
  ])
  billType!: string;

  @IsNumber()
  @Type(() => Number)
  currentAmount!: number;

  @IsNumber()
  @Type(() => Number)
  targetAmount!: number;
}

// ─── Controller ─────────────────────────────────────────────────────────────

@Controller('bill-negotiation/tracking')
export class NegotiationTrackingController {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private negotiationAiService: NegotiationAiService,
  ) {}

  /**
   * POST /start - Start a new negotiation attempt.
   */
  @Post('start')
  async startAttempt(
    @CurrentUser('id') userId: string,
    @Body() dto: StartAttemptDto,
  ) {
    const [attempt] = await this.db
      .insert(negotiationAttempts)
      .values({
        userId,
        provider: dto.provider,
        billType: dto.billType,
        originalAmount: dto.originalAmount,
        targetAmount: dto.targetAmount,
        billId: dto.billId ?? null,
        method: dto.method ?? 'phone',
        notes: dto.notes ?? null,
        status: 'planned',
      })
      .returning();

    return attempt;
  }

  /**
   * PATCH /:id/update - Update attempt status and result.
   */
  @Patch(':id/update')
  async updateAttempt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAttemptDto,
  ) {
    const [existing] = await this.db
      .select()
      .from(negotiationAttempts)
      .where(
        and(
          eq(negotiationAttempts.id, id),
          eq(negotiationAttempts.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Negotiation attempt not found');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (dto.status) {
      updateData.status = dto.status;

      if (
        dto.status === 'succeeded' ||
        dto.status === 'failed' ||
        dto.status === 'pending_confirmation'
      ) {
        updateData.completedAt = new Date().toISOString();
      }

      if (dto.status === 'in_progress' && existing.status === 'planned') {
        updateData.startedAt = new Date().toISOString();
      }
    }

    if (dto.negotiatedAmount !== undefined) {
      updateData.negotiatedAmount = dto.negotiatedAmount;

      if (dto.negotiatedAmount < existing.originalAmount) {
        const monthlySavings = existing.originalAmount - dto.negotiatedAmount;
        updateData.annualSavings = Math.round(monthlySavings * 12 * 100) / 100;
      }
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    if (dto.method) {
      updateData.method = dto.method;
    }

    const [updated] = await this.db
      .update(negotiationAttempts)
      .set(updateData)
      .where(
        and(
          eq(negotiationAttempts.id, id),
          eq(negotiationAttempts.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  /**
   * GET /attempts - List all negotiation attempts.
   */
  @Get('attempts')
  async listAttempts(@CurrentUser('id') userId: string) {
    return this.db
      .select()
      .from(negotiationAttempts)
      .where(eq(negotiationAttempts.userId, userId))
      .orderBy(desc(negotiationAttempts.createdAt));
  }

  /**
   * GET /attempts/:id - Get a single attempt by ID.
   */
  @Get('attempts/:id')
  async getAttempt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const [attempt] = await this.db
      .select()
      .from(negotiationAttempts)
      .where(
        and(
          eq(negotiationAttempts.id, id),
          eq(negotiationAttempts.userId, userId),
        ),
      )
      .limit(1);

    if (!attempt) {
      throw new NotFoundException('Negotiation attempt not found');
    }

    return attempt;
  }

  /**
   * GET /savings - Total savings summary from tracked attempts.
   */
  @Get('savings')
  async getSavingsSummary(@CurrentUser('id') userId: string) {
    const attempts = await this.db
      .select()
      .from(negotiationAttempts)
      .where(eq(negotiationAttempts.userId, userId));

    const succeeded = attempts.filter((a) => a.status === 'succeeded');
    const totalAttempts = attempts.filter(
      (a) => a.status !== 'planned',
    ).length;

    let totalAnnualSavings = 0;
    let totalMonthlySavings = 0;
    const categoryMap = new Map<
      string,
      { annualSavings: number; count: number }
    >();

    for (const attempt of succeeded) {
      const savings = attempt.annualSavings ?? 0;
      totalAnnualSavings += savings;

      const existing = categoryMap.get(attempt.billType);
      if (existing) {
        existing.annualSavings += savings;
        existing.count += 1;
      } else {
        categoryMap.set(attempt.billType, {
          annualSavings: savings,
          count: 1,
        });
      }
    }

    totalMonthlySavings = Math.round((totalAnnualSavings / 12) * 100) / 100;

    return {
      totalAnnualSavings: Math.round(totalAnnualSavings * 100) / 100,
      totalMonthlySavings,
      successfulAttempts: succeeded.length,
      totalAttempts,
      successRate:
        totalAttempts > 0
          ? Math.round((succeeded.length / totalAttempts) * 100)
          : 0,
      byCategory: Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          annualSavings: Math.round(data.annualSavings * 100) / 100,
          count: data.count,
        }))
        .sort((a, b) => b.annualSavings - a.annualSavings),
      recentSuccesses: succeeded
        .sort(
          (a, b) =>
            new Date(b.completedAt ?? b.createdAt).getTime() -
            new Date(a.completedAt ?? a.createdAt).getTime(),
        )
        .slice(0, 5)
        .map((a) => ({
          provider: a.provider,
          billType: a.billType,
          originalAmount: a.originalAmount,
          negotiatedAmount: a.negotiatedAmount,
          annualSavings: a.annualSavings,
          completedAt: a.completedAt,
        })),
    };
  }

  /**
   * GET /strategy/:billType - Get AI-generated strategy for a bill type.
   */
  @Get('strategy/:billType')
  getStrategy(
    @Param('billType') billType: string,
    @Query('provider') provider?: string,
    @Query('currentAmount') currentAmount?: string,
  ) {
    const amount = currentAmount ? parseFloat(currentAmount) : 100;
    const providerName = provider ?? 'Unknown Provider';

    return this.negotiationAiService.generateNegotiationStrategy(
      billType,
      amount,
      providerName,
    );
  }

  /**
   * GET /script/:provider - Get provider-specific negotiation script.
   */
  @Get('script/:provider')
  getProviderScript(
    @Param('provider') provider: string,
    @Query('billType') billType?: string,
    @Query('currentAmount') currentAmount?: string,
    @Query('targetAmount') targetAmount?: string,
  ) {
    const decodedProvider = decodeURIComponent(provider);
    const type = billType ?? 'other';
    const amount = currentAmount ? parseFloat(currentAmount) : undefined;
    const target = targetAmount ? parseFloat(targetAmount) : undefined;

    const strategy = this.negotiationAiService.generateNegotiationStrategy(
      type,
      amount ?? 100,
      decodedProvider,
    );

    const chatScript = this.negotiationAiService.generateChatScript(
      type,
      decodedProvider,
    );

    const providerTips = this.negotiationAiService.getProviderTips(decodedProvider);

    return {
      strategy,
      chatScript,
      providerTips,
      estimatedSavings: amount
        ? this.negotiationAiService.estimateSavings(type, amount)
        : null,
    };
  }

  /**
   * POST /email-template - Generate a negotiation email.
   */
  @Post('email-template')
  generateEmail(@Body() dto: GenerateEmailDto) {
    return this.negotiationAiService.generateEmailTemplate(
      dto.billType,
      dto.provider,
      dto.currentAmount,
      dto.targetAmount,
    );
  }

  /**
   * GET /providers - List all known providers with tips.
   */
  @Get('providers')
  getProviders() {
    const byCategory = getProvidersByCategory();

    const providersWithTips: Record<
      string,
      {
        key: string;
        name: string;
        successRate: number;
        avgSavingsPercent: number;
        difficulty: 'easy' | 'medium' | 'hard';
      }[]
    > = {};

    for (const [category, providers] of Object.entries(byCategory)) {
      providersWithTips[category] = providers.map((p) => {
        const info = PROVIDER_DATABASE[p.key];
        const tips = this.negotiationAiService.getProviderTips(p.name);
        return {
          key: p.key,
          name: p.name,
          successRate: info?.successRate ?? 50,
          avgSavingsPercent: info?.averageSavingsPercent ?? 15,
          difficulty: tips?.difficulty ?? 'medium',
        };
      });
    }

    return providersWithTips;
  }
}
