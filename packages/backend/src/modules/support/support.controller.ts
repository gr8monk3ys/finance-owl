import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsEmail } from 'class-validator';
import { CurrentUser } from '../../common/decorators';
import { SupportService } from './support.service';

class CreateTicketBody {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;
}

@ApiTags('Support')
@ApiBearerAuth('bearer')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @ApiOperation({ summary: 'Submit a support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  async createTicket(@CurrentUser('id') userId: string, @Body() body: CreateTicketBody) {
    const ticket = await this.supportService.createTicket({
      userId,
      email: body.email,
      subject: body.subject,
      category: body.category,
      message: body.message,
    });

    return {
      id: ticket.id,
      message: "Your request has been submitted. We'll respond via email.",
    };
  }

  @ApiOperation({ summary: 'List support tickets for the current user' })
  @ApiResponse({ status: 200, description: 'List of support tickets' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('tickets')
  async listTickets(@CurrentUser('id') userId: string) {
    return this.supportService.getTicketsByUser(userId);
  }
}
