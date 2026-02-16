import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators';
import { ReceiptsService } from './receipts.service';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import * as fs from 'fs';

class ReceiptItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;
}

class UpdateReceiptDto {
  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items?: ReceiptItemDto[];
}

class LinkTransactionDto {
  @IsString()
  transactionId!: string;
}

class CreateTransactionFromReceiptDto {
  @IsString()
  accountId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('receipts')
export class ReceiptsController {
  constructor(private receiptsService: ReceiptsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadReceipt(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.receiptsService.uploadReceipt(userId, file);
  }

  @Get()
  getReceipts(@CurrentUser('id') userId: string) {
    return this.receiptsService.getReceipts(userId);
  }

  @Get(':id')
  getReceipt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.receiptsService.getReceipt(userId, id);
  }

  @Get(':id/image')
  async getImage(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const receipt = await this.receiptsService.getReceipt(userId, id);
    const imagePath = this.receiptsService.getImagePath(receipt.imagePath);

    if (!fs.existsSync(imagePath)) {
      throw new NotFoundException('Image file not found');
    }

    const ext = receipt.imagePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
    };

    res.setHeader(
      'Content-Type',
      mimeTypes[ext || 'jpg'] || 'image/jpeg',
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    fs.createReadStream(imagePath).pipe(res);
  }

  @Post(':id/process')
  processReceipt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.receiptsService.processReceipt(userId, id);
  }

  @Post(':id/update')
  updateReceipt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.receiptsService.updateReceipt(userId, id, dto);
  }

  @Post(':id/link')
  linkToTransaction(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: LinkTransactionDto,
  ) {
    return this.receiptsService.linkToTransaction(
      userId,
      id,
      dto.transactionId,
    );
  }

  @Post(':id/create-transaction')
  createTransactionFromReceipt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateTransactionFromReceiptDto,
  ) {
    return this.receiptsService.createTransactionFromReceipt(userId, id, dto);
  }

  @Delete(':id')
  deleteReceipt(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.receiptsService.deleteReceipt(userId, id);
  }
}
