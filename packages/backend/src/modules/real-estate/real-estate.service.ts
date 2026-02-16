import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class RealEstateService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async findAll(userId: string) {
    return this.db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.userId, userId))
      .orderBy(desc(schema.properties.createdAt));
  }

  async findById(userId: string, id: string) {
    const [property] = await this.db
      .select()
      .from(schema.properties)
      .where(
        and(
          eq(schema.properties.id, id),
          eq(schema.properties.userId, userId),
        ),
      )
      .limit(1);

    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async create(
    userId: string,
    data: {
      address: string;
      city: string;
      state: string;
      zipCode: string;
      propertyType?: string;
      bedrooms?: number;
      bathrooms?: number;
      squareFeet?: number;
      yearBuilt?: number;
      purchasePrice?: number;
      purchaseDate?: string;
      currentEstimate?: number;
      zestimateUrl?: string;
      notes?: string;
    },
  ) {
    const [property] = await this.db
      .insert(schema.properties)
      .values({
        userId,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        propertyType: data.propertyType ?? 'single_family',
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        squareFeet: data.squareFeet ?? null,
        yearBuilt: data.yearBuilt ?? null,
        purchasePrice: data.purchasePrice ?? null,
        purchaseDate: data.purchaseDate ?? null,
        currentEstimate: data.currentEstimate ?? null,
        lastEstimateDate: data.currentEstimate
          ? new Date().toISOString().split('T')[0]
          : null,
        zestimateUrl: data.zestimateUrl ?? null,
        notes: data.notes ?? null,
      })
      .returning();

    return property;
  }

  async update(
    userId: string,
    id: string,
    data: {
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      propertyType?: string;
      bedrooms?: number;
      bathrooms?: number;
      squareFeet?: number;
      yearBuilt?: number;
      purchasePrice?: number;
      purchaseDate?: string;
      currentEstimate?: number;
      zestimateUrl?: string;
      notes?: string;
    },
  ) {
    await this.findById(userId, id);

    const [updated] = await this.db
      .update(schema.properties)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.properties.id, id),
          eq(schema.properties.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findById(userId, id);
    await this.db
      .delete(schema.properties)
      .where(
        and(
          eq(schema.properties.id, id),
          eq(schema.properties.userId, userId),
        ),
      );
  }

  async getPortfolioSummary(userId: string) {
    const allProperties = await this.findAll(userId);

    let totalValue = 0;
    let totalPurchasePrice = 0;

    for (const property of allProperties) {
      totalValue += property.currentEstimate ?? property.purchasePrice ?? 0;
      totalPurchasePrice += property.purchasePrice ?? 0;
    }

    const totalEquity = totalValue - totalPurchasePrice;

    return {
      totalValue,
      totalPurchasePrice,
      totalEquity,
      propertyCount: allProperties.length,
    };
  }

  async addValueEstimate(
    userId: string,
    propertyId: string,
    data: {
      estimatedValue: number;
      source: string;
      date?: string;
    },
  ) {
    await this.findById(userId, propertyId);

    const estimateDate =
      data.date ?? new Date().toISOString().split('T')[0];

    const [estimate] = await this.db
      .insert(schema.propertyValueHistory)
      .values({
        propertyId,
        estimatedValue: data.estimatedValue,
        source: data.source,
        date: estimateDate,
      })
      .returning();

    // Update current estimate on the property
    await this.db
      .update(schema.properties)
      .set({
        currentEstimate: data.estimatedValue,
        lastEstimateDate: estimateDate,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.properties.id, propertyId),
          eq(schema.properties.userId, userId),
        ),
      );

    return estimate;
  }

  async getValueHistory(userId: string, propertyId: string) {
    await this.findById(userId, propertyId);

    return this.db
      .select()
      .from(schema.propertyValueHistory)
      .where(eq(schema.propertyValueHistory.propertyId, propertyId))
      .orderBy(desc(schema.propertyValueHistory.date));
  }
}
