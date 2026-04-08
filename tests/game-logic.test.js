'use strict';

const { shuf, catKey, isLocked, markSeen, buildDeck } = require('../lib/game-logic');

// ─── Minimal card fixtures ───────────────────────────────────────────────────

const rFree  = { t: 'r', c: 0, q: 'Q1', s: '', f: 1 };
const rPaid  = { t: 'r', c: 0, q: 'Q2', s: '', f: 0 };
const rUlt   = { t: 'r', c: 5, q: 'Q3', s: '', f: 0, lk: 1 };  // Ultimate Rage (always locked)
const tfFree = { t: 'tf', q: 'TF1', s: '', f: 1 };
const tfPaid = { t: 'tf', q: 'TF2', s: '', f: 0 };
const wmlFree = { t: 'wml', q: 'WML1', s: '', f: 1 };
const wyrFree = { t: 'wyr', a: 'A', b: 'B', s: '', f: 1 };
const wyrPaid = { t: 'wyr', a: 'C', b: 'D', s: '', f: 0 };

const SAMPLE_DATA = {
  RC:  [rFree, rPaid, rUlt,
        { t: 'r', c: 1, q: 'Q4', s: '', f: 1 },
        { t: 'r', c: 1, q: 'Q5', s: '', f: 0 }],
  TF:  [tfFree, tfPaid],
  WML: [wmlFree, { t: 'wml', q: 'WML2', s: '', f: 0 }],
  WYR: [wyrFree, wyrPaid],
};

// ─── shuf ────────────────────────────────────────────────────────────────────

