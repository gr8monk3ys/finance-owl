import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { receipts } from './receipts.schema';
import * as schema from '../../database/schema';
import * as fs from 'fs';
import * as path from 'path';

interface ReceiptItem {
  name: string;
  quantity?: number;
  price?: number;
}

interface UpdateReceiptDto {
  merchantName?: string;
  totalAmount?: number;
  date?: string;
  items?: ReceiptItem[];
}

interface CreateTransactionDto {
  accountId: string;
  name: string;
  merchantName?: string;
  amount: number;
  date: string;
  categoryId?: string;
  notes?: string;
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  private readonly uploadDir = path.resolve('./data/receipts');

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadReceipt(
    userId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC',
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large. Maximum size is 10MB');
    }

    // Generate unique filename
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${userId}_${Date.now()}_${crypto.randomUUID()}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    // Write file to disk
    fs.writeFileSync(filepath, file.buffer);

    // Create receipt record
    const [receipt] = await this.db
      .insert(receipts)
      .values({
        userId,
        imagePath: filename,
        status: 'pending',
      })
      .returning();

    return receipt;
  }

  async processReceipt(userId: string, receiptId: string) {
    const receipt = await this.getReceipt(userId, receiptId);

    // Update status to show processing is happening
    await this.db
      .update(receipts)
      .set({ status: 'processed' })
      .where(eq(receipts.id, receiptId));

    // Since we cannot use external OCR APIs, we mark it as processed
    // and allow manual entry of receipt details.
    // In a production system, this would integrate with an OCR service
    // or local Ollama vision model.

    this.logger.log(
      `Receipt ${receiptId} marked as processed for manual data entry`,
    );

    const [updated] = await this.db
      .select()
      .from(receipts)
      .where(
        and(eq(receipts.id, receiptId), eq(receipts.userId, userId)),
      )
      .limit(1);

    return updated;
  }

  async getReceipts(userId: string) {
    return this.db
      .select()
      .from(receipts)
      .where(eq(receipts.userId, userId))
      .orderBy(desc(receipts.createdAt));
  }

  async getReceipt(userId: string, id: string) {
    const [receipt] = await this.db
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.userId, userId)))
      .limit(1);

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    return receipt;
  }

  async updateReceipt(userId: string, id: string, dto: UpdateReceiptDto) {
    await this.getReceipt(userId, id);

    const updateData: Record<string, unknown> = {};

    if (dto.merchantName !== undefined) {
      updateData.merchantName = dto.merchantName;
    }
    if (dto.totalAmount !== undefined) {
      updateData.totalAmount = dto.totalAmount;
    }
    if (dto.date !== undefined) {
      updateData.date = dto.date;
    }
    if (dto.items !== undefined) {
      updateData.items = JSON.stringify(dto.items);
    }

    if (Object.keys(updateData).length === 0) {
      return this.getReceipt(userId, id);
    }

    // Mark as processed if data is being entered
    updateData.status = 'processed';

    const [updated] = await this.db
      .update(receipts)
      .set(updateData)
      .where(and(eq(receipts.id, id), eq(receipts.userId, userId)))
      .returning();

    return updated;
  }

  async linkToTransaction(
    userId: string,
    receiptId: string,
    transactionId: string,
  ) {
    // Verify receipt exists and belongs to user
    await this.getReceipt(userId, receiptId);

    // Verify transaction exists and belongs to user
    const [transaction] = await this.db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, transactionId),
          eq(schema.transactions.userId, userId),
        ),
      )
      .limit(1);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const [updated] = await this.db
      .update(receipts)
      .set({ transactionId })
      .where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId)))
      .returning();

    return updated;
  }

  async createTransactionFromReceipt(
    userId: string,
    receiptId: string,
    dto: CreateTransactionDto,
  ) {
    // Verify receipt exists
    await this.getReceipt(userId, receiptId);

    // Create manual transaction
    const [transaction] = await this.db
      .insert(schema.transactions)
      .values({
        userId,
        accountId: dto.accountId,
        amount: dto.amount,
        name: dto.name,
        merchantName: dto.merchantName,
        date: dto.date,
        categoryId: dto.categoryId,
        notes: dto.notes || `Created from receipt`,
        isManual: true,
        categorizationSource: dto.categoryId ? 'manual' : null,
      })
      .returning();

    // Link receipt to the new transaction
    await this.db
      .update(receipts)
      .set({ transactionId: transaction.id })
      .where(eq(receipts.id, receiptId));

    return transaction;
  }

  async deleteReceipt(userId: string, id: string) {
    const receipt = await this.getReceipt(userId, id);

    // Delete the file
    const filepath = path.join(this.uploadDir, receipt.imagePath);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Delete the record
    await this.db
      .delete(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.userId, userId)));

    return { deleted: true };
  }

  getImagePath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }
}
