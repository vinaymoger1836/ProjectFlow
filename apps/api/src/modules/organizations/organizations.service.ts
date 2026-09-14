import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  Database,
  organizations,
  roles,
  userRoles,
  projects,
} from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  /**
   * Lists all organizations the authenticated user belongs to.
   */
  async listUserOrganizations(userId: string) {
    const userOrgs = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logoUrl: organizations.logoUrl,
        role: roles.name,
        createdAt: organizations.createdAt,
      })
      .from(userRoles)
      .innerJoin(organizations, eq(userRoles.organizationId, organizations.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return userOrgs;
  }

  /**
   * Retrieves a specific organization if the user has membership.
   */
  async getOrganizationById(userId: string, orgId: string) {
    const membership = await this.db
      .select({
        org: organizations,
        role: roles.name,
      })
      .from(userRoles)
      .innerJoin(organizations, eq(userRoles.organizationId, organizations.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.userId, userId), eq(userRoles.organizationId, orgId)))
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenException('You do not have access to this organization.');
    }

    const { org, role } = membership[0];

    // Count active projects in organization
    const orgProjects = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, orgId));

    return {
      ...org,
      userRole: role,
      projectCount: orgProjects.length,
    };
  }

  /**
   * Creates a new organization, default roles, and assigns creator as OWNER in a transaction.
   */
  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug is taken
    const existing = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        `Organization slug "${slug}" is already taken. Please choose a different slug.`,
      );
    }

    return await this.db.transaction(async (tx) => {
      // 1. Insert organization
      const [createdOrg] = await tx
        .insert(organizations)
        .values({
          name: dto.name,
          slug,
          logoUrl: dto.logoUrl || null,
        })
        .returning();

      // 2. Create default organization roles
      const defaultRoles = [
        { name: 'OWNER', description: 'Full administrative control over the organization' },
        { name: 'ADMIN', description: 'Can manage projects, settings, and team members' },
        { name: 'MEMBER', description: 'Standard collaborator with project access' },
        { name: 'GUEST', description: 'Restricted read-only access' },
      ];

      const createdRoles = await tx
        .insert(roles)
        .values(
          defaultRoles.map((r) => ({
            organizationId: createdOrg.id,
            name: r.name,
            description: r.description,
          })),
        )
        .returning();

      const ownerRole = createdRoles.find((r) => r.name === 'OWNER');
      if (!ownerRole) {
        throw new Error('Failed to create default OWNER role');
      }

      // 3. Assign creator as OWNER in user_roles
      await tx.insert(userRoles).values({
        userId,
        organizationId: createdOrg.id,
        roleId: ownerRole.id,
      });

      return {
        ...createdOrg,
        userRole: 'OWNER',
      };
    });
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${base}-${randomSuffix}`;
  }
}
