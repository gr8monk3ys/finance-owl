import { InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { firstRow } from './first-row';

describe('firstRow', () => {
  it('returns the first row', () => {
    expect(firstRow([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
  });

  it('throws when the write or aggregate produced no row', () => {
    expect(() => firstRow([])).toThrow(InternalServerErrorException);
  });
});
