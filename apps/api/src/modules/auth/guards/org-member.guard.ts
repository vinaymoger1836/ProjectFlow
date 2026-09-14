import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { Database, userRoles, roles } from '@projectflow/database';
import { DRIZZLE_DB } from '../../database/database.module';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user || !user.id) {
      throw new ForbiddenException('User must be authenticated to access organization resources.');
    }

    // Resolve organization ID from params, headers, or query
    const orgId =
      request.params.orgId ||
      request.params.organizationId ||
      request.headers['x-organization-id'] ||
      request.query.organizationId ||
      request.body?.organizationId;

    if (!orgId) {
      throw new BadRequestException('Organization ID is required to access this resource.');
    }

    // Verify tenant membership & role
    const membership = await this.db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.userId, user.id), eq(userRoles.organizationId, orgId)))
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view or modify resources in this organization.',
      );
    }

    // Attach validated tenant context to request
    request.organizationId = orgId;
    request.userOrgRole = membership[0].roleName;

    return true;
  }
}
