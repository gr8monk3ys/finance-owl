import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { UnclaimedService } from './unclaimed.service';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

class SearchDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}

class UpdateStatusDto {
  @IsString()
  @IsIn(['found', 'claimed', 'dismissed'])
  status!: 'found' | 'claimed' | 'dismissed';
}

class ResultsQueryDto {
  @IsOptional()
  @IsString()
  searchId?: string;
}

@Controller('unclaimed')
export class UnclaimedController {
  constructor(private unclaimedService: UnclaimedService) {}

  @Post('search')
  search(
    @CurrentUser('id') userId: string,
    @Body() dto: SearchDto,
  ) {
    return this.unclaimedService.searchByName(
      userId,
      dto.firstName,
      dto.lastName,
      dto.state,
    );
  }

  @Get('searches')
  getSearches(@CurrentUser('id') userId: string) {
    return this.unclaimedService.getSearches(userId);
  }

  @Get('results')
  getResults(
    @CurrentUser('id') userId: string,
    @Query() query: ResultsQueryDto,
  ) {
    return this.unclaimedService.getResults(userId, query.searchId);
  }

  @Patch('results/:id')
  updateResultStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.unclaimedService.updateResultStatus(userId, id, dto.status);
  }

  @Get('states')
  getSupportedStates() {
    return this.unclaimedService.getSupportedStates();
  }
}
