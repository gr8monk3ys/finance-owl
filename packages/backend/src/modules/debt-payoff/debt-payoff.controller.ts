import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { DebtPayoffService } from './debt-payoff.service';
import {
  CreateDebtDto,
  UpdateDebtDto,
  RecordPaymentDto,
  CalculatePayoffDto,
} from './dto';

@Controller('debt-payoff')
export class DebtPayoffController {
  constructor(private debtPayoffService: DebtPayoffService) {}

  @Get()
  getDebts(@CurrentUser('id') userId: string) {
    return this.debtPayoffService.getDebts(userId);
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.debtPayoffService.getSummary(userId);
  }

  @Get('compare')
  compareStrategies(
    @CurrentUser('id') userId: string,
    @Query('extraPayment') extraPayment?: string,
  ) {
    const extra = extraPayment ? parseFloat(extraPayment) : 0;
    return this.debtPayoffService.compareStrategies(userId, extra);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.debtPayoffService.findById(userId, id);
  }

  @Post()
  addDebt(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDebtDto,
  ) {
    return this.debtPayoffService.addDebt(userId, dto);
  }

  @Patch(':id')
  updateDebt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtPayoffService.updateDebt(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDebt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.debtPayoffService.removeDebt(userId, id);
  }

  @Post(':id/payments')
  recordPayment(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.debtPayoffService.recordPayment(userId, id, dto);
  }

  @Get(':id/payments')
  getPayments(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.debtPayoffService.getPayments(userId, id);
  }

  @Post('calculate')
  calculatePayoff(
    @CurrentUser('id') userId: string,
    @Body() dto: CalculatePayoffDto,
  ) {
    return this.debtPayoffService.calculatePayoffPlan(
      userId,
      dto.strategy,
      dto.extraMonthlyPayment,
      dto.customOrder,
    );
  }
}
