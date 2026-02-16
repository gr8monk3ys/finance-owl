import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BankingService } from './banking.service';
import { OpenAccountDto } from './dto/open-account.dto';
import { InitiateTransferDto } from './dto/initiate-transfer.dto';
import { CurrentUser } from '../../common/decorators';

@Controller()
export class BankingController {
  constructor(private bankingService: BankingService) {}

  // -------------------------------------------------------------------------
  // Account Endpoints
  // -------------------------------------------------------------------------

  /** Open a new checking or savings account. */
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('banking/accounts')
  async openAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: OpenAccountDto,
  ) {
    return this.bankingService.openAccount(
      userId,
      dto.type,
      {
        fullName: dto.fullName,
        email: dto.email,
        dateOfBirth: dto.dateOfBirth,
        ssn: dto.ssn,
        address: dto.address,
        phone: dto.phone,
      },
      dto.provider,
    );
  }

  /** List all banking accounts for the current user. */
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('banking/accounts')
  async listAccounts(@CurrentUser('id') userId: string) {
    const [accounts, balanceSummary] = await Promise.all([
      this.bankingService.listAccounts(userId),
      this.bankingService.getAggregatedBalance(userId),
    ]);

    return { accounts, summary: balanceSummary };
  }

  /** Get a single banking account detail. */
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('banking/accounts/:id')
  async getAccount(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
  ) {
    return this.bankingService.getAccount(userId, accountId);
  }

  // -------------------------------------------------------------------------
  // Transfer Endpoints
  // -------------------------------------------------------------------------

  /** Initiate a transfer between accounts. */
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('banking/transfers')
  async initiateTransfer(
    @CurrentUser('id') userId: string,
    @Body() dto: InitiateTransferDto,
  ) {
    return this.bankingService.initiateTransfer(
      userId,
      dto.fromAccountId,
      dto.toAccountId,
      dto.amount,
      dto.memo,
      dto.transferType,
      dto.routingNumber,
      dto.accountNumber,
    );
  }

  /** List transfer history. */
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('banking/transfers')
  async listTransfers(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.bankingService.listTransfers(userId, status);
  }

  /** Get transfer status/detail. */
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('banking/transfers/:id')
  async getTransfer(
    @CurrentUser('id') userId: string,
    @Param('id') transferId: string,
  ) {
    return this.bankingService.getTransfer(userId, transferId);
  }

  // -------------------------------------------------------------------------
  // Interest & Rates Endpoints
  // -------------------------------------------------------------------------

  /** Get interest earned summary for the current user. */
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Get('banking/interest')
  async getInterestSummary(@CurrentUser('id') userId: string) {
    return this.bankingService.getInterestSummary(userId);
  }

  /** Get current interest rates from all providers. */
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('banking/rates')
  async getRates() {
    const [rates, fdic] = await Promise.all([
      this.bankingService.getCurrentRates(),
      Promise.resolve(this.bankingService.getFdicDisclosure()),
    ]);

    return { rates, fdic };
  }
}
