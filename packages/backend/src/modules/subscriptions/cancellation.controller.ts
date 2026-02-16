import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { CancellationService } from './cancellation.service';
import {
  RequestCancellationDto,
  UpdateCancellationStatusDto,
} from './dto/cancellation.dto';

@Controller('subscriptions')
export class CancellationController {
  constructor(private cancellationService: CancellationService) {}

  @Post(':id/cancel')
  requestCancellation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: RequestCancellationDto,
  ) {
    return this.cancellationService.requestCancellation(
      userId,
      id,
      dto.reason,
    );
  }

  @Get('cancellations')
  getCancellationRequests(@CurrentUser('id') userId: string) {
    return this.cancellationService.getCancellationRequests(userId);
  }

  @Get('cancellations/stats')
  getCancellationStats(@CurrentUser('id') userId: string) {
    return this.cancellationService.getCancellationStats(userId);
  }

  @Get('cancellations/:id')
  getCancellationRequest(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.cancellationService.getCancellationRequest(userId, id);
  }

  @Patch('cancellations/:id/status')
  updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCancellationStatusDto,
  ) {
    return this.cancellationService.updateStatus(
      userId,
      id,
      dto.status,
      dto.notes,
    );
  }

  @Post('cancellations/:id/confirm')
  confirmCancellation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.cancellationService.confirmCancellation(userId, id);
  }

  @Get(':id/cancel-instructions')
  getCancellationInstructions(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.cancellationService.getCancellationInstructionsForSubscription(
      userId,
      id,
    );
  }
}
