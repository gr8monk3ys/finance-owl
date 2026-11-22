import { InternalServerErrorException } from '@nestjs/common';

/** The first row of a query that always yields one: an INSERT/UPDATE ... RETURNING or an aggregate. */
export function firstRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new InternalServerErrorException('Database query returned no row');
  }
  return row;
}
