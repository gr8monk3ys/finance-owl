import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

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

  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return user ?? null;
  }

  async create(data: { name: string; email: string; passwordHash: string }) {
    const [user] = await this.db
      .insert(schema.users)
      .values(data)
      .returning({
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

  async count() {
    const result = await this.db
      .select({ id: schema.users.id })
      .from(schema.users);
    return result.length;
  }
}
