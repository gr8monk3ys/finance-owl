import { describe, expect, it } from 'vitest';
import { getErrorMessage, getErrorStatus } from './error';

describe('server error helpers', () => {
  it('extracts messages from different error shapes', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage({ message: 'bad request' })).toBe('bad request');
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it('extracts status when present', () => {
    expect(getErrorStatus({ status: 401 })).toBe(401);
    expect(getErrorStatus(new Error('boom'))).toBeUndefined();
    expect(getErrorStatus('oops')).toBeUndefined();
  });
});
