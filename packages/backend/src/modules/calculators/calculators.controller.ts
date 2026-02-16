import { Controller, Post, Body } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { CalculatorsService } from './calculators.service';
import {
  MortgageDto,
  RefinanceDto,
  AmortizationDto,
  CompoundInterestDto,
  DtiDto,
  NetWorthDto,
} from './dto';

@Controller('calculators')
export class CalculatorsController {
  constructor(private calculatorsService: CalculatorsService) {}

  @Public()
  @Post('mortgage')
  calculateMortgage(@Body() dto: MortgageDto) {
    return this.calculatorsService.calculateMortgage(dto);
  }

  @Public()
  @Post('refinance')
  calculateRefinance(@Body() dto: RefinanceDto) {
    return this.calculatorsService.calculateRefinance(dto);
  }

  @Public()
  @Post('amortization')
  calculateAmortization(@Body() dto: AmortizationDto) {
    return this.calculatorsService.calculateAmortization(dto);
  }

  @Public()
  @Post('compound-interest')
  calculateCompoundInterest(@Body() dto: CompoundInterestDto) {
    return this.calculatorsService.calculateCompoundInterest(dto);
  }

  @Public()
  @Post('dti')
  calculateDti(@Body() dto: DtiDto) {
    return this.calculatorsService.calculateDti(dto);
  }

  @Public()
  @Post('net-worth')
  calculateNetWorth(@Body() dto: NetWorthDto) {
    return this.calculatorsService.calculateNetWorth(dto);
  }
}
