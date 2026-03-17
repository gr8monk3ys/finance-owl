import { Injectable, Inject, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  DATABASE_TOKEN,
  type DrizzleDB,
} from '../../database/database.module';
import { supportTickets } from './support.schema';

export interface CreateTicketDto {
  userId: string;
  email: string;
  subject: string;
  category: string;
  message: string;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async createTicket(dto: CreateTicketDto) {
    const [ticket] = await this.db
      .insert(supportTickets)
      .values({
        userId: dto.userId,
        email: dto.email,
        subject: dto.subject,
        category: dto.category,
        message: dto.message,
        status: 'open',
      })
      .returning();

    this.logger.log(
      `Support ticket created: id=${ticket.id} user=${dto.userId} category=${dto.category}`,
    );

    return ticket;
  }

  async getTicketsByUser(userId: string) {
    return this.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }
}
