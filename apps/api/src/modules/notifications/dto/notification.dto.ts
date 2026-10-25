import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@projectflow/types';
import { NOTIFICATION_TYPES } from '../notifications.constants';

export class NotificationQueryDto {
  @ApiPropertyOptional({ description: 'Return notifications created before this ISO timestamp (pagination cursor)' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;
}

export class NotificationPreferenceDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsIn(NOTIFICATION_TYPES)
  type: NotificationType;

  @ApiProperty()
  @IsBoolean()
  inApp: boolean;

  @ApiProperty()
  @IsBoolean()
  email: boolean;

  @ApiProperty()
  @IsBoolean()
  push: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: [NotificationPreferenceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceDto)
  preferences: NotificationPreferenceDto[];
}

class PushSubscriptionKeysDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  p256dh: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  auth: string;
}

export class PushSubscriptionDto {
  @ApiProperty({ description: 'Push service endpoint from PushSubscription.toJSON()' })
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(1000)
  endpoint: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}

export class RemovePushSubscriptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  endpoint: string;
}
