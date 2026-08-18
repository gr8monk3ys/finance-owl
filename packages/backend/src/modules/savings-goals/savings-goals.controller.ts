import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { SavingsGoalsService } from './savings-goals.service';
import { CreateSavingsGoalDto, UpdateSavingsGoalDto, AddContributionDto } from './dto';

@Controller('savings-goals')
export class SavingsGoalsController {
  constructor(private savingsGoalsService: SavingsGoalsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.savingsGoalsService.findAll(userId);
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.savingsGoalsService.getSummary(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.savingsGoalsService.findById(userId, id);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateSavingsGoalDto) {
    return this.savingsGoalsService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSavingsGoalDto,
  ) {
    return this.savingsGoalsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.savingsGoalsService.remove(userId, id);
  }

  @Post(':id/contributions')
  addContribution(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddContributionDto,
  ) {
    return this.savingsGoalsService.addContribution(userId, id, dto.amount, dto.note, dto.date);
  }

  @Delete(':id/contributions/:contributionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContribution(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('contributionId') contributionId: string,
  ) {
    await this.savingsGoalsService.removeContribution(userId, id, contributionId);
  }
}
