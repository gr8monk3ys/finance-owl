import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  DATABASE_TOKEN,
  type DrizzleDB,
} from '../../database/database.module';
import { properties, vehicles, assetValueHistory } from './assets.schema';
import { accounts } from '../../database/schema/accounts';

@Injectable()
export class AssetsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  // ─── Properties CRUD ─────────────────────────────────────────────

  async findAllProperties(userId: string) {
    return this.db
      .select()
      .from(properties)
      .where(eq(properties.userId, userId))
      .orderBy(desc(properties.createdAt));
  }

  async findPropertyById(userId: string, id: string) {
    const [property] = await this.db
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)))
      .limit(1);

    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async createProperty(
    userId: string,
    data: {
      name: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      propertyType: string;
      purchasePrice?: number;
      purchaseDate?: string;
      currentValue: number;
      mortgageAccountId?: string;
      monthlyRent?: number;
      annualPropertyTax?: number;
      annualInsurance?: number;
      notes?: string;
    },
  ) {
    const now = new Date().toISOString();

    const [property] = await this.db
      .insert(properties)
      .values({
        userId,
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        propertyType: data.propertyType,
        purchasePrice: data.purchasePrice,
        purchaseDate: data.purchaseDate,
        currentValue: data.currentValue,
        lastValuationDate: now,
        valuationSource: 'manual',
        mortgageAccountId: data.mortgageAccountId,
        monthlyRent: data.monthlyRent,
        annualPropertyTax: data.annualPropertyTax,
        annualInsurance: data.annualInsurance,
        notes: data.notes,
      })
      .returning();

    // Record initial valuation in history
    await this.recordValuation('property', property.id, data.currentValue, 'manual');

    return property;
  }

  async updateProperty(
    userId: string,
    id: string,
    data: {
      name?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      propertyType?: string;
      purchasePrice?: number;
      purchaseDate?: string;
      currentValue?: number;
      mortgageAccountId?: string;
      monthlyRent?: number;
      annualPropertyTax?: number;
      annualInsurance?: number;
      notes?: string;
    },
  ) {
    await this.findPropertyById(userId, id);

    const updateData: Record<string, any> = {
      ...data,
      updatedAt: new Date(),
    };

    // If current value changed, update valuation metadata and record history
    if (data.currentValue !== undefined) {
      updateData.lastValuationDate = new Date().toISOString();
      updateData.valuationSource = 'manual';
    }

    const [updated] = await this.db
      .update(properties)
      .set(updateData)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)))
      .returning();

    if (data.currentValue !== undefined) {
      await this.recordValuation('property', id, data.currentValue, 'manual');
    }

    return updated;
  }

  async removeProperty(userId: string, id: string) {
    await this.findPropertyById(userId, id);
    await this.db
      .delete(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)));
  }

  // ─── Vehicles CRUD ───────────────────────────────────────────────

  async findAllVehicles(userId: string) {
    return this.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.userId, userId))
      .orderBy(desc(vehicles.createdAt));
  }

  async findVehicleById(userId: string, id: string) {
    const [vehicle] = await this.db
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)))
      .limit(1);

    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async createVehicle(
    userId: string,
    data: {
      make: string;
      model: string;
      year: number;
      trim?: string;
      vin?: string;
      mileage?: number;
      condition: string;
      purchasePrice?: number;
      purchaseDate?: string;
      currentValue: number;
      loanAccountId?: string;
      monthlyPayment?: number;
      annualInsurance?: number;
      notes?: string;
    },
  ) {
    const now = new Date().toISOString();

    const [vehicle] = await this.db
      .insert(vehicles)
      .values({
        userId,
        make: data.make,
        model: data.model,
        year: data.year,
        trim: data.trim,
        vin: data.vin,
        mileage: data.mileage,
        condition: data.condition,
        purchasePrice: data.purchasePrice,
        purchaseDate: data.purchaseDate,
        currentValue: data.currentValue,
        lastValuationDate: now,
        valuationSource: 'manual',
        loanAccountId: data.loanAccountId,
        monthlyPayment: data.monthlyPayment,
        annualInsurance: data.annualInsurance,
        notes: data.notes,
      })
      .returning();

    // Record initial valuation in history
    await this.recordValuation('vehicle', vehicle.id, data.currentValue, 'manual');

    return vehicle;
  }

  async updateVehicle(
    userId: string,
    id: string,
    data: {
      make?: string;
      model?: string;
      year?: number;
      trim?: string;
      vin?: string;
      mileage?: number;
      condition?: string;
      purchasePrice?: number;
      purchaseDate?: string;
      currentValue?: number;
      loanAccountId?: string;
      monthlyPayment?: number;
      annualInsurance?: number;
      notes?: string;
    },
  ) {
    await this.findVehicleById(userId, id);

    const updateData: Record<string, any> = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.currentValue !== undefined) {
      updateData.lastValuationDate = new Date().toISOString();
      updateData.valuationSource = 'manual';
    }

    const [updated] = await this.db
      .update(vehicles)
      .set(updateData)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)))
      .returning();

    if (data.currentValue !== undefined) {
      await this.recordValuation('vehicle', id, data.currentValue, 'manual');
    }

    return updated;
  }

  async removeVehicle(userId: string, id: string) {
    await this.findVehicleById(userId, id);
    await this.db
      .delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)));
  }

  // ─── Valuation Estimation ────────────────────────────────────────

  /**
   * Estimate property value: placeholder for Zillow API integration.
   * Currently returns the manual value or computes from purchase price
   * using a ~3% annual appreciation rate.
   */
  async estimatePropertyValue(userId: string, propertyId: string) {
    const property = await this.findPropertyById(userId, propertyId);

    let estimatedValue = property.currentValue;

    if (property.purchasePrice && property.purchaseDate) {
      const purchaseDate = new Date(property.purchaseDate);
      const now = new Date();
      const yearsOwned =
        (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

      // ~3% annual appreciation
      const appreciationRate = 0.03;
      estimatedValue =
        property.purchasePrice * Math.pow(1 + appreciationRate, yearsOwned);
    }

    estimatedValue = Math.round(estimatedValue * 100) / 100;

    // Update property with new estimate
    await this.db
      .update(properties)
      .set({
        currentValue: estimatedValue,
        lastValuationDate: new Date().toISOString(),
        valuationSource: 'estimate',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(properties.id, propertyId),
          eq(properties.userId, userId),
        ),
      );

    await this.recordValuation('property', propertyId, estimatedValue, 'estimate');

    return {
      propertyId,
      previousValue: property.currentValue,
      estimatedValue,
      method: 'appreciation',
      appreciationRate: '3% annually',
    };
  }

  /**
   * Estimate vehicle value using depreciation model:
   * - Year 1: -20%
   * - Year 2: -15%
   * - Years 3-5: -10%/yr
   * - Year 6+: -7%/yr
   * Adjusted for condition and mileage.
   */
  async estimateVehicleValue(userId: string, vehicleId: string) {
    const vehicle = await this.findVehicleById(userId, vehicleId);

    if (!vehicle.purchasePrice) {
      return {
        vehicleId,
        previousValue: vehicle.currentValue,
        estimatedValue: vehicle.currentValue,
        method: 'no_purchase_price',
        message: 'Cannot estimate without purchase price',
      };
    }

    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - vehicle.year;

    // Calculate depreciation
    let value = vehicle.purchasePrice;
    for (let year = 1; year <= vehicleAge; year++) {
      if (year === 1) {
        value *= 0.80; // -20%
      } else if (year === 2) {
        value *= 0.85; // -15%
      } else if (year <= 5) {
        value *= 0.90; // -10%
      } else {
        value *= 0.93; // -7%
      }
    }

    // Condition modifier
    const conditionModifiers: Record<string, number> = {
      excellent: 1.10,
      good: 1.00,
      fair: 0.90,
      poor: 0.80,
    };
    value *= conditionModifiers[vehicle.condition] ?? 1.0;

    // Mileage modifier: assume ~12k miles/yr is average
    if (vehicle.mileage && vehicleAge > 0) {
      const avgMilesPerYear = vehicle.mileage / vehicleAge;
      if (avgMilesPerYear > 20000) {
        value *= 0.90; // -10%
      } else if (avgMilesPerYear > 15000) {
        value *= 0.95; // -5%
      }
    }

    // Floor: don't go below $500
    value = Math.max(value, 500);
    value = Math.round(value * 100) / 100;

    // Update vehicle with new estimate
    await this.db
      .update(vehicles)
      .set({
        currentValue: value,
        lastValuationDate: new Date().toISOString(),
        valuationSource: 'estimate',
        updatedAt: new Date(),
      })
      .where(
        and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId)),
      );

    await this.recordValuation('vehicle', vehicleId, value, 'estimate');

    return {
      vehicleId,
      previousValue: vehicle.currentValue,
      estimatedValue: value,
      method: 'depreciation',
      vehicleAge,
      condition: vehicle.condition,
      mileage: vehicle.mileage,
    };
  }

  // ─── Value History ───────────────────────────────────────────────

  async getValueHistory(assetType: string, assetId: string) {
    return this.db
      .select()
      .from(assetValueHistory)
      .where(
        and(
          eq(assetValueHistory.assetType, assetType),
          eq(assetValueHistory.assetId, assetId),
        ),
      )
      .orderBy(desc(assetValueHistory.date));
  }

  async recordValuation(
    assetType: string,
    assetId: string,
    value: number,
    source: string,
  ) {
    await this.db.insert(assetValueHistory).values({
      assetType,
      assetId,
      value,
      date: new Date().toISOString().split('T')[0],
      source,
    });
  }

  // ─── Summary & Net Worth ─────────────────────────────────────────

  async getAssetSummary(userId: string) {
    const userProperties = await this.findAllProperties(userId);
    const userVehicles = await this.findAllVehicles(userId);

    const totalPropertyValue = userProperties.reduce(
      (sum, p) => sum + (p.currentValue ?? 0),
      0,
    );
    const totalVehicleValue = userVehicles.reduce(
      (sum, v) => sum + (v.currentValue ?? 0),
      0,
    );
    const totalAssetValue = totalPropertyValue + totalVehicleValue;

    // Get linked mortgage/loan balances
    const mortgageIds = userProperties
      .map((p) => p.mortgageAccountId)
      .filter(Boolean) as string[];
    const loanIds = userVehicles
      .map((v) => v.loanAccountId)
      .filter(Boolean) as string[];

    let totalLinkedLoanBalance = 0;

    const allLinkedIds = [...mortgageIds, ...loanIds];
    if (allLinkedIds.length > 0) {
      for (const accountId of allLinkedIds) {
        const [acct] = await this.db
          .select()
          .from(accounts)
          .where(eq(accounts.id, accountId))
          .limit(1);
        if (acct) {
          totalLinkedLoanBalance += Math.abs(acct.currentBalance ?? 0);
        }
      }
    }

    const equity = totalAssetValue - totalLinkedLoanBalance;

    return {
      totalPropertyValue,
      totalVehicleValue,
      totalAssetValue,
      totalLinkedLoanBalance,
      equity,
      propertyCount: userProperties.length,
      vehicleCount: userVehicles.length,
    };
  }

  async getNetWorthContribution(userId: string) {
    const summary = await this.getAssetSummary(userId);
    return {
      assets: summary.totalAssetValue,
      liabilities: summary.totalLinkedLoanBalance,
      netContribution: summary.equity,
    };
  }
}
