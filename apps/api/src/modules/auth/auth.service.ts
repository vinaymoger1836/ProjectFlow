import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Database, users } from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  /**
   * Auto-provisions or synchronizes the user profile in PostgreSQL
   * when a valid Supabase JWT token is authenticated.
   */
  async syncUser(userData: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
  }): Promise<AuthenticatedUser> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userData.id))
      .limit(1);

    if (existing.length > 0) {
      const user = existing[0];
      // Update if fields have changed
      if (
        user.email !== userData.email ||
        user.name !== userData.name ||
        user.avatarUrl !== userData.avatarUrl
      ) {
        const [updated] = await this.db
          .update(users)
          .set({
            email: userData.email,
            name: userData.name,
            avatarUrl: userData.avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userData.id))
          .returning();

        return {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          avatarUrl: updated.avatarUrl,
        };
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };
    }

    // Insert new user matching Supabase Auth UUID
    const [created] = await this.db
      .insert(users)
      .values({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        avatarUrl: userData.avatarUrl,
      })
      .returning();

    return {
      id: created.id,
      email: created.email,
      name: created.name,
      avatarUrl: created.avatarUrl,
    };
  }

  async getUserById(id: string): Promise<AuthenticatedUser | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
    };
  }
}
