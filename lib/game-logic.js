/**
 * Pure game logic — no DOM, no global state.
 * Works in both browser (sets window.GameLogic) and Node.js (module.exports).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.GameLogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /**
   * Fisher-Yates shuffle. Returns a new array; does not mutate the input.
   * @param {Array} a
   * @returns {Array}
   */
  function shuf(a) {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = 0 | Math.random() * (i + 1);
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  /**
   * Returns a stable category key for tracking free-card views per category.
   * Rage cards use 'r<cat>', all others use the card type string.
   * @param {{ t: string, c?: number }} card
   * @returns {string}
   */
  function catKey(card) {
    if (card.t === 'r') return 'r' + card.c;
    return card.t;
  }

  /**
   * Returns true if the card should be shown in locked state.
   * @param {{ lk?: boolean, f?: number }} card
   * @param {Object} freeShown  - mutable map of key -> count
   * @param {number} freePerCat - max free cards shown before locking
   * @returns {boolean}
   */
  function isLocked(card, freeShown, freePerCat) {
    if (card.lk) return true;        // always locked (Ultimate Rage in free version)
    if (card.f) return false;        // explicitly free
    const key = catKey(card);
    return (freeShown[key] || 0) >= freePerCat;
  }

  /**
   * Increments the free-card view counter for a card's category.
   * Mutates freeShown in place.
   * @param {{ f?: number }} card
   * @param {Object} freeShown
   * @param {number} freePerCat
   */
  function markSeen(card, freeShown, freePerCat) {
    if (card.f && !isLocked(card, freeShown, freePerCat)) {
      const key = catKey(card);
      freeShown[key] = Math.min((freeShown[key] || 0) + 1, freePerCat);
    }
  }

  /**
   * Builds the game deck for a given mode and category.
   * Free cards (f===1) always come before paid cards; each group is shuffled.
   *
   * @param {string} mode - 'rage' | 'tf' | 'wml' | 'wyr'
   * @param {string|'all'} cat - category id string or 'all'
   * @param {{ RC: Array, TF: Array, WML: Array, WYR: Array }} data - card arrays
   * @param {{ excludeUltimate?: boolean }} [opts]
   *   excludeUltimate: when true, cat-5 (Ultimate Rage) cards are excluded from 'all' mode
   * @returns {Array}
   */
  function buildDeck(mode, cat, data, opts) {
    const { RC, TF, WML, WYR } = data;
    const excludeUltimate = (opts && opts.excludeUltimate) || false;
    let src;

    if (mode === 'rage') {
      if (cat === 'all') {
        src = excludeUltimate ? RC.filter(c => c.c !== 5) : [...RC];
      } else {
        src = RC.filter(c => String(c.c) === String(cat));
      }
    } else if (mode === 'tf') {
      src = [...TF];
    } else if (mode === 'wml') {
      src = [...WML];
    } else {
      src = [...WYR];
    }

    const free = src.filter(c => c.f === 1);
    const paid = src.filter(c => !c.f);
    return [...shuf(free), ...shuf(paid)];
  }

  return { shuf, catKey, isLocked, markSeen, buildDeck };
});
