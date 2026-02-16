import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Global pipe that sanitises all string inputs by stripping HTML tags.
 *
 * This provides defence-in-depth against stored XSS: even if a value
 * passes validation, any HTML/script content is removed before it
 * reaches the service layer.
 *
 * Behaviour:
 *   - Strings: HTML tags are stripped (including attributes).
 *   - Arrays:  Each string element is sanitised recursively.
 *   - Objects: Each string property value is sanitised recursively.
 *   - Other types (number, boolean, null, undefined): passed through unchanged.
 *
 * The pipe is intentionally conservative -- it does NOT strip HTML
 * from `Buffer` or other non-plain-object types.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  /**
   * Regex to match HTML tags including self-closing tags and comments.
   * Handles:
   *   <script>...</script>
   *   <img src=x onerror=alert(1)>
   *   <!-- comments -->
   *   <br />, <hr/>
   */
  private static readonly HTML_TAG_REGEX = /<\/?[^>]+(>|$)/g;
  private static readonly HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.stripHtml(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value !== null && typeof value === 'object' && this.isPlainObject(value)) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        sanitized[key] = this.sanitize(val);
      }
      return sanitized;
    }

    // Numbers, booleans, null, undefined, Date, Buffer, etc. -- pass through
    return value;
  }

  private stripHtml(input: string): string {
    return input
      .replace(SanitizePipe.HTML_COMMENT_REGEX, '')
      .replace(SanitizePipe.HTML_TAG_REGEX, '')
      .trim();
  }

  /**
   * Check whether a value is a plain object (i.e. created via {} or new Object()).
   * This avoids accidentally mutating class instances, Buffers, Dates, etc.
   */
  private isPlainObject(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
}
