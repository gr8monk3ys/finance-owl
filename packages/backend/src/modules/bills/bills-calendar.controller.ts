import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { BillsCalendarService } from './bills-calendar.service';
import {
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

class MonthlyCalendarQuery {
  @IsNumberString()
  year!: string;

  @IsNumberString()
  month!: string;
}

class WeeklyViewQuery {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;
}

class UpcomingQuery {
  @IsOptional()
  @IsNumberString()
  days?: string;
}

class MonthSummaryQuery {
  @IsNumberString()
  year!: string;

  @IsNumberString()
  month!: string;
}

@Controller('bills')
export class BillsCalendarController {
  constructor(private billsCalendarService: BillsCalendarService) {}

  @Get('calendar')
  async getMonthlyCalendar(
    @CurrentUser('id') userId: string,
    @Query() query: MonthlyCalendarQuery,
  ) {
    const year = parseInt(query.year, 10);
    const month = parseInt(query.month, 10);
    return this.billsCalendarService.getMonthlyCalendar(userId, year, month);
  }

  @Get('calendar/week')
  async getWeeklyView(
    @CurrentUser('id') userId: string,
    @Query() query: WeeklyViewQuery,
  ) {
    const startDate = new Date(query.startDate + 'T00:00:00');
    return this.billsCalendarService.getWeeklyView(userId, startDate);
  }

  @Get('upcoming')
  async getUpcomingBills(
    @CurrentUser('id') userId: string,
    @Query() query: UpcomingQuery,
  ) {
    const days = query.days ? parseInt(query.days, 10) : 30;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
    return this.billsCalendarService.getUpcomingBills(
      userId,
      startDate,
      endDate,
    );
  }

  @Patch(':id/paid')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markBillPaid(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.billsCalendarService.markBillPaid(userId, id);
  }

  @Get('summary')
  async getMonthSummary(
    @CurrentUser('id') userId: string,
    @Query() query: MonthSummaryQuery,
  ) {
    const year = parseInt(query.year, 10);
    const month = parseInt(query.month, 10);
    return this.billsCalendarService.getMonthSummary(userId, year, month);
  }
}
