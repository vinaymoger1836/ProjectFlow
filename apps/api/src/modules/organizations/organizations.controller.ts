import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations the current user belongs to' })
  async listUserOrganizations(@CurrentUser() user: AuthenticatedUser) {
    const orgs = await this.organizationsService.listUserOrganizations(user.id);
    return {
      success: true,
      data: orgs,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new organization (current user becomes OWNER)' })
  async createOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    const org = await this.organizationsService.createOrganization(user.id, dto);
    return {
      success: true,
      data: org,
    };
  }

  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  @ApiOperation({ summary: 'Get details of a specific organization (strict tenant isolation)' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  async getOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ) {
    const org = await this.organizationsService.getOrganizationById(user.id, orgId);
    return {
      success: true,
      data: org,
    };
  }
}
