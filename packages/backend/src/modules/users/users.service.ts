import { Injectable, Inject } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Public profile of a user. Deliberately projects away `passwordHash` and
   * `totpSecret` so a row can be handed to a controller without leaking
   * credentials. Callers that need those columns use `findCredentialsById`.
   */
  async findById(id: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        totpEnabled: schema.users.totpEnabled,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user ?? null;
  }

  /**
   * Full user row for `id`, credentials included. Never return this from a
   * controller — it carries `passwordHash` and the encrypted `totpSecret`.
   */
  async findCredentialsById(id: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user ?? null;
  }

  /**
   * Full user row for `email`, credentials included. Same caveat as
   * `findCredentialsById`: this is the login path's lookup, not a DTO.
   */
  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return user ?? null;
  }

  async create(data: { name: string; email: string; passwordHash: string }) {
    const [user] = await this.db.insert(schema.users).values(data).returning({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    });
    return user;
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.db
      .update(schema.users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async setTotpSecret(userId: string, secret: string | null) {
    await this.db
      .update(schema.users)
      .set({
        totpSecret: secret,
        totpEnabled: secret !== null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Number of registered users. Uses a real COUNT(*) — the only caller
   * (`AuthService.isFirstRun`) just needs to know whether the table is empty,
   * and it is reachable unauthenticated, so it must not scan every row.
   */
  async count() {
    const [row] = await this.db.select({ value: count() }).from(schema.users);
    return row?.value ?? 0;
  }
}
