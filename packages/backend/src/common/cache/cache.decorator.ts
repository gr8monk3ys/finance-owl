import { Inject } from '@nestjs/common';
import { CacheService } from './cache.service';

// ── Constants ─────────────────────────────────────────────────────

/**
 * Metadata key used to mark which constructor parameter should receive
 * the CacheService instance.  We need this because decorators run before
 * the NestJS container resolves dependencies, so we inject the service
 * lazily via the method's owning class instance.
 */
const CACHE_SERVICE_PROPERTY = Symbol('__cacheService__');

// ── @Cacheable ────────────────────────────────────────────────────

/**
 * Method decorator that caches the return value using the cache-aside
 * pattern.
 *
 * **Key template** — supports `{{paramName}}` placeholders that are
 * resolved from the method's arguments at invocation time.  The mapping
 * uses the *parameter names* from the function signature at runtime,
 * which means it works best with explicit argument names rather than
 * destructured patterns.
 *
 * ```ts
 * @Cacheable('analytics:{{userId}}:spending', 300)
 * async getSpending(userId: string, startDate: string, endDate: string) { ... }
 * ```
 *
 * The decorator expects a `CacheService` instance to be available on the
 * class instance under the `cacheService` property (either injected via
 * the constructor, or set manually for testing).  If no `CacheService` is
 * found the method is executed without caching.
 *
 * @param keyTemplate  Cache key with `{{param}}` placeholders
 * @param ttlSeconds   Time-to-live in seconds
 */
export function Cacheable(keyTemplate: string, ttlSeconds: number) {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = async function (this: Record<string, unknown>, ...args: unknown[]) {
      const cache: CacheService | undefined = this.cacheService as CacheService | undefined;
      if (!cache) {
        return originalMethod.apply(this, args);
      }

      const key = resolveKey(keyTemplate, originalMethod, args);
      return cache.wrap(key, ttlSeconds, () => originalMethod.apply(this, args) as Promise<unknown>);
    };

    // Preserve the original name for debugging
    Object.defineProperty(descriptor.value, 'name', {
      value: originalMethod.name,
    });

    return descriptor;
  };
}

// ── @CacheEvict ───────────────────────────────────────────────────

/**
 * Method decorator that invalidates cache entries matching a pattern
 * **after** the decorated method completes successfully.
 *
 * The `keyPattern` supports the same `{{paramName}}` placeholders as
 * `@Cacheable`, plus Redis glob characters (`*`, `?`).
 *
 * ```ts
 * @CacheEvict('analytics:{{userId}}:*')
 * async createTransaction(userId: string, data: CreateDto) { ... }
 * ```
 */
export function CacheEvict(keyPattern: string) {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = async function (this: Record<string, unknown>, ...args: unknown[]) {
      const result = await originalMethod.apply(this, args);

      const cache: CacheService | undefined = this.cacheService as CacheService | undefined;
      if (cache) {
        const pattern = resolveKey(keyPattern, originalMethod, args);
        await cache.delPattern(pattern);
      }

      return result;
    };

    Object.defineProperty(descriptor.value, 'name', {
      value: originalMethod.name,
    });

    return descriptor;
  };
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Resolve `{{paramName}}` placeholders in a key template by matching
 * them against the original function's parameter names (extracted via
 * `Function.prototype.toString()`).
 *
 * Falls back to positional index (`{{0}}`, `{{1}}`, ...) if parameter
 * names cannot be extracted.
 */
function resolveKey(
  template: string,
  fn: (...args: unknown[]) => unknown,
  args: unknown[],
): string {
  const paramNames = extractParamNames(fn);

  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    // Try named parameter first
    const idx = paramNames.indexOf(name);
    if (idx !== -1 && idx < args.length) {
      return String(args[idx]);
    }

    // Try numeric index
    const numIdx = parseInt(name, 10);
    if (!isNaN(numIdx) && numIdx < args.length) {
      return String(args[numIdx]);
    }

    return name;
  });
}

/**
 * Extract parameter names from a function's source text.
 *
 * This handles:
 *   - Regular functions: `function foo(a, b, c) { ... }`
 *   - Arrow functions:   `(a, b, c) => { ... }`
 *   - Methods:           `foo(a, b, c) { ... }`
 *   - Async variants of all the above
 */
function extractParamNames(fn: (...args: unknown[]) => unknown): string[] {
  const src = fn.toString();

  // Match the parameter list between the first pair of parentheses
  const match = src.match(/\(([^)]*)\)/);
  if (!match || !match[1].trim()) return [];

  return match[1]
    .split(',')
    .map((p) => {
      // Strip default values, type annotations, decorators, and destructuring
      const cleaned = p
        .replace(/=.*$/s, '')   // default values
        .replace(/:.*/s, '')    // TS type annotations
        .replace(/\/\*.*?\*\//g, '') // block comments
        .trim();
      return cleaned;
    })
    .filter(Boolean);
}
