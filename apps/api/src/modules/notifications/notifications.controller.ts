import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';
import {
  NotificationQueryDto,
  PushSubscriptionDto,
  RemovePushSubscriptionDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Current user's notifications, newest first (cursor pagination via `before`)" })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationQueryDto) {
    const data = await this.notificationsService.list(user.id, query);
    return { success: true, data };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the badge' })
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const data = { unreadCount: await this.notificationsService.unreadCount(user.id) };
    return { success: true, data };
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark every notification as read' })
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.notificationsService.markAllRead(user.id);
    return { success: true, data };
  }

  @Post(':notificationId/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'notificationId', description: 'Notification UUID' })
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    const data = await this.notificationsService.markRead(user.id, notificationId);
    return { success: true, data };
  }

  @Get('settings')
  @ApiOperation({ summary: 'Preferences per notification type, configured channels, and push status' })
  async settings(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.notificationsService.getSettings(user.id);
    return { success: true, data };
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update channel preferences per notification type' })
  async updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateNotificationPreferencesDto) {
    const data = await this.notificationsService.updatePreferences(user.id, dto);
    return { success: true, data };
  }

  @Post('push-subscriptions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register this browser for web push' })
  async subscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: PushSubscriptionDto) {
    const data = await this.notificationsService.savePushSubscription(user.id, dto);
    return { success: true, data };
  }

  @Delete('push-subscriptions')
  @ApiOperation({ summary: 'Unregister a browser from web push' })
  async unsubscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: RemovePushSubscriptionDto) {
    const data = await this.notificationsService.removePushSubscription(user.id, dto.endpoint);
    return { success: true, data };
  }
}
