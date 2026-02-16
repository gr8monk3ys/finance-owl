import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { dashboardLayouts } from './dashboard.schema';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetConfig {
  id: string;
  type: string;
  position: WidgetPosition;
  config: Record<string, unknown>;
  visible: boolean;
}

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  getDefaultLayout(): WidgetConfig[] {
    return [
      {
        id: 'net-worth',
        type: 'net-worth',
        position: { x: 0, y: 0, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'spending-category',
        type: 'spending-category',
        position: { x: 1, y: 0, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'budget-progress',
        type: 'budget-progress',
        position: { x: 2, y: 0, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'recent-transactions',
        type: 'recent-transactions',
        position: { x: 0, y: 1, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'account-balances',
        type: 'account-balances',
        position: { x: 1, y: 1, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'upcoming-bills',
        type: 'upcoming-bills',
        position: { x: 2, y: 1, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'cash-flow',
        type: 'cash-flow',
        position: { x: 0, y: 2, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'savings-goals',
        type: 'savings-goals',
        position: { x: 1, y: 2, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'credit-score',
        type: 'credit-score',
        position: { x: 2, y: 2, w: 1, h: 1 },
        config: {},
        visible: true,
      },
      {
        id: 'quick-actions',
        type: 'quick-actions',
        position: { x: 0, y: 3, w: 1, h: 1 },
        config: {},
        visible: true,
      },
    ];
  }

  async getLayout(userId: string): Promise<WidgetConfig[]> {
    const [layout] = await this.db
      .select()
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId))
      .limit(1);

    if (!layout) {
      return this.getDefaultLayout();
    }

    try {
      return JSON.parse(layout.widgets) as WidgetConfig[];
    } catch {
      return this.getDefaultLayout();
    }
  }

  async saveLayout(userId: string, widgets: WidgetConfig[]): Promise<WidgetConfig[]> {
    const widgetsJson = JSON.stringify(widgets);

    const [existing] = await this.db
      .select({ id: dashboardLayouts.id })
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId))
      .limit(1);

    if (existing) {
      await this.db
        .update(dashboardLayouts)
        .set({
          widgets: widgetsJson,
          updatedAt: new Date(),
        })
        .where(eq(dashboardLayouts.userId, userId));
    } else {
      await this.db.insert(dashboardLayouts).values({
        userId,
        widgets: widgetsJson,
      });
    }

    return widgets;
  }

  async resetLayout(userId: string): Promise<WidgetConfig[]> {
    const defaultWidgets = this.getDefaultLayout();

    await this.db
      .delete(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId));

    return defaultWidgets;
  }
}
