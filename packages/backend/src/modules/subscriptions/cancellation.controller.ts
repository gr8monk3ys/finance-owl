import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { CancellationService } from './cancellation.service';
import { RequestCancellationDto, UpdateCancellationStatusDto } from './dto/cancellation.dto';
import {
  findCancellationEntry,
  generateCancellationEmail,
  generateCancellationScript,
  listCancellationEntries,
  searchCancellationEntries,
  type CancellationCatalogEntry,
} from './cancellation-catalog';

/**
 * The one cancellation controller.
 *
 * There used to be two, both registered, offering four pairs of routes that
 * did the same thing under different names -- and the two frontend pages had
 * each picked a different half, so a change to one flow silently left the other
 * behind. Route order matters here: the literal `cancellations/...` segments
 * must be declared before `cancellations/:id`.
 */
@Controller('subscriptions')
export class CancellationController {
  constructor(private cancellationService: CancellationService) {}

  @Post(':id/cancel')
  requestCancellation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: RequestCancellationDto,
  ) {
    return this.cancellationService.requestCancellation(userId, id, dto.reason);
  }

  @Get(':id/cancel-instructions')
  getCancellationInstructions(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.cancellationService.getCancellationInstructionsForSubscription(userId, id);
  }

  @Get('cancellations')
  getCancellationRequests(@CurrentUser('id') userId: string) {
    return this.cancellationService.getCancellationRequests(userId);
  }

  /** Cancellation progress and the savings it has produced. */
  @Get('cancellations/stats')
  getCancellationStats(@CurrentUser('id') userId: string) {
    return this.cancellationService.getCancellationStats(userId);
  }

  /** Browse the cancellation catalog. Supports an optional `?search=`. */
  @Get('cancellations/providers')
  getProviders(@Query('search') search?: string): CancellationCatalogEntry[] {
    return search ? searchCancellationEntries(search) : listCancellationEntries();
  }

  /** One provider's playbook, plus a ready-to-send email and a phone script. */
  @Get('cancellations/providers/:name')
  getProvider(@Param('name') name: string): {
    provider: CancellationCatalogEntry | null;
    emailTemplate: string;
    phoneScript: string;
  } {
    const provider = findCancellationEntry(name);
    const displayName = provider?.name ?? name;

    return {
      provider,
      emailTemplate: generateCancellationEmail(displayName, provider),
      phoneScript: generateCancellationScript(displayName, provider),
    };
  }

  @Get('cancellations/:id')
  getCancellationRequest(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.cancellationService.getCancellationRequest(userId, id);
  }

  @Patch('cancellations/:id/status')
  updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCancellationStatusDto,
  ) {
    return this.cancellationService.updateStatus(userId, id, dto.status, dto.notes);
  }

  @Post('cancellations/:id/confirm')
  confirmCancellation(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.cancellationService.confirmCancellation(userId, id);
  }
}
