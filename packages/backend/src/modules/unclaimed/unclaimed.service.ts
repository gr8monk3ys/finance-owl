import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { unclaimedSearches, unclaimedResults } from './unclaimed.schema';
import {
  STATE_DATABASES,
  getStateSearchUrl,
  getSupportedStates,
  type StateDatabase,
} from './state-databases';

const PROPERTY_TYPES = [
  'bank_account',
  'insurance',
  'utility_deposit',
  'tax_refund',
  'payroll',
  'other',
] as const;

@Injectable()
export class UnclaimedService {
  private readonly logger = new Logger(UnclaimedService.name);

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async searchByName(
    userId: string,
    firstName: string,
    lastName: string,
    state: string,
  ) {
    const stateUpper = state.toUpperCase();
    const stateDb = STATE_DATABASES[stateUpper];

    if (!stateDb) {
      throw new NotFoundException(`State '${state}' is not supported`);
    }

    // Create the search record
    const [search] = await this.db
      .insert(unclaimedSearches)
      .values({
        userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        state: stateUpper,
        lastSearchedAt: new Date().toISOString(),
      })
      .returning();

    // Generate simulated results based on a deterministic seed
    // In production, this would call actual state APIs or scrape results
    const results = this.generateSimulatedResults(
      userId,
      search.id,
      firstName.trim(),
      lastName.trim(),
      stateUpper,
      stateDb,
    );

    if (results.length > 0) {
      await this.db.insert(unclaimedResults).values(results);
    }

    // Update the search record with results count
    await this.db
      .update(unclaimedSearches)
      .set({ resultsCount: results.length })
      .where(eq(unclaimedSearches.id, search.id));

    const insertedResults = await this.db
      .select()
      .from(unclaimedResults)
      .where(eq(unclaimedResults.searchId, search.id))
      .orderBy(desc(unclaimedResults.createdAt));

    return {
      search: { ...search, resultsCount: results.length },
      results: insertedResults,
      stateUrl: stateDb.searchUrl,
    };
  }

  async getSearches(userId: string) {
    return this.db
      .select()
      .from(unclaimedSearches)
      .where(eq(unclaimedSearches.userId, userId))
      .orderBy(desc(unclaimedSearches.createdAt));
  }

  async getResults(userId: string, searchId?: string) {
    if (searchId) {
      // Verify the search belongs to the user
      const [search] = await this.db
        .select()
        .from(unclaimedSearches)
        .where(
          and(
            eq(unclaimedSearches.id, searchId),
            eq(unclaimedSearches.userId, userId),
          ),
        )
        .limit(1);

      if (!search) throw new NotFoundException('Search not found');

      return this.db
        .select()
        .from(unclaimedResults)
        .where(
          and(
            eq(unclaimedResults.searchId, searchId),
            eq(unclaimedResults.userId, userId),
          ),
        )
        .orderBy(desc(unclaimedResults.createdAt));
    }

    return this.db
      .select()
      .from(unclaimedResults)
      .where(eq(unclaimedResults.userId, userId))
      .orderBy(desc(unclaimedResults.createdAt));
  }

  async updateResultStatus(
    userId: string,
    resultId: string,
    status: 'found' | 'claimed' | 'dismissed',
  ) {
    const [result] = await this.db
      .select()
      .from(unclaimedResults)
      .where(
        and(
          eq(unclaimedResults.id, resultId),
          eq(unclaimedResults.userId, userId),
        ),
      )
      .limit(1);

    if (!result) throw new NotFoundException('Result not found');

    const [updated] = await this.db
      .update(unclaimedResults)
      .set({ status })
      .where(eq(unclaimedResults.id, resultId))
      .returning();

    return updated;
  }

  getSupportedStates() {
    return getSupportedStates();
  }

  getStateSearchUrl(state: string, firstName?: string, lastName?: string) {
    const url = getStateSearchUrl(state, firstName, lastName);
    if (!url) throw new NotFoundException(`State '${state}' is not supported`);
    return { url };
  }

  /**
   * Generates simulated unclaimed property results.
   * In a production environment, this would integrate with actual state
   * unclaimed property APIs or web scraping services.
   */
  private generateSimulatedResults(
    userId: string,
    searchId: string,
    firstName: string,
    lastName: string,
    state: string,
    stateDb: StateDatabase,
  ) {
    // Use a simple hash of the name to deterministically generate results
    const seed = this.simpleHash(`${firstName}${lastName}${state}`);
    const resultCount = seed % 4; // 0-3 results

    if (resultCount === 0) return [];

    const results: Array<{
      userId: string;
      searchId: string;
      propertyType: string;
      holderName: string;
      reportedAmount: number | null;
      state: string;
      sourceUrl: string;
      claimUrl: string | null;
      status: string;
    }> = [];

    const amounts = [25.43, 87.12, 152.67, 312.89, 45.00, 1250.00, 78.55];
    const types = [...PROPERTY_TYPES];

    for (let i = 0; i < resultCount; i++) {
      const typeIndex = (seed + i) % types.length;
      const amountIndex = (seed + i * 3) % amounts.length;
      const hasAmount = (seed + i) % 3 !== 0;

      results.push({
        userId,
        searchId,
        propertyType: types[typeIndex],
        holderName: `${firstName} ${lastName}`.toUpperCase(),
        reportedAmount: hasAmount ? amounts[amountIndex] : null,
        state,
        sourceUrl: stateDb.url,
        claimUrl: stateDb.searchUrl,
        status: 'found',
      });
    }

    return results;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