describe('shuf', () => {
  test('returns a new array of the same length', () => {
    const src = [1, 2, 3, 4, 5];
    const result = shuf(src);
    expect(result).toHaveLength(src.length);
    expect(result).not.toBe(src); // different reference
  });

  test('contains all original elements', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuf(src);
    expect(result.sort()).toEqual([...src].sort());
  });

  test('does not mutate the input array', () => {
    const src = [1, 2, 3];
    const copy = [...src];
    shuf(src);
    expect(src).toEqual(copy);
  });

  test('handles empty array', () => {
    expect(shuf([])).toEqual([]);
  });

  test('handles single-element array', () => {
    expect(shuf([42])).toEqual([42]);
  });

  test('produces different orderings over multiple calls (statistical)', () => {
    // With 8 elements the chance of same order twice in 20 tries is astronomically small
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const orders = new Set();
    for (let i = 0; i < 20; i++) {
      orders.add(shuf(src).join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});

// ─── catKey ──────────────────────────────────────────────────────────────────

describe('catKey', () => {
  test('rage card returns r<cat>', () => {
    expect(catKey({ t: 'r', c: 0 })).toBe('r0');
    expect(catKey({ t: 'r', c: 5 })).toBe('r5');
    expect(catKey({ t: 'r', c: 3 })).toBe('r3');
  });

  test('tf card returns "tf"', () => {
    expect(catKey({ t: 'tf' })).toBe('tf');
  });

  test('wml card returns "wml"', () => {
    expect(catKey({ t: 'wml' })).toBe('wml');
  });

  test('wyr card returns "wyr"', () => {
    expect(catKey({ t: 'wyr' })).toBe('wyr');
  });
});

// ─── isLocked ────────────────────────────────────────────────────────────────

describe('isLocked', () => {
  test('lk:1 card is always locked regardless of freeShown', () => {
    expect(isLocked(rUlt, {}, 5)).toBe(true);
    expect(isLocked(rUlt, { r5: 0 }, 5)).toBe(true);
  });

  test('f:1 card is never locked', () => {
    expect(isLocked(rFree, {}, 5)).toBe(false);
    expect(isLocked(rFree, { r0: 100 }, 5)).toBe(false);
  });

  test('non-free card is unlocked when freeShown < freePerCat', () => {
    expect(isLocked(rPaid, { r0: 0 }, 5)).toBe(false);
    expect(isLocked(rPaid, { r0: 4 }, 5)).toBe(false);
  });

  test('non-free card is locked when freeShown >= freePerCat', () => {
    expect(isLocked(rPaid, { r0: 5 }, 5)).toBe(true);
    expect(isLocked(rPaid, { r0: 9 }, 5)).toBe(true);
  });

  test('uses correct category key — different cats do not interfere', () => {
    const freeShown = { r0: 5, r1: 2 };
    const cat0Paid = { t: 'r', c: 0, f: 0 };
    const cat1Paid = { t: 'r', c: 1, f: 0 };
    expect(isLocked(cat0Paid, freeShown, 5)).toBe(true);
    expect(isLocked(cat1Paid, freeShown, 5)).toBe(false);
  });

  test('with freePerCat=9999 (members), non-free cards are unlocked', () => {
    expect(isLocked(rPaid, { r0: 5 }, 9999)).toBe(false);
  });

  test('missing key in freeShown treated as 0', () => {
    expect(isLocked(rPaid, {}, 5)).toBe(false);
  });
});

// ─── markSeen ────────────────────────────────────────────────────────────────

describe('markSeen', () => {
  test('increments freeShown for a free card', () => {
    const freeShown = {};
    markSeen(rFree, freeShown, 5);
    expect(freeShown['r0']).toBe(1);
  });

  test('does not increment for a paid card', () => {
    const freeShown = {};
    markSeen(rPaid, freeShown, 5);
    expect(freeShown['r0']).toBeUndefined();
  });

  test('does not increment for lk card', () => {
    const freeShown = {};
    markSeen(rUlt, freeShown, 5);
    expect(freeShown['r5']).toBeUndefined();
  });

  test('does not exceed freePerCat cap', () => {
    const freeShown = { r0: 5 };
    markSeen(rFree, freeShown, 5);
    expect(freeShown['r0']).toBe(5); // capped, not 6
  });

  test('accumulates correctly across multiple calls', () => {
    const freeShown = {};
    markSeen(rFree, freeShown, 5);
    markSeen(rFree, freeShown, 5);
    markSeen(rFree, freeShown, 5);
    expect(freeShown['r0']).toBe(3);
  });

  test('separate keys per category', () => {
    const freeShown = {};
    const cat1Free = { t: 'r', c: 1, f: 1 };
    markSeen(rFree, freeShown, 5);
    markSeen(cat1Free, freeShown, 5);
    expect(freeShown['r0']).toBe(1);
    expect(freeShown['r1']).toBe(1);
  });

  test('stops incrementing once card becomes locked', () => {
    const freeShown = { r0: 4 };
    // One more mark brings it to 5 (cap), card is now locked for future calls
    markSeen(rFree, freeShown, 5);
    expect(freeShown['r0']).toBe(5);
    // Now rFree itself is NOT locked (f:1 is never locked), but calling again should still cap
    markSeen(rFree, freeShown, 5);
    expect(freeShown['r0']).toBe(5);
  });
});

// ─── buildDeck ───────────────────────────────────────────────────────────────

describe('buildDeck', () => {
  test('tf mode returns all TF cards', () => {
    const deck = buildDeck('tf', 'all', SAMPLE_DATA);
    expect(deck).toHaveLength(SAMPLE_DATA.TF.length);
    deck.forEach(c => expect(c.t).toBe('tf'));
  });

  test('wml mode returns all WML cards', () => {
    const deck = buildDeck('wml', 'all', SAMPLE_DATA);
    expect(deck).toHaveLength(SAMPLE_DATA.WML.length);
    deck.forEach(c => expect(c.t).toBe('wml'));
  });

  test('wyr mode returns all WYR cards', () => {
    const deck = buildDeck('wyr', 'all', SAMPLE_DATA);
    expect(deck).toHaveLength(SAMPLE_DATA.WYR.length);
    deck.forEach(c => expect(c.t).toBe('wyr'));
  });

  test('rage all mode returns all RC cards (members version — no exclusion)', () => {
    const deck = buildDeck('rage', 'all', SAMPLE_DATA);
    expect(deck).toHaveLength(SAMPLE_DATA.RC.length);
  });

  test('rage all mode with excludeUltimate excludes cat-5 cards', () => {
    const deck = buildDeck('rage', 'all', SAMPLE_DATA, { excludeUltimate: true });
    expect(deck.every(c => c.c !== 5)).toBe(true);
    expect(deck).toHaveLength(SAMPLE_DATA.RC.filter(c => c.c !== 5).length);
  });

  test('rage specific category filters correctly', () => {
    const deck = buildDeck('rage', '1', SAMPLE_DATA);
    expect(deck.every(c => c.c === 1)).toBe(true);
    expect(deck).toHaveLength(SAMPLE_DATA.RC.filter(c => c.c === 1).length);
  });

  test('free cards (f===1) always appear before paid cards (f===0)', () => {
    const deck = buildDeck('wyr', 'all', SAMPLE_DATA);
    const firstPaidIdx = deck.findIndex(c => !c.f);
    const lastFreeIdx  = deck.map(c => c.f === 1).lastIndexOf(true);
    if (firstPaidIdx !== -1 && lastFreeIdx !== -1) {
      expect(lastFreeIdx).toBeLessThan(firstPaidIdx);
    }
  });

  test('deck contains all expected cards (no duplicates, no missing)', () => {
    const deck = buildDeck('rage', '0', SAMPLE_DATA);
    const expected = SAMPLE_DATA.RC.filter(c => c.c === 0);
    expect(deck).toHaveLength(expected.length);
    expected.forEach(card => {
      expect(deck.filter(c => c.q === card.q)).toHaveLength(1);
    });
  });

  test('does not mutate the source card arrays', () => {
    const before = JSON.stringify(SAMPLE_DATA);
    buildDeck('rage', 'all', SAMPLE_DATA, { excludeUltimate: true });
    expect(JSON.stringify(SAMPLE_DATA)).toBe(before);
  });

  test('returns empty array when no cards match filter', () => {
    const deck = buildDeck('rage', '99', SAMPLE_DATA);
    expect(deck).toEqual([]);
  });

  test('deck with only free cards has all free cards first', () => {
    const data = {
      RC: [], TF: [], WML: [],
      WYR: [
        { t: 'wyr', a: 'A', b: 'B', s: '', f: 1 },
        { t: 'wyr', a: 'C', b: 'D', s: '', f: 1 },
        { t: 'wyr', a: 'E', b: 'F', s: '', f: 0 },
        { t: 'wyr', a: 'G', b: 'H', s: '', f: 0 },
        { t: 'wyr', a: 'I', b: 'J', s: '', f: 0 },
      ]
    };
    const deck = buildDeck('wyr', 'all', data);
    expect(deck[0].f).toBe(1);
    expect(deck[1].f).toBe(1);
    expect(deck[2].f).toBeFalsy();
    expect(deck[3].f).toBeFalsy();
    expect(deck[4].f).toBeFalsy();
  });
});
