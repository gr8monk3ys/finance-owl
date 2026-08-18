import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Sse,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Observable, filter, map } from 'rxjs';
import { CurrentUser } from '../../common/decorators';
import { NotificationsService } from './notifications.service';
import { IsOptional, IsNumberString, IsBooleanString } from 'class-validator';

// -- Query DTO ---------------------------------------------------------------
class ListNotificationsQuery {
  @ApiPropertyOptional({ description: 'Maximum number of notifications to return', example: '20' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ description: 'Number of notifications to skip', example: '0' })
  @IsOptional()
  @IsNumberString()
  offset?: string;

  @ApiPropertyOptional({ description: 'Return only unread notifications', example: 'true' })
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
}

// -- Controller --------------------------------------------------------------
@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@CurrentUser('id') userId: string, @Query() query: ListNotificationsQuery) {
    return this.notificationsService.getUserNotifications(userId, {
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
      unreadOnly: query.unreadOnly === 'true',
    });
  }

  @ApiOperation({ summary: 'Get count of unread notifications' })
  @ApiResponse({ status: 200, description: 'Unread notification count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('unread-count')
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @Patch(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 204, description: 'Notification deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.notificationsService.deleteNotification(userId, id);
  }

  @ApiOperation({
    summary: 'Subscribe to real-time notifications via Server-Sent Events',
    description:
      'Opens an SSE stream. The client should use EventSource to connect. ' +
      'Events are filtered to the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'SSE stream opened' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Sse('stream')
  stream(@CurrentUser('id') userId: string): Observable<MessageEvent> {
    return this.notificationsService.notificationStream$.pipe(
      filter((event) => event.userId === userId),
      map(
        (event) =>
          ({
            data: event.notification,
          }) as MessageEvent,
      ),
    );
  }
}
