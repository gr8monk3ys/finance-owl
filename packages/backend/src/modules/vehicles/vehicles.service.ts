import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class VehiclesService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async findAll(userId: string) {
    return this.db
      .select()
      .from(schema.vehicles)
      .where(eq(schema.vehicles.userId, userId))
      .orderBy(desc(schema.vehicles.createdAt));
  }

  async findById(userId: string, id: string) {
    const [vehicle] = await this.db
      .select()
      .from(schema.vehicles)
      .where(
        and(
          eq(schema.vehicles.id, id),
          eq(schema.vehicles.userId, userId),
        ),
      )
      .limit(1);

    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async create(
    userId: string,
    data: {
      year: number;
      make: string;
      model: string;
      trim?: string;
      vin?: string;
      mileage?: number;
      condition?: string;
      purchasePrice?: number;
      purchaseDate?: string;
      currentEstimate?: number;
      notes?: string;
    },
  ) {
    const [vehicle] = await this.db
      .insert(schema.vehicles)
      .values({
        userId,
        year: data.year,
        make: data.make,
        model: data.model,
        trim: data.trim ?? null,
        vin: data.vin ?? null,
        mileage: data.mileage ?? null,
        condition: data.condition ?? 'good',
        purchasePrice: data.purchasePrice ?? null,
        purchaseDate: data.purchaseDate ?? null,
        currentEstimate: data.currentEstimate ?? null,
        lastEstimateDate: data.currentEstimate
          ? new Date().toISOString().split('T')[0]
          : null,
        notes: data.notes ?? null,
      })
      .returning();

    return vehicle;
  }

  async update(
    userId: string,
    id: string,
    data: {
      year?: number;
      make?: string;
      model?: string;
      trim?: string;
      vin?: string;
      mileage?: number;
      condition?: string;
      purchasePrice?: number;
      purchaseDate?: string;
      currentEstimate?: number;
      notes?: string;
    },
  ) {
    await this.findById(userId, id);

    const [updated] = await this.db
      .update(schema.vehicles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.vehicles.id, id),
          eq(schema.vehicles.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findById(userId, id);
    await this.db
      .delete(schema.vehicles)
      .where(
        and(
          eq(schema.vehicles.id, id),
          eq(schema.vehicles.userId, userId),
        ),
      );
  }

  async getFleetSummary(userId: string) {
    const allVehicles = await this.findAll(userId);

    let totalValue = 0;
    let totalPurchasePrice = 0;

    for (const vehicle of allVehicles) {
      totalValue += vehicle.currentEstimate ?? vehicle.purchasePrice ?? 0;
      totalPurchasePrice += vehicle.purchasePrice ?? 0;
    }

    const totalDepreciation = totalPurchasePrice - totalValue;

    return {
      totalValue,
      totalPurchasePrice,
      totalDepreciation,
      vehicleCount: allVehicles.length,
    };
  }

  async addValueEstimate(
    userId: string,
    vehicleId: string,
    data: {
      estimatedValue: number;
      source: string;
      mileageAtEstimate?: number;
      date?: string;
    },
  ) {
    await this.findById(userId, vehicleId);

    const estimateDate =
      data.date ?? new Date().toISOString().split('T')[0];

    const [estimate] = await this.db
      .insert(schema.vehicleValueHistory)
      .values({
        vehicleId,
        estimatedValue: data.estimatedValue,
        source: data.source,
        mileageAtEstimate: data.mileageAtEstimate ?? null,
        date: estimateDate,
      })
      .returning();

    // Update current estimate on the vehicle
    await this.db
      .update(schema.vehicles)
      .set({
        currentEstimate: data.estimatedValue,
        lastEstimateDate: estimateDate,
        mileage: data.mileageAtEstimate ?? undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.vehicles.id, vehicleId),
          eq(schema.vehicles.userId, userId),
        ),
      );

    return estimate;
  }

  async getValueHistory(userId: string, vehicleId: string) {
    await this.findById(userId, vehicleId);

    return this.db
      .select()
      .from(schema.vehicleValueHistory)
      .where(eq(schema.vehicleValueHistory.vehicleId, vehicleId))
      .orderBy(desc(schema.vehicleValueHistory.date));
  }

  async estimateDepreciation(userId: string, vehicleId: string) {
    const vehicle = await this.findById(userId, vehicleId);

    const purchasePrice = vehicle.purchasePrice ?? 0;
    const currentValue =
      vehicle.currentEstimate ?? vehicle.purchasePrice ?? 0;

    if (purchasePrice === 0 || !vehicle.purchaseDate) {
      return {
        vehicleId,
        purchasePrice,
        currentValue,
        totalDepreciation: 0,
        annualDepreciation: 0,
        depreciationPercent: 0,
        yearsOwned: 0,
      };
    }

    const purchaseDate = new Date(vehicle.purchaseDate);
    const now = new Date();
    const yearsOwned =
      (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    const totalDepreciation = purchasePrice - currentValue;
    const annualDepreciation = yearsOwned > 0 ? totalDepreciation / yearsOwned : 0;
    const depreciationPercent =
      purchasePrice > 0 ? (totalDepreciation / purchasePrice) * 100 : 0;

    return {
      vehicleId,
      purchasePrice,
      currentValue,
      totalDepreciation,
      annualDepreciation,
      depreciationPercent,
      yearsOwned: Math.round(yearsOwned * 10) / 10,
    };
  }
}
