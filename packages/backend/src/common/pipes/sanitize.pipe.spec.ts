import { describe, it, expect } from 'vitest';
import type { ArgumentMetadata } from '@nestjs/common';
import { SanitizePipe } from './sanitize.pipe';

const bodyMeta: ArgumentMetadata = { type: 'body', metatype: Object, data: '' };

function run(value: unknown): unknown {
  return new SanitizePipe().transform(value, bodyMeta);
}

describe('SanitizePipe', () => {
  describe('strings', () => {
    it('leaves plain text untouched', () => {
      expect(run('Groceries at Trader Joe’s')).toBe('Groceries at Trader Joe’s');
    });

    it('removes a <script> element’s tags', () => {
      // Only the tags go; the text between them survives as inert text.
      expect(run('<script>alert(1)</script>')).toBe('alert(1)');
    });

    it('removes tags carrying event-handler attributes', () => {
      expect(run('Coffee <img src=x onerror=alert(1)> run')).toBe('Coffee  run');
    });

    it('removes self-closing and void tags', () => {
      expect(run('line one<br />line two<hr/>end')).toBe('line oneline twoend');
    });

    it('removes HTML comments including multi-line ones', () => {
      expect(run('rent<!-- hidden\npayload -->paid')).toBe('rentpaid');
    });

    it('keeps the inner text of formatting tags', () => {
      expect(run('<b>Salary</b> <i>October</i>')).toBe('Salary October');
    });

    it('strips an unterminated tag through the end of the string', () => {
      // HTML_TAG_REGEX ends in (>|$), so a dangling "<tag" is still removed.
      expect(run('Note <img src=x onerror=alert(1)')).toBe('Note');
    });

    it('trims surrounding whitespace left after stripping', () => {
      expect(run('  <p>Budget</p>  ')).toBe('Budget');
    });

    it('reduces a tag-only string to the empty string', () => {
      expect(run('<div></div>')).toBe('');
    });
  });

  describe('non-string scalars', () => {
    it.each([
      ['number', 42.5],
      ['zero', 0],
      ['boolean', false],
      ['null', null],
      ['undefined', undefined],
    ])('passes %s through unchanged', (_label, value) => {
      expect(run(value)).toBe(value);
    });
  });

  describe('arrays', () => {
    it('sanitizes each string element and keeps other elements', () => {
      expect(run(['<b>food</b>', 12, null, '<i>rent</i>'])).toEqual(['food', 12, null, 'rent']);
    });

    it('recurses into nested arrays', () => {
      expect(run([['<u>a</u>'], [['<s>b</s>']]])).toEqual([['a'], [['b']]]);
    });
  });

  describe('plain objects', () => {
    it('sanitizes string properties recursively and preserves other values', () => {
      const input = {
        description: '<script>x</script>Lunch',
        amount: -12.34,
        pending: true,
        memo: null,
        meta: { note: '<em>split</em>', tags: ['<b>work</b>', 'travel'] },
      };

      expect(run(input)).toEqual({
        description: 'xLunch',
        amount: -12.34,
        pending: true,
        memo: null,
        meta: { note: 'split', tags: ['work', 'travel'] },
      });
    });

    it('returns a new object and does not mutate the input', () => {
      const input = { name: '<b>Checking</b>' };
      const output = run(input);

      expect(output).not.toBe(input);
      expect(input.name).toBe('<b>Checking</b>');
    });

    it('sanitizes null-prototype objects', () => {
      const input = Object.assign(Object.create(null) as Record<string, unknown>, {
        name: '<i>Savings</i>',
      });

      expect(run(input)).toEqual({ name: 'Savings' });
    });

    it('sanitizes values but not keys', () => {
      expect(run({ '<k>': '<v>x</v>' })).toEqual({ '<k>': 'x' });
    });
  });

  describe('non-plain objects pass through by reference', () => {
    it('leaves Date instances alone', () => {
      const date = new Date('2026-10-01T00:00:00Z');
      expect(run(date)).toBe(date);
    });

    it('leaves Buffers alone, even when their bytes look like HTML', () => {
      const buf = Buffer.from('<script>alert(1)</script>');
      const out = run(buf);
      expect(out).toBe(buf);
      expect((out as Buffer).toString()).toBe('<script>alert(1)</script>');
    });

    it('leaves class instances unsanitized', () => {
      class Dto {
        name = '<b>kept</b>';
      }
      const dto = new Dto();
      const out = run(dto) as Dto;

      expect(out).toBe(dto);
      expect(out.name).toBe('<b>kept</b>');
    });

    it('does not sanitize a class instance nested inside a plain object', () => {
      class Upload {
        filename = '<b>a.csv</b>';
      }
      const upload = new Upload();
      const out = run({ title: '<b>Import</b>', upload }) as { title: string; upload: Upload };

      expect(out.title).toBe('Import');
      expect(out.upload).toBe(upload);
      expect(out.upload.filename).toBe('<b>a.csv</b>');
    });
  });
});
