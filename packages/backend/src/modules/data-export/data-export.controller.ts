import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { DataExportService } from './data-export.service';
import { IsOptional, IsString, IsIn } from 'class-validator';
import type { Response } from 'express';

class RequestExportDto {
  @IsOptional()
  @IsString()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}

@Controller('data-export')
export class DataExportController {
  constructor(private dataExportService: DataExportService) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  requestExport(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestExportDto,
  ) {
    return this.dataExportService.requestExport(userId, dto.format || 'json');
  }

  @Get('download/:token')
  downloadExport(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const result = this.dataExportService.getExportDownload(token);

    if (!result) {
      throw new NotFoundException(
        'Export not found or has expired. Please request a new export.',
      );
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }

  @Get('status')
  getStatus(@CurrentUser('id') userId: string) {
    return this.dataExportService.getExportStatus(userId);
  }
}
