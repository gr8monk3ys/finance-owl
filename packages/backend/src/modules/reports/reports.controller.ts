import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('spending')
  getSpendingReport(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: 'category' | 'merchant' | 'account' | 'day' | 'week' | 'month' = 'category',
    @Query('accountIds') accountIds?: string,
    @Query('categoryIds') categoryIds?: string,
  ) {
    return this.reportsService.getSpendingReport(userId, {
      startDate,
      endDate,
      groupBy,
      accountIds: accountIds ? accountIds.split(',') : undefined,
      categoryIds: categoryIds ? categoryIds.split(',') : undefined,
    });
  }

  @Get('income-expense')
  getIncomeVsExpense(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: 'month' | 'week' = 'month',
  ) {
    return this.reportsService.getIncomeVsExpense(userId, {
      startDate,
      endDate,
      groupBy,
    });
  }

  @Get('net-worth')
  getNetWorthReport(@CurrentUser('id') userId: string) {
    return this.reportsService.getNetWorthReport(userId);
  }

  @Get('trends')
  getTrendReport(
    @CurrentUser('id') userId: string,
    @Query('months') months: string = '6',
    @Query('categoryIds') categoryIds?: string,
  ) {
    return this.reportsService.getTrendReport(userId, {
      months: parseInt(months, 10) || 6,
      categoryIds: categoryIds ? categoryIds.split(',') : undefined,
    });
  }

  @Get('export/csv')
  async exportCSV(
    @CurrentUser('id') userId: string,
    @Query('type') type: 'transactions' | 'budgets' | 'networth' = 'transactions',
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.generateCSV(userId, type, {
      startDate,
      endDate,
    });

    const filename = `financeowl-${type}-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
