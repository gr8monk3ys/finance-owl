import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BankingService } from './banking.service';
import { BankingController } from './banking.controller';
import { UnitProvider } from './providers/unit.provider';
import { TreasuryPrimeProvider } from './providers/treasury-prime.provider';
import { BAAS_PROVIDERS } from './providers/baas.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    UnitProvider,
    TreasuryPrimeProvider,
    {
      provide: BAAS_PROVIDERS,
      useFactory: (
        unit: UnitProvider,
        treasuryPrime: TreasuryPrimeProvider,
      ) => [unit, treasuryPrime],
      inject: [UnitProvider, TreasuryPrimeProvider],
    },
    BankingService,
  ],
  controllers: [BankingController],
  exports: [BankingService],
})
export class BankingModule {}
