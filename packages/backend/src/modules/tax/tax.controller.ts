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
import { TaxService } from './tax.service';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsIn,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateTaxDocumentDto {
  @IsInt()
  @Type(() => Number)
  year!: number;

  @IsString()
  @IsIn(['w2', '1099', '1098', 'charitable', 'medical', 'business'])
  type!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsBoolean()
  isDeductible?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

class UpdateTaxDocumentDto {
  @IsOptional()
  @IsString()
  @IsIn(['w2', '1099', '1098', 'charitable', 'medical', 'business'])
  type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsBoolean()
  isDeductible?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

@Controller('tax')
export class TaxController {
  constructor(private taxService: TaxService) {}

  @Get('documents')
  getDocuments(
    @CurrentUser('id') userId: string,
    @Query('year') year: string = String(new Date().getFullYear()),
  ) {
    return this.taxService.getDocuments(userId, parseInt(year, 10));
  }

  @Post('documents')
  addDocument(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTaxDocumentDto,
  ) {
    return this.taxService.addDocument(userId, dto);
  }

  @Patch('documents/:id')
  updateDocument(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaxDocumentDto,
  ) {
    return this.taxService.updateDocument(userId, id, dto);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDocument(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.taxService.removeDocument(userId, id);
  }

  @Get('summary/:year')
  getSummary(
    @CurrentUser('id') userId: string,
    @Param('year') year: string,
  ) {
    return this.taxService.getSummary(userId, parseInt(year, 10));
  }

  @Post('summary/:year/generate')
  generateSummary(
    @CurrentUser('id') userId: string,
    @Param('year') year: string,
    @Query('state') state?: string,
  ) {
    return this.taxService.generateSummary(
      userId,
      parseInt(year, 10),
      state,
    );
  }

  @Get('deductions/:year')
  getDeductions(
    @CurrentUser('id') userId: string,
    @Param('year') year: string,
  ) {
    return this.taxService.getDeductibleTransactions(
      userId,
      parseInt(year, 10),
    );
  }
}
