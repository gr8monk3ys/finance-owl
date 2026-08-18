import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, isNull, or } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class CategoriesService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async findAll(userId: string) {
    return this.db
      .select()
      .from(schema.categories)
      .where(
        or(
          eq(schema.categories.userId, userId),
          isNull(schema.categories.userId), // system defaults
        ),
      )
      .orderBy(schema.categories.sortOrder, schema.categories.name);
  }

  async findById(userId: string, id: string) {
    const [category] = await this.db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          or(eq(schema.categories.userId, userId), isNull(schema.categories.userId)),
        ),
      )
      .limit(1);

    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(
    userId: string,
    data: { name: string; parentId?: string; icon?: string; color?: string },
  ) {
    const [category] = await this.db
      .insert(schema.categories)
      .values({
        userId,
        name: data.name,
        parentId: data.parentId,
        icon: data.icon,
        color: data.color,
      })
      .returning();

    return category;
  }

  async update(
    userId: string,
    id: string,
    data: { name?: string; parentId?: string; icon?: string; color?: string; sortOrder?: number },
  ) {
    const category = await this.findById(userId, id);
    if (category.isSystem && !category.userId) {
      // System categories can't be modified, but user can create overrides
    }

    const [updated] = await this.db
      .update(schema.categories)
      .set(data)
      .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, userId)))
      .returning();

    if (!updated) throw new NotFoundException('Category not found or is a system category');
    return updated;
  }

  async remove(userId: string, id: string) {
    const result = await this.db
      .delete(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          eq(schema.categories.userId, userId),
          eq(schema.categories.isSystem, false),
        ),
      );

    return result;
  }

  // Categorization rules
  async getRules(userId: string) {
    return this.db
      .select()
      .from(schema.categorizationRules)
      .where(eq(schema.categorizationRules.userId, userId))
      .orderBy(schema.categorizationRules.priority);
  }

  async createRule(
    userId: string,
    data: { categoryId: string; matchType: string; matchValue: string; priority?: number },
  ) {
    const [rule] = await this.db
      .insert(schema.categorizationRules)
      .values({
        userId,
        categoryId: data.categoryId,
        matchType: data.matchType,
        matchValue: data.matchValue,
        priority: data.priority ?? 0,
      })
      .returning();

    return rule;
  }

  async deleteRule(userId: string, id: string) {
    return this.db
      .delete(schema.categorizationRules)
      .where(
        and(eq(schema.categorizationRules.id, id), eq(schema.categorizationRules.userId, userId)),
      );
  }

  // Seed default categories
  async seedDefaults() {
    const existing = await this.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.isSystem, true))
      .limit(1);

    if (existing.length > 0) return; // Already seeded

    const defaults = this.getDefaultCategories();

    for (const parent of defaults) {
      const [parentRow] = await this.db
        .insert(schema.categories)
        .values({
          name: parent.name,
          icon: parent.icon,
          color: parent.color,
          isSystem: true,
          sortOrder: parent.sortOrder,
        })
        .returning();

      for (const child of parent.children || []) {
        await this.db.insert(schema.categories).values({
          name: child.name,
          parentId: parentRow.id,
          icon: child.icon,
          color: parent.color,
          isSystem: true,
          sortOrder: child.sortOrder,
        });
      }
    }
  }

  private getDefaultCategories() {
    return [
      {
        name: 'Food & Drink',
        icon: 'utensils',
        color: '#ef4444',
        sortOrder: 1,
        children: [
          { name: 'Restaurants', icon: 'store', sortOrder: 1 },
          { name: 'Groceries', icon: 'shopping-cart', sortOrder: 2 },
          { name: 'Coffee Shops', icon: 'coffee', sortOrder: 3 },
          { name: 'Fast Food', icon: 'burger', sortOrder: 4 },
          { name: 'Bars & Alcohol', icon: 'wine', sortOrder: 5 },
        ],
      },
      {
        name: 'Transportation',
        icon: 'car',
        color: '#3b82f6',
        sortOrder: 2,
        children: [
          { name: 'Gas & Fuel', icon: 'fuel', sortOrder: 1 },
          { name: 'Parking', icon: 'parking', sortOrder: 2 },
          { name: 'Public Transit', icon: 'bus', sortOrder: 3 },
          { name: 'Ride Share', icon: 'taxi', sortOrder: 4 },
          { name: 'Auto Insurance', icon: 'shield', sortOrder: 5 },
          { name: 'Auto Maintenance', icon: 'wrench', sortOrder: 6 },
        ],
      },
      {
        name: 'Shopping',
        icon: 'shopping-bag',
        color: '#8b5cf6',
        sortOrder: 3,
        children: [
          { name: 'Clothing', icon: 'shirt', sortOrder: 1 },
          { name: 'Electronics', icon: 'laptop', sortOrder: 2 },
          { name: 'Home Goods', icon: 'home', sortOrder: 3 },
          { name: 'Online Shopping', icon: 'globe', sortOrder: 4 },
          { name: 'Sporting Goods', icon: 'dumbbell', sortOrder: 5 },
        ],
      },
      {
        name: 'Housing',
        icon: 'home',
        color: '#f59e0b',
        sortOrder: 4,
        children: [
          { name: 'Rent', icon: 'key', sortOrder: 1 },
          { name: 'Mortgage', icon: 'building', sortOrder: 2 },
          { name: 'Home Insurance', icon: 'shield', sortOrder: 3 },
          { name: 'Home Improvement', icon: 'hammer', sortOrder: 4 },
          { name: 'Property Tax', icon: 'receipt', sortOrder: 5 },
        ],
      },
      {
        name: 'Utilities',
        icon: 'zap',
        color: '#06b6d4',
        sortOrder: 5,
        children: [
          { name: 'Electric', icon: 'bolt', sortOrder: 1 },
          { name: 'Gas', icon: 'flame', sortOrder: 2 },
          { name: 'Water', icon: 'droplet', sortOrder: 3 },
          { name: 'Internet', icon: 'wifi', sortOrder: 4 },
          { name: 'Phone', icon: 'phone', sortOrder: 5 },
        ],
      },
      {
        name: 'Health & Medical',
        icon: 'heart',
        color: '#ec4899',
        sortOrder: 6,
        children: [
          { name: 'Doctor', icon: 'stethoscope', sortOrder: 1 },
          { name: 'Pharmacy', icon: 'pill', sortOrder: 2 },
          { name: 'Dental', icon: 'tooth', sortOrder: 3 },
          { name: 'Vision', icon: 'eye', sortOrder: 4 },
          { name: 'Health Insurance', icon: 'shield', sortOrder: 5 },
          { name: 'Gym & Fitness', icon: 'dumbbell', sortOrder: 6 },
        ],
      },
      {
        name: 'Entertainment',
        icon: 'film',
        color: '#10b981',
        sortOrder: 7,
        children: [
          { name: 'Streaming Services', icon: 'tv', sortOrder: 1 },
          { name: 'Movies & Theater', icon: 'film', sortOrder: 2 },
          { name: 'Music', icon: 'music', sortOrder: 3 },
          { name: 'Games', icon: 'gamepad', sortOrder: 4 },
          { name: 'Books', icon: 'book', sortOrder: 5 },
          { name: 'Hobbies', icon: 'palette', sortOrder: 6 },
        ],
      },
      {
        name: 'Personal Care',
        icon: 'user',
        color: '#f97316',
        sortOrder: 8,
        children: [
          { name: 'Hair', icon: 'scissors', sortOrder: 1 },
          { name: 'Spa & Beauty', icon: 'sparkles', sortOrder: 2 },
          { name: 'Laundry', icon: 'shirt', sortOrder: 3 },
        ],
      },
      {
        name: 'Education',
        icon: 'graduation-cap',
        color: '#6366f1',
        sortOrder: 9,
        children: [
          { name: 'Tuition', icon: 'school', sortOrder: 1 },
          { name: 'Books & Supplies', icon: 'book', sortOrder: 2 },
          { name: 'Student Loans', icon: 'banknote', sortOrder: 3 },
        ],
      },
      {
        name: 'Travel',
        icon: 'plane',
        color: '#14b8a6',
        sortOrder: 10,
        children: [
          { name: 'Flights', icon: 'plane', sortOrder: 1 },
          { name: 'Hotels', icon: 'bed', sortOrder: 2 },
          { name: 'Car Rental', icon: 'car', sortOrder: 3 },
          { name: 'Vacation', icon: 'palmtree', sortOrder: 4 },
        ],
      },
      {
        name: 'Income',
        icon: 'wallet',
        color: '#22c55e',
        sortOrder: 11,
        children: [
          { name: 'Salary', icon: 'briefcase', sortOrder: 1 },
          { name: 'Freelance', icon: 'laptop', sortOrder: 2 },
          { name: 'Interest', icon: 'percent', sortOrder: 3 },
          { name: 'Dividends', icon: 'trending-up', sortOrder: 4 },
          { name: 'Refunds', icon: 'rotate-ccw', sortOrder: 5 },
          { name: 'Other Income', icon: 'plus', sortOrder: 6 },
        ],
      },
      {
        name: 'Financial',
        icon: 'landmark',
        color: '#64748b',
        sortOrder: 12,
        children: [
          { name: 'Bank Fees', icon: 'alert-circle', sortOrder: 1 },
          { name: 'ATM Fees', icon: 'credit-card', sortOrder: 2 },
          { name: 'Interest Charges', icon: 'percent', sortOrder: 3 },
          { name: 'Taxes', icon: 'receipt', sortOrder: 4 },
          { name: 'Insurance', icon: 'shield', sortOrder: 5 },
        ],
      },
      {
        name: 'Transfers',
        icon: 'arrow-right-left',
        color: '#94a3b8',
        sortOrder: 13,
        children: [
          { name: 'Account Transfer', icon: 'refresh', sortOrder: 1 },
          { name: 'Credit Card Payment', icon: 'credit-card', sortOrder: 2 },
          { name: 'Savings Transfer', icon: 'piggy-bank', sortOrder: 3 },
          { name: 'Investment Transfer', icon: 'trending-up', sortOrder: 4 },
        ],
      },
      {
        name: 'Gifts & Donations',
        icon: 'gift',
        color: '#e11d48',
        sortOrder: 14,
        children: [
          { name: 'Charity', icon: 'heart', sortOrder: 1 },
          { name: 'Gifts', icon: 'gift', sortOrder: 2 },
        ],
      },
      {
        name: 'Pets',
        icon: 'paw-print',
        color: '#a855f7',
        sortOrder: 15,
        children: [
          { name: 'Vet', icon: 'stethoscope', sortOrder: 1 },
          { name: 'Pet Food', icon: 'bone', sortOrder: 2 },
          { name: 'Pet Supplies', icon: 'shopping-bag', sortOrder: 3 },
        ],
      },
      {
        name: 'Uncategorized',
        icon: 'help-circle',
        color: '#71717a',
        sortOrder: 99,
        children: [],
      },
    ];
  }
}
