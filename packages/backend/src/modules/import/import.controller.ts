import {
  Controller,
  Get,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators';
import {
  ImportService,
  type ParsedTransaction,
  type ColumnMapping,
} from './import.service';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── DTOs ───────────────────────────────────────────────────────────────────

class ColumnMappingDto {
  @IsNumber()
  date!: number;

  @IsNumber()
  description!: number;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsNumber()
  category?: number;

  @IsOptional()
  @IsNumber()
  debit?: number;

  @IsOptional()
  @IsNumber()
  credit?: number;
}

class UploadDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  mapping?: ColumnMappingDto;
}

class ParsedTransactionDto {
  @IsString()
  date!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsString()
  fitId?: string;
}

class ExecuteImportDto {
  @IsString()
  accountId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParsedTransactionDto)
  transactions!: ParsedTransactionDto[];

  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean;

  @IsString()
  fileName!: string;

  @IsString()
  fileType!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  columnMapping?: ColumnMappingDto;
}

class PreviewDto {
  @IsString()
  accountId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParsedTransactionDto)
  transactions!: ParsedTransactionDto[];
}

// ─── Controller ─────────────────────────────────────────────────────────────

@Controller('import')
export class ImportController {
  constructor(private importService: ImportService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          'text/csv',
          'text/plain',
          'application/csv',
          'application/vnd.ms-excel',
          'application/octet-stream', // OFX/QFX files often have this mime
          'application/x-ofx',
          'application/x-qfx',
        ];

        const allowedExts = ['.csv', '.ofx', '.qfx'];
        const ext = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));

        if (
          allowedMimes.includes(file.mimetype) ||
          allowedExts.includes(ext)
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only .csv, .ofx, and .qfx files are supported',
            ),
            false,
          );
        }
      },
    }),
  )
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const ext = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    if (ext === '.ofx' || ext === '.qfx') {
      const transactions = this.importService.parseOFX(file.buffer);
      return {
        fileType: ext.replace('.', ''),
        fileName: file.originalname,
        transactions,
        headers: null,
        rows: null,
        detectedFormat: 'ofx',
        mapping: null,
      };
    }

    // CSV parsing
    const mapping = body.mapping as ColumnMapping | undefined;
    const result = this.importService.parseCSV(file.buffer, mapping);

    return {
      fileType: 'csv',
      fileName: file.originalname,
      transactions: result.transactions,
      headers: result.headers,
      rows: result.rows,
      detectedFormat: result.detectedFormat,
      mapping: result.mapping,
    };
  }

  @Post('preview')
  async preview(
    @CurrentUser('id') userId: string,
    @Body() body: PreviewDto,
  ) {
    return this.importService.previewImport(
      userId,
      body.transactions,
      body.accountId,
    );
  }

  @Post('execute')
  async execute(
    @CurrentUser('id') userId: string,
    @Body() body: ExecuteImportDto,
  ) {
    return this.importService.executeImport(
      userId,
      body.transactions,
      body.accountId,
      { skipDuplicates: body.skipDuplicates ?? true },
      body.fileName,
      body.fileType,
      body.columnMapping,
    );
  }

  @Get('history')
  async history(@CurrentUser('id') userId: string) {
    return this.importService.getImportHistory(userId);
  }

  @Get('formats')
  formats() {
    return this.importService.getSupportedFormats();
  }
}
