const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const enPath = path.resolve(__dirname, '../locales/en.json');
const mrPath = path.resolve(__dirname, '../locales/mr.json');

describe('Localization & Translation Dictionary Integrity', () => {
  test('both en.json and mr.json are valid JSON files', () => {
    assert.doesNotThrow(() => {
      JSON.parse(fs.readFileSync(enPath, 'utf8'));
    }, 'en.json should be valid JSON');

    assert.doesNotThrow(() => {
      JSON.parse(fs.readFileSync(mrPath, 'utf8'));
    }, 'mr.json should be valid JSON');
  });

  function extractKeys(obj, prefix = '') {
    let keys = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        keys = keys.concat(extractKeys(value, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  function getNestedValue(obj, keyPath) {
    return keyPath.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
  }

  function extractPlaceholders(str) {
    if (typeof str !== 'string') return [];
    const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.sort();
  }

  test('both dictionaries have identical key structures (100% key parity)', () => {
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const mr = JSON.parse(fs.readFileSync(mrPath, 'utf8'));

    const enKeys = extractKeys(en);
    const mrKeys = extractKeys(mr);

    const missingInMr = enKeys.filter((k) => !mrKeys.includes(k));
    const missingInEn = mrKeys.filter((k) => !enKeys.includes(k));

    assert.strictEqual(
      missingInMr.length,
      0,
      `Keys present in en.json but missing in mr.json: ${missingInMr.join(', ')}`
    );
    assert.strictEqual(
      missingInEn.length,
      0,
      `Keys present in mr.json but missing in en.json: ${missingInEn.join(', ')}`
    );
    assert.strictEqual(enKeys.length, mrKeys.length, 'Total key counts should be equal');
  });

  test('no duplicate keys exist at any nesting level', () => {
    function checkDuplicates(rawText, filename) {
      let depth = 0;
      let inString = false;
      const seenAtDepth = [new Set()];
      const dups = [];

      for (let i = 0; i < rawText.length; i++) {
        const ch = rawText[i];
        if (ch === '{' && !inString) {
          depth++;
          seenAtDepth[depth] = new Set();
        } else if (ch === '}' && !inString) {
          depth--;
        } else if (ch === '"' && rawText[i - 1] !== '\\') {
          inString = !inString;
          if (inString) {
            let start = i + 1;
            let end = start;
            while (end < rawText.length && (rawText[end] !== '"' || rawText[end - 1] === '\\')) {
              end++;
            }
            const key = rawText.substring(start, end);
            let after = end + 1;
            while (after < rawText.length && /\s/.test(rawText[after])) after++;
            if (rawText[after] === ':') {
              if (seenAtDepth[depth].has(key)) {
                dups.push({ depth, key, filename });
              } else {
                seenAtDepth[depth].add(key);
              }
            }
            i = end;
            inString = false;
          }
        }
      }
      return dups;
    }

    const enDups = checkDuplicates(fs.readFileSync(enPath, 'utf8'), 'en.json');
    const mrDups = checkDuplicates(fs.readFileSync(mrPath, 'utf8'), 'mr.json');

    assert.strictEqual(enDups.length, 0, `Duplicate keys in en.json: ${JSON.stringify(enDups)}`);
    assert.strictEqual(mrDups.length, 0, `Duplicate keys in mr.json: ${JSON.stringify(mrDups)}`);
  });

  test('interpolation placeholders match exactly between English and Marathi translations', () => {
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const mr = JSON.parse(fs.readFileSync(mrPath, 'utf8'));
    const enKeys = extractKeys(en);

    const mismatches = [];

    for (const key of enKeys) {
      const enVal = getNestedValue(en, key);
      const mrVal = getNestedValue(mr, key);

      const enP = extractPlaceholders(enVal);
      const mrP = extractPlaceholders(mrVal);

      if (JSON.stringify(enP) !== JSON.stringify(mrP)) {
        mismatches.push({
          key,
          enPlaceholders: enP,
          mrPlaceholders: mrP,
        });
      }
    }

    assert.strictEqual(
      mismatches.length,
      0,
      `Interpolation mismatches found: ${JSON.stringify(mismatches, null, 2)}`
    );
  });

  test('all translated strings are non-empty and non-whitespace', () => {
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const mr = JSON.parse(fs.readFileSync(mrPath, 'utf8'));
    const enKeys = extractKeys(en);

    for (const key of enKeys) {
      const enVal = getNestedValue(en, key);
      const mrVal = getNestedValue(mr, key);

      assert.ok(
        typeof enVal === 'string' && enVal.trim().length > 0,
        `en.json key "${key}" must be non-empty`
      );
      assert.ok(
        typeof mrVal === 'string' && mrVal.trim().length > 0,
        `mr.json key "${key}" must be non-empty`
      );
    }
  });
});

describe('Localization Formatting and Helper Utilities', () => {
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const mr = JSON.parse(fs.readFileSync(mrPath, 'utf8'));

  function createMockTranslator(localeDict) {
    return (key, params) => {
      const parts = key.split('.');
      let val = localeDict;
      for (const p of parts) {
        val = val ? val[p] : undefined;
      }
      if (typeof val !== 'string') return key;
      if (params) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
          val
        );
      }
      return val;
    };
  }

  const CATEGORY_KEYS = {
    All: 'categories.all',
    Grocery: 'categories.grocery',
    Dairy: 'categories.dairy',
    Grains: 'categories.grains',
    Beverages: 'categories.beverages',
    Spices: 'categories.spices',
    Snacks: 'categories.snacks',
  };

  function formatCategory(category, t) {
    if (!category) return '';
    const key = CATEGORY_KEYS[category];
    return key ? t(key) : category;
  }

  const UNIT_KEYS = {
    kg: 'units.kg',
    gram: 'units.gram',
    litre: 'units.litre',
    ml: 'units.ml',
    packet: 'units.packet',
    piece: 'units.piece',
  };

  function formatUnit(unit, t) {
    if (!unit) return '';
    const key = UNIT_KEYS[unit];
    return key ? t(key) : unit;
  }

  test('formats categories correctly in English and Marathi', () => {
    const tEn = createMockTranslator(en);
    const tMr = createMockTranslator(mr);

    assert.strictEqual(formatCategory('All', tEn), 'All');
    assert.strictEqual(formatCategory('All', tMr), 'सर्व');

    assert.strictEqual(formatCategory('Grocery', tEn), 'Grocery');
    assert.strictEqual(formatCategory('Grocery', tMr), 'किराणा');

    assert.strictEqual(formatCategory('Dairy', tEn), 'Dairy');
    assert.strictEqual(formatCategory('Dairy', tMr), 'दुग्धजन्य');

    assert.strictEqual(formatCategory('Beverages', tEn), 'Beverages');
    assert.strictEqual(formatCategory('Beverages', tMr), 'पेये');

    assert.strictEqual(formatCategory('CustomCategory', tEn), 'CustomCategory');
    assert.strictEqual(formatCategory('CustomCategory', tMr), 'CustomCategory');
  });

  test('formats units correctly in English and Marathi', () => {
    const tEn = createMockTranslator(en);
    const tMr = createMockTranslator(mr);

    assert.strictEqual(formatUnit('kg', tEn), 'kg');
    assert.strictEqual(formatUnit('kg', tMr), 'किलो');

    assert.strictEqual(formatUnit('gram', tEn), 'gram');
    assert.strictEqual(formatUnit('gram', tMr), 'ग्रॅम');

    assert.strictEqual(formatUnit('litre', tEn), 'litre');
    assert.strictEqual(formatUnit('litre', tMr), 'लिटर');

    assert.strictEqual(formatUnit('packet', tEn), 'packet');
    assert.strictEqual(formatUnit('packet', tMr), 'पाकीट');

    assert.strictEqual(formatUnit('box', tEn), 'box');
    assert.strictEqual(formatUnit('box', tMr), 'box');
  });

  test('supports variable interpolation for user and delete confirmations', () => {
    const tEn = createMockTranslator(en);
    const tMr = createMockTranslator(mr);

    const enCreated = tEn('users.user_created_success', { username: 'john_doe' });
    const mrCreated = tMr('users.user_created_success', { username: 'john_doe' });

    assert.ok(enCreated.includes('john_doe'), 'En should contain username');
    assert.ok(mrCreated.includes('john_doe'), 'Mr should contain username');

    const enDelete = tEn('products.delete_confirm_message', { name: 'Basmati Rice' });
    const mrDelete = tMr('products.delete_confirm_message', { name: 'Basmati Rice' });

    assert.ok(enDelete.includes('Basmati Rice'), 'En should contain product name');
    assert.ok(mrDelete.includes('Basmati Rice'), 'Mr should contain product name');
  });
});
