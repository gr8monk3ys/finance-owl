import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { RetirementService } from './retirement.service';
import {
  UpdateRetirementProfileDto,
  FeeAnalysisDto,
  CompareScenarioDto,
} from './dto';

@Controller('retirement')
export class RetirementController {
  constructor(private retirementService: RetirementService) {}

  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.retirementService.getProfile(userId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateRetirementProfileDto,
  ) {
    return this.retirementService.updateProfile(userId, dto);
  }

  @Get('projection')
  calculateProjection(@CurrentUser('id') userId: string) {
    return this.retirementService.calculateProjection(userId);
  }

  @Post('fee-analysis')
  analyzeFees(
    @CurrentUser('id') userId: string,
    @Body() dto: FeeAnalysisDto,
  ) {
    return this.retirementService.analyzeFees(userId, dto);
  }

  @Post('compare')
  compareScenarios(
    @CurrentUser('id') userId: string,
    @Body() dto: CompareScenarioDto,
  ) {
    return this.retirementService.compareScenarios(userId, dto.scenarios);
  }
}
