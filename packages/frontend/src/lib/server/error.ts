/**
 * Extract a message string from an unknown caught error.
 * Works with Error instances, objects with a `.message` property,
 * and falls back to String conversion for anything else.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/**
 * Extract HTTP status from a thrown error (e.g. SvelteKit redirect/error).
 */
export function getErrorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    return (err as { status: number }).status;
  }
  return undefined;
}
