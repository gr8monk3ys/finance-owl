import { describe, it, expect } from 'vitest';
import {
  findCancellationEntry,
  listCancellationEntries,
  searchCancellationEntries,
  toCancellationInstructions,
  genericCancellationInstructions,
  cancellationInstructionsFor,
  generateCancellationEmail,
  generateCancellationScript,
} from './cancellation-catalog';

describe('cancellation catalog', () => {
  describe('findCancellationEntry', () => {
    it('matches an exact key', () => {
      expect(findCancellationEntry('netflix')?.name).toBe('Netflix');
    });

    it('is case- and whitespace-insensitive', () => {
      expect(findCancellationEntry('  NETFLIX  ')?.name).toBe('Netflix');
    });

    it('matches when the merchant name contains a key', () => {
      expect(findCancellationEntry('SPOTIFY USA 8774457952')?.name).toBe('Spotify');
    });

    it('matches at the word level when neither string contains the other', () => {
      expect(findCancellationEntry('Fitness Planet')?.name).toBe('Planet Fitness');
    });

    it('ignores key words of three characters or fewer', () => {
      // Without the length floor the "one" in "uber one" and "apple one" would
      // claim every merchant with "One" in its name.
      expect(findCancellationEntry('One Medical')).toBeNull();
    });

    it('returns null for a merchant it has never heard of', () => {
      expect(findCancellationEntry('Corner Bodega 44')).toBeNull();
    });
  });

  describe('generic fallback entries', () => {
    it('routes an unknown gym to the generic gym playbook', () => {
      const entry = findCancellationEntry("Gold's Gym");
      expect(entry?.name).toBe('Gym Membership');
      expect(entry?.steps.join(' ')).toContain('notice period');
    });

    it('lets a specific gym win over the generic one', () => {
      expect(findCancellationEntry('PLANET FITNESS CLUB FEES')?.name).toBe('Planet Fitness');
    });

    it('keeps the generic cable/internet playbook', () => {
      const entry = findCancellationEntry('cable/internet');
      expect(entry?.name).toBe('Cable / Internet Provider');
      expect(entry?.steps.join(' ')).toContain('retention');
    });
  });

  describe('catalog integrity', () => {
    const entries = listCancellationEntries();

    it('is de-duplicated by display name and sorted for browsing', () => {
      const names = entries.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('covers the whole merged provider table, not just the dozen that used to be written', () => {
      expect(entries.length).toBeGreaterThan(50);
    });

    it('gives every entry a name, steps, and a difficulty', () => {
      for (const entry of entries) {
        expect(entry.name.length).toBeGreaterThan(0);
        expect(entry.steps.length).toBeGreaterThan(0);
        expect(['easy', 'medium', 'hard']).toContain(entry.difficulty);
      }
    });

    it('links only to https URLs', () => {
      for (const entry of entries) {
        if (entry.url) {
          expect(entry.url.startsWith('https://'), entry.name).toBe(true);
        }
        if (entry.chatUrl) {
          expect(entry.chatUrl.startsWith('https://'), entry.name).toBe(true);
        }
      }
    });

    it('serves the maintained provider URL, not the copy that had drifted', () => {
      // The 12-entry table pointed Amazon Prime at a stale cancellation
      // pipeline; the maintained table points at the membership page.
      expect(findCancellationEntry('amazon prime')?.url).toContain('amazon.com/mc');
    });
  });

  describe('searchCancellationEntries', () => {
    it('filters by display name, case-insensitively', () => {
      const results = searchCancellationEntries('fitness');
      expect(results.length).toBeGreaterThan(1);
      expect(results.every((e) => e.name.toLowerCase().includes('fitness'))).toBe(true);
    });

    it('lists everything for an empty or blank query', () => {
      expect(searchCancellationEntries('')).toEqual(listCancellationEntries());
      expect(searchCancellationEntries('   ')).toEqual(listCancellationEntries());
    });

    it('returns nothing for a query that matches no provider', () => {
      expect(searchCancellationEntries('zzzznope')).toEqual([]);
    });
  });

  describe('toCancellationInstructions', () => {
    it('maps an online provider onto self_service plus its reachable channels', () => {
      const entry = findCancellationEntry('amazon prime')!;
      const instructions = toCancellationInstructions(entry);

      expect(instructions.methods[0]).toBe('self_service');
      expect(instructions.methods).toContain('phone');
      expect(instructions.methods).toContain('chat');
      expect(instructions.website).toBe(entry.url);
      expect(instructions.phone).toBe(entry.phoneNumber);
      expect(instructions.chatUrl).toBeTruthy();
    });

    it('leads with the provider primary channel', () => {
      expect(toCancellationInstructions(findCancellationEntry('la fitness')!).methods[0]).toBe(
        'in_person',
      );
    });

    it('never lists a phone or chat channel without contact details', () => {
      for (const entry of listCancellationEntries()) {
        const instructions = toCancellationInstructions(entry);
        if (entry.cancellationMethod !== 'phone' && instructions.methods.includes('phone')) {
          expect(instructions.phone, entry.name).toBeTruthy();
        }
        if (entry.cancellationMethod !== 'chat' && instructions.methods.includes('chat')) {
          expect(instructions.chatUrl, entry.name).toBeTruthy();
        }
      }
    });

    it('reports contact fields as null rather than undefined', () => {
      const instructions = toCancellationInstructions(findCancellationEntry('netflix')!);
      expect(instructions.email).toBeNull();
      expect(instructions.chatUrl).toBeNull();
    });
  });

  describe('cancellationInstructionsFor', () => {
    it('hands a known provider its real playbook', () => {
      // The write path used to persist generic boilerplate here while the real
      // Peloton entry sat unread in the other table.
      const instructions = cancellationInstructionsFor('Peloton');
      const generic = genericCancellationInstructions('Peloton');

      expect(instructions.steps).not.toEqual(generic.steps);
      expect(instructions.steps.join(' ').toLowerCase()).toContain('peloton');
    });

    it('falls back to generic advice for an unknown merchant', () => {
      const instructions = cancellationInstructionsFor('Corner Bodega 44');

      expect(instructions).toEqual(genericCancellationInstructions('Corner Bodega 44'));
      expect(instructions.steps[0]).toContain('Corner Bodega 44');
      expect(instructions.methods[0]).toBe('self_service');
    });

    it('always yields a persistable method for the request record', () => {
      for (const name of ['Netflix', 'Peloton', "Gold's Gym", 'Corner Bodega 44']) {
        expect(cancellationInstructionsFor(name).methods[0]).toBeTruthy();
      }
    });
  });

  describe('generateCancellationEmail', () => {
    it('prefers a provider-supplied template', () => {
      const entry = { ...findCancellationEntry('netflix')!, emailTemplate: 'CUSTOM TEMPLATE' };
      expect(generateCancellationEmail('Netflix', entry)).toBe('CUSTOM TEMPLATE');
    });

    it('falls back to a filled-in generic letter', () => {
      const email = generateCancellationEmail('Corner Bodega 44', null);
      expect(email).toContain('Subscription Cancellation Request - Corner Bodega 44');
      expect(email).toContain('[YOUR ACCOUNT EMAIL]');
    });
  });

  describe('generateCancellationScript', () => {
    it('warns and coaches on retention offers for a hard provider', () => {
      const entry = findCancellationEntry('sirius xm')!;
      expect(entry.difficulty).toBe('hard');

      const script = generateCancellationScript(entry.name, entry);
      expect(script).toContain('WARNING');
      expect(script).toContain('HANDLING RETENTION OFFERS');
      expect(script).toContain(entry.phoneNumber!);
    });

    it('skips the warning for an easy provider', () => {
      const entry = findCancellationEntry('netflix')!;
      expect(entry.difficulty).toBe('easy');

      const script = generateCancellationScript(entry.name, entry);
      expect(script).not.toContain('WARNING');
      expect(script).not.toContain('HANDLING RETENTION OFFERS');
    });

    it('tells the user where to find a number when the catalog has none', () => {
      const script = generateCancellationScript('Corner Bodega 44', null);
      expect(script).toContain('Check the provider website');
      expect(script).toContain('Corner Bodega 44');
    });
  });
});
