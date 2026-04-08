'use strict';

const { esc, parseBulkLines, buildCardArrayStrings } = require('../lib/admin-logic');

// ─── esc ─────────────────────────────────────────────────────────────────────

describe('esc', () => {
  test('escapes double quotes', () => {
    expect(esc('say "hello"')).toBe('say &quot;hello&quot;');
  });

  test('escapes < and >', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  test('escapes & before other characters (no double-escaping)', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  test('does not double-escape already-escaped entities', () => {
    // The function escapes raw characters; it does not decode existing entities.
    // Raw '&amp;' should become '&amp;amp;' (the & in it gets escaped).
    expect(esc('&amp;')).toBe('&amp;amp;');
  });

  test('handles empty string', () => {
    expect(esc('')).toBe('');
  });

  test('handles string with no special characters', () => {
    expect(esc('hello world')).toBe('hello world');
  });

  test('escapes all special chars in one string', () => {
    expect(esc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  test('coerces non-string input to string', () => {
    expect(esc(42)).toBe('42');
  });
});

// ─── parseBulkLines ──────────────────────────────────────────────────────────

describe('parseBulkLines — rage mode', () => {
  test('parses a question with punchline', () => {
    const { added, skipped } = parseBulkLines(['What is love? | Baby don\'t hurt me'], 'rage', 0, false);
    expect(added).toHaveLength(1);
    expect(skipped).toBe(0);
    const card = added[0];
    expect(card.type).toBe('rage');
    expect(card.q).toBe('What is love?');
    expect(card.s).toBe("Baby don't hurt me");
    expect(card.cat).toBe(0);
    expect(card.free).toBe(false);
  });

  test('parses a question without punchline', () => {
    const { added } = parseBulkLines(['Just a question'], 'rage', 2, true);
    expect(added[0].q).toBe('Just a question');
    expect(added[0].s).toBe('');
    expect(added[0].free).toBe(true);
  });

  test('skips blank/empty lines', () => {
    const { added, skipped } = parseBulkLines(['', '  '], 'rage', 0, false);
    // parseBulkLines receives already-trimmed non-empty lines, so passing trimmed empty hits the !parts[0] guard
    expect(skipped).toBe(2);
    expect(added).toHaveLength(0);
  });

  test('Ultimate Rage (cat 5) cards are always locked=true and free=false', () => {
    const { added } = parseBulkLines(['Dark secret | Own it'], 'rage', 5, true);
    expect(added[0].locked).toBe(true);
    expect(added[0].free).toBe(false);
  });

  test('non-ultimate rage cards honour isFree flag', () => {
    const { added: free } = parseBulkLines(['Q | S'], 'rage', 0, true);
    const { added: paid } = parseBulkLines(['Q | S'], 'rage', 0, false);
    expect(free[0].free).toBe(true);
    expect(paid[0].free).toBe(false);
  });

  test('processes multiple lines', () => {
    const lines = ['Q1 | S1', 'Q2 | S2', 'Q3'];
    const { added, skipped } = parseBulkLines(lines, 'rage', 1, false);
    expect(added).toHaveLength(3);
    expect(skipped).toBe(0);
  });
});

describe('parseBulkLines — tf mode', () => {
  test('parses question and punchline', () => {
    const { added } = parseBulkLines(['I have done X | Bet you have'], 'tf', 'tf', false);
    expect(added[0].type).toBe('tf');
    expect(added[0].q).toBe('I have done X');
    expect(added[0].s).toBe('Bet you have');
  });

  test('defaults level to LEVEL 1 when not provided', () => {
    const { added } = parseBulkLines(['Q'], 'tf', 'tf', false);
    expect(added[0].lv).toBe('LEVEL 1 — WARM UP 😏');
  });

  test('uses provided level in 3rd pipe field', () => {
    const { added } = parseBulkLines(['Q | S | LEVEL 3 — FULL CHAOS 💀'], 'tf', 'tf', false);
    expect(added[0].lv).toBe('LEVEL 3 — FULL CHAOS 💀');
  });

  test('skips empty lines', () => {
    const { skipped } = parseBulkLines([''], 'tf', 'tf', false);
    expect(skipped).toBe(1);
  });
});

describe('parseBulkLines — wml mode', () => {
  test('parses question and punchline', () => {
    const { added } = parseBulkLines(['Who ate it? | You know who'], 'wml', 'wml', true);
    expect(added[0].type).toBe('wml');
    expect(added[0].q).toBe('Who ate it?');
    expect(added[0].s).toBe('You know who');
    expect(added[0].free).toBe(true);
  });

  test('skips empty lines', () => {
    const { skipped } = parseBulkLines([''], 'wml', 'wml', false);
    expect(skipped).toBe(1);
  });
});

describe('parseBulkLines — wyr mode', () => {
  test('parses option A, option B, and punchline', () => {
    const { added } = parseBulkLines(['Eat bugs | Drink seawater | Both bad'], 'wyr', 'wyr', false);
    expect(added[0].type).toBe('wyr');
    expect(added[0].a).toBe('Eat bugs');
    expect(added[0].b).toBe('Drink seawater');
    expect(added[0].s).toBe('Both bad');
  });

  test('punchline is optional (defaults to empty string)', () => {
    const { added } = parseBulkLines(['A | B'], 'wyr', 'wyr', false);
    expect(added[0].s).toBe('');
  });

  test('skips line with only option A (missing B)', () => {
    const { added, skipped } = parseBulkLines(['Only A'], 'wyr', 'wyr', false);
    expect(added).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  test('skips line where A is empty', () => {
    const { skipped } = parseBulkLines([' | B | S'], 'wyr', 'wyr', false);
    expect(skipped).toBe(1);
  });

  test('skips line where B is empty', () => {
    const { skipped } = parseBulkLines(['A |  | S'], 'wyr', 'wyr', false);
    expect(skipped).toBe(1);
  });

  test('mixed valid and invalid lines', () => {
    const lines = ['A | B | S', 'Only A', 'C | D'];
    const { added, skipped } = parseBulkLines(lines, 'wyr', 'wyr', false);
    expect(added).toHaveLength(2);
    expect(skipped).toBe(1);
  });
});

// ─── buildCardArrayStrings ───────────────────────────────────────────────────

const SAMPLE_CARDS = [
  { id: 1, type: 'rage', cat: 0, q: 'Spicy Q?',   s: 'Own it.', free: true,  locked: false },
  { id: 2, type: 'rage', cat: 5, q: 'Dark secret', s: 'Careful.', free: false, locked: true  },
  { id: 3, type: 'tf',   lv: 'LEVEL 1 — WARM UP 😏', q: 'TF Q',  s: 'TF S', free: true  },
  { id: 4, type: 'wml',  q: 'WML Q',  s: 'WML S', free: false },
  { id: 5, type: 'wyr',  a: 'Opt A',  b: 'Opt B',  s: 'WYR S', free: true  },
];

describe('buildCardArrayStrings', () => {
  test('free export: free cards get f:1, paid cards get f:0', () => {
    const { rcJS } = buildCardArrayStrings(SAMPLE_CARDS, 'free');
    // Card 1 (free:true) → f:1
    expect(rcJS).toContain('"Spicy Q?",s:"Own it.",f:1');
    // Card 2 (free:false, locked:true) → f:0 AND lk:1
    expect(rcJS).toContain('"Dark secret",s:"Careful.",f:0,lk:1');
  });

  test('members export: all cards get f:1', () => {
    const { rcJS } = buildCardArrayStrings(SAMPLE_CARDS, 'members');
    // Both rage cards should have f:1
    const matches = rcJS.match(/f:1/g);
    expect(matches).toHaveLength(2);
    // No lk:1 in members export
    expect(rcJS).not.toContain('lk:1');
  });

  test('TF cards include lv field', () => {
    const { tfJS } = buildCardArrayStrings(SAMPLE_CARDS, 'free');
    expect(tfJS).toContain('lv:');
    expect(tfJS).toContain('LEVEL 1');
  });

  test('WML cards have correct structure', () => {
    const { wmlJS } = buildCardArrayStrings(SAMPLE_CARDS, 'free');
    expect(wmlJS).toContain('"WML Q"');
    expect(wmlJS).toContain('"WML S"');
    expect(wmlJS).toContain('t:"wml"');
  });

  test('WYR cards have a and b fields', () => {
    const { wyrJS } = buildCardArrayStrings(SAMPLE_CARDS, 'free');
    expect(wyrJS).toContain('"Opt A"');
    expect(wyrJS).toContain('"Opt B"');
    expect(wyrJS).toContain('t:"wyr"');
  });

  test('empty card array produces empty strings', () => {
    const { rcJS, tfJS, wmlJS, wyrJS } = buildCardArrayStrings([], 'free');
    expect(rcJS).toBe('');
    expect(tfJS).toBe('');
    expect(wmlJS).toBe('');
    expect(wyrJS).toBe('');
  });

  test('special characters in questions are JSON-escaped', () => {
    const cards = [{ id: 1, type: 'wml', q: 'Who said "yes"?', s: '', free: false }];
    const { wmlJS } = buildCardArrayStrings(cards, 'free');
    // JSON.stringify handles the quotes — result should be valid JS parseable JSON
    expect(wmlJS).toContain('Who said \\"yes\\"?');
  });

  test('missing s field defaults to empty string', () => {
    const cards = [{ id: 1, type: 'wml', q: 'Q', free: false }];
    const { wmlJS } = buildCardArrayStrings(cards, 'free');
    expect(wmlJS).toContain('s:""');
  });

  test('free export: locked non-ultimate card (free:false, locked:false) gets f:0 without lk', () => {
    const cards = [{ id: 1, type: 'rage', cat: 0, q: 'Q', s: '', free: false, locked: false }];
    const { rcJS } = buildCardArrayStrings(cards, 'free');
    expect(rcJS).toContain('f:0');
    expect(rcJS).not.toContain('lk:1');
  });
});
