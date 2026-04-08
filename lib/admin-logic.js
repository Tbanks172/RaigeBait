/**
 * Pure admin logic — no DOM, no global state.
 * Works in both browser (sets window.AdminLogic) and Node.js (module.exports).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.AdminLogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /**
   * Escapes HTML special characters for safe insertion into attribute values and text nodes.
   * Handles & first to avoid double-escaping.
   * @param {string} str
   * @returns {string}
   */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Parses bulk-import text lines into card objects.
   * Lines are pipe-delimited. Lines starting with '#' or blank are already filtered out by the caller.
   *
   * Rage / TF / WML format:  question | punchline [| level (TF only)]
   * WYR format:              option A | option B | punchline
   *
   * @param {string[]} lines     - trimmed, non-empty, non-comment lines
   * @param {string}   catMode   - 'rage' | 'tf' | 'wml' | 'wyr'
   * @param {number|string} catId - numeric category id (for rage cards)
   * @param {boolean}  isFree    - whether to mark cards as free preview
   * @returns {{ added: Object[], skipped: number }}
   */
  function parseBulkLines(lines, catMode, catId, isFree) {
    const added = [];
    let skipped = 0;

    lines.forEach(function (line) {
      const parts = line.split('|').map(function (p) { return p.trim(); });

      if (catMode === 'wyr') {
        if (parts.length < 2 || !parts[0] || !parts[1]) { skipped++; return; }
        added.push({
          id: Date.now() + Math.random(),
          type: 'wyr',
          a: parts[0],
          b: parts[1],
          s: parts[2] || '',
          free: isFree
        });

      } else if (catMode === 'tf') {
        if (!parts[0]) { skipped++; return; }
        added.push({
          id: Date.now() + Math.random(),
          type: 'tf',
          lv: parts[2] || 'LEVEL 1 — WARM UP 😏',
          q: parts[0],
          s: parts[1] || '',
          free: isFree
        });

      } else if (catMode === 'wml') {
        if (!parts[0]) { skipped++; return; }
        added.push({
          id: Date.now() + Math.random(),
          type: 'wml',
          q: parts[0],
          s: parts[1] || '',
          free: isFree
        });

      } else {
        // rage bait
        if (!parts[0]) { skipped++; return; }
        const isUltimate = parseInt(catId) === 5;
        added.push({
          id: Date.now() + Math.random(),
          type: 'rage',
          cat: parseInt(catId),
          q: parts[0],
          s: parts[1] || '',
          free: isUltimate ? false : isFree,
          locked: isUltimate ? true : false
        });
      }
    });

    return { added, skipped };
  }

  /**
   * Builds JavaScript array literal strings for each card type, ready to embed in the exported app HTML.
   * In 'free' export: honours individual card.free flags; 'members' export sets all f:1.
   *
   * @param {Object[]} cards - full card array from localStorage
   * @param {'free'|'members'} type
   * @returns {{ rcJS: string, tfJS: string, wmlJS: string, wyrJS: string }}
   */
  function buildCardArrayStrings(cards, type) {
    const isFree = type === 'free';

    const rageCards = cards.filter(function (c) { return c.type === 'rage'; });
    const tfCards   = cards.filter(function (c) { return c.type === 'tf'; });
    const wmlCards  = cards.filter(function (c) { return c.type === 'wml'; });
    const wyrCards  = cards.filter(function (c) { return c.type === 'wyr'; });

    const rcJS = rageCards.map(function (c) {
      const fVal = isFree ? (c.free ? 1 : 0) : 1;
      const lkPart = (c.locked && isFree) ? ',lk:1' : '';
      return '{t:"r",c:' + c.cat + ',q:' + JSON.stringify(c.q) + ',s:' + JSON.stringify(c.s || '') + ',f:' + fVal + lkPart + '}';
    }).join(',\n  ');

    const tfJS = tfCards.map(function (c) {
      const fVal = isFree ? (c.free ? 1 : 0) : 1;
      return '{t:"tf",lv:' + JSON.stringify(c.lv || 'LEVEL 1 — WARM UP 😏') + ',q:' + JSON.stringify(c.q) + ',s:' + JSON.stringify(c.s || '') + ',f:' + fVal + '}';
    }).join(',\n  ');

    const wmlJS = wmlCards.map(function (c) {
      const fVal = isFree ? (c.free ? 1 : 0) : 1;
      return '{t:"wml",q:' + JSON.stringify(c.q) + ',s:' + JSON.stringify(c.s || '') + ',f:' + fVal + '}';
    }).join(',\n  ');

    const wyrJS = wyrCards.map(function (c) {
      const fVal = isFree ? (c.free ? 1 : 0) : 1;
      return '{t:"wyr",a:' + JSON.stringify(c.a) + ',b:' + JSON.stringify(c.b) + ',s:' + JSON.stringify(c.s || '') + ',f:' + fVal + '}';
    }).join(',\n  ');

    return { rcJS, tfJS, wmlJS, wyrJS };
  }

  return { esc, parseBulkLines, buildCardArrayStrings };
});
