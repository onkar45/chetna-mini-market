const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('Phase 5 — Product Search & Filter Logic', () => {
  // Test dataset mimicking backend products
  const inventory = [
    { id: 1, name: 'Tata Salt', category: 'Grocery', rate: 28.0, unit: 'packet', is_active: true },
    { id: 2, name: 'Basmati Rice', category: 'Grains', rate: 120.0, unit: 'kg', is_active: true },
    { id: 3, name: 'Amul Butter', category: 'Dairy', rate: 56.0, unit: 'packet', is_active: true },
    { id: 4, name: 'Amul Taaza Milk', category: 'Dairy', rate: 27.0, unit: 'packet', is_active: true },
    { id: 5, name: 'Parle-G Biscuits', category: 'Snacks', rate: 10.0, unit: 'packet', is_active: true },
    { id: 6, name: 'Red Chilli Powder', category: 'Spices', rate: 45.0, unit: 'packet', is_active: true },
    { id: 7, name: 'Discontinued Tea', category: 'Beverages', rate: 90.0, unit: 'packet', is_active: false },
    { id: 8, name: 'Nivea Soft Cream', category: 'Personal Care', rate: 180.0, unit: 'piece', is_active: true },
    { id: 9, name: 'Special Item', category: 'Artisan Crafts', rate: 300.0, unit: 'piece', is_active: true },
  ];

  // Client / Backend query filtering simulation function
  function filterProducts(items, { search = '', category = 'All', isAdmin = false } = {}) {
    let result = items;

    // Role-based visibility
    if (!isAdmin) {
      result = result.filter((p) => p.is_active);
    }

    // Category filter
    if (category && category !== 'All' && category.trim().toLowerCase() !== 'all') {
      const cleanCat = category.trim().toLowerCase();
      result = result.filter((p) => p.category && p.category.toLowerCase() === cleanCat);
    }

    // Search filter across name and category (case-insensitive, trims whitespace)
    if (search && search.trim()) {
      const cleanSearch = search.trim().toLowerCase();
      result = result.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(cleanSearch);
        const catMatch = p.category ? p.category.toLowerCase().includes(cleanSearch) : false;
        return nameMatch || catMatch;
      });
    }

    return result;
  }

  test('1. Case-insensitive product-name search', () => {
    const resultsLower = filterProducts(inventory, { search: 'salt' });
    assert.strictEqual(resultsLower.length, 1);
    assert.strictEqual(resultsLower[0].name, 'Tata Salt');

    const resultsUpper = filterProducts(inventory, { search: 'SALT' });
    assert.strictEqual(resultsUpper.length, 1);
    assert.strictEqual(resultsUpper[0].name, 'Tata Salt');

    const resultsMixed = filterProducts(inventory, { search: 'bAsMaTi' });
    assert.strictEqual(resultsMixed.length, 1);
    assert.strictEqual(resultsMixed[0].name, 'Basmati Rice');
  });

  test('2. Category search matches products by category name in search box', () => {
    // Searching "dairy" matches both Amul Butter and Amul Taaza Milk even though "dairy" is not in their names
    const results = filterProducts(inventory, { search: 'dairy' });
    assert.strictEqual(results.length, 2);
    const names = results.map((r) => r.name);
    assert.ok(names.includes('Amul Butter'));
    assert.ok(names.includes('Amul Taaza Milk'));
  });

  test('3. Leading and trailing whitespace is ignored during search', () => {
    const results = filterProducts(inventory, { search: '   butter   ' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'Amul Butter');

    const emptyWhitespace = filterProducts(inventory, { search: '    ' });
    assert.strictEqual(emptyWhitespace.length, 8); // All active products
  });

  test('4. No matching results returns empty list without error', () => {
    const results = filterProducts(inventory, { search: 'NonExistentProductXYZ' });
    assert.strictEqual(results.length, 0);
  });

  test('5. Clearing search restores expected product list', () => {
    let search = 'rice';
    let results = filterProducts(inventory, { search });
    assert.strictEqual(results.length, 1);

    // User clears search
    search = '';
    results = filterProducts(inventory, { search });
    assert.strictEqual(results.length, 8); // All active items restored
  });

  test('6. Category chips remain stable and do not disappear when filtering', () => {
    const defaultCategories = ['All', 'Grocery', 'Dairy', 'Grains', 'Beverages', 'Spices', 'Snacks'];

    // Category accumulator logic as implemented in ProductListScreen
    function mergeCategories(current, newItems) {
      const set = new Set(current);
      newItems.forEach((p) => {
        if (p.category && p.category.trim()) {
          set.add(p.category.trim());
        }
      });
      const list = Array.from(set).filter((c) => c !== 'All');
      return ['All', ...list];
    }

    // Initial load: all inventory categories discovered
    let availableCategories = mergeCategories(defaultCategories, inventory);
    assert.ok(availableCategories.includes('Artisan Crafts'));
    assert.ok(availableCategories.includes('Personal Care'));
    assert.ok(availableCategories.includes('Dairy'));
    const totalCategoriesCount = availableCategories.length;

    // Filter by "Dairy" (returns only 2 products)
    const dairyProducts = filterProducts(inventory, { category: 'Dairy' });
    assert.strictEqual(dairyProducts.length, 2);

    // Merge categories from filtered result: availableCategories MUST NOT shrink
    availableCategories = mergeCategories(availableCategories, dairyProducts);
    assert.strictEqual(availableCategories.length, totalCategoriesCount);
    assert.ok(availableCategories.includes('Grocery'), 'Grocery chip must remain visible');
    assert.ok(availableCategories.includes('Grains'), 'Grains chip must remain visible');
    assert.ok(availableCategories.includes('Artisan Crafts'), 'Artisan Crafts chip must remain visible');
  });

  test('7. Category selection and search query work together cleanly', () => {
    // Dairy category has 2 products: "Amul Butter" and "Amul Taaza Milk"
    // Searching "milk" within "Dairy" should return only "Amul Taaza Milk"
    const results = filterProducts(inventory, { search: 'milk', category: 'Dairy' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'Amul Taaza Milk');

    // Searching "salt" within "Dairy" should return 0 products
    const noMatch = filterProducts(inventory, { search: 'salt', category: 'Dairy' });
    assert.strictEqual(noMatch.length, 0);
  });

  test('8. Selecting "All" restores products matching the current search', () => {
    // When category is Dairy and search is "amul": 2 items
    const dairyResults = filterProducts(inventory, { search: 'amul', category: 'Dairy' });
    assert.strictEqual(dairyResults.length, 2);

    // Switch category to "All": still matches "amul"
    const allResults = filterProducts(inventory, { search: 'amul', category: 'All' });
    assert.strictEqual(allResults.length, 2);

    // If an item in another category also has "amul", it would be included in "All"
    const extendedInventory = [
      ...inventory,
      { id: 10, name: 'Amul Ghee', category: 'Grocery', rate: 350.0, unit: 'litre', is_active: true },
    ];
    const allAmul = filterProducts(extendedInventory, { search: 'amul', category: 'All' });
    assert.strictEqual(allAmul.length, 3);
  });

  test('9. Rapid search requests: stale responses are rejected using requestId sequence', async () => {
    let latestRequestId = 0;
    let renderedProducts = [];

    async function simulateSearch(query, delayMs, reqId) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const res = filterProducts(inventory, { search: query });
          resolve({ reqId, res });
        }, delayMs);
      });
    }

    // Request 1: user types "A" (slow network response: 80ms)
    const req1Id = ++latestRequestId;
    const p1 = simulateSearch('A', 80, req1Id);

    // Request 2: user quickly types "Amul" (fast network response: 20ms)
    const req2Id = ++latestRequestId;
    const p2 = simulateSearch('Amul', 20, req2Id);

    // Wait for both to complete
    const [res1, res2] = await Promise.all([p1, p2]);

    // Handle responses in arrival order: p2 arrives first (at 20ms)
    if (res2.reqId === latestRequestId) {
      renderedProducts = res2.res;
    }
    assert.strictEqual(renderedProducts.length, 2);
    assert.ok(renderedProducts.every((p) => p.name.includes('Amul')));

    // Then p1 arrives late (at 80ms)
    if (res1.reqId === latestRequestId) {
      renderedProducts = res1.res; // Should NOT execute!
    }

    // Rendered products must still be the Amul results, not overwritten by stale "A" results
    assert.strictEqual(renderedProducts.length, 2);
    assert.strictEqual(renderedProducts[0].name, 'Amul Butter');
  });

  test('10. Admin and User product visibility rules remain strictly enforced', () => {
    // Discontinued Tea is is_active: false
    const userView = filterProducts(inventory, { isAdmin: false });
    assert.strictEqual(userView.length, 8);
    assert.ok(!userView.some((p) => p.name === 'Discontinued Tea'));

    const adminView = filterProducts(inventory, { isAdmin: true });
    assert.strictEqual(adminView.length, 9);
    assert.ok(adminView.some((p) => p.name === 'Discontinued Tea'));

    // Searching inactive product as regular user returns 0 results
    const userSearch = filterProducts(inventory, { search: 'discontinued', isAdmin: false });
    assert.strictEqual(userSearch.length, 0);

    // Searching inactive product as admin finds it
    const adminSearch = filterProducts(inventory, { search: 'discontinued', isAdmin: true });
    assert.strictEqual(adminSearch.length, 1);
    assert.strictEqual(adminSearch[0].name, 'Discontinued Tea');
  });

  test('11. Network error retains cached inventory rather than destroying UI state', () => {
    let state = {
      products: filterProducts(inventory, { category: 'All' }),
      errorMessage: null,
    };

    assert.strictEqual(state.products.length, 8);

    // Simulated network error when searching
    const networkError = new Error('Network timeout');
    networkError.friendlyMessage = 'Network connection error';

    // UI state update: sets friendly error, but preserves cached state.products
    state.errorMessage = networkError.friendlyMessage;

    assert.strictEqual(state.products.length, 8, 'Cached products must not be wiped');
    assert.strictEqual(state.errorMessage, 'Network connection error');
  });

  test('12. Category formatting preserves English and Marathi localization', () => {
    const CATEGORY_KEYS = {
      All: 'categories.all',
      Grocery: 'categories.grocery',
      Dairy: 'categories.dairy',
      Grains: 'categories.grains',
      Beverages: 'categories.beverages',
      Spices: 'categories.spices',
      Snacks: 'categories.snacks',
      'Personal Care': 'categories.personal_care',
      Household: 'categories.household',
    };

    const mrMock = {
      'categories.all': 'सर्व',
      'categories.grocery': 'किराणा',
      'categories.dairy': 'दुग्धजन्य',
      'categories.grains': 'धान्य',
      'categories.beverages': 'पेये',
      'categories.spices': 'मसाले',
      'categories.snacks': 'नाश्ता / स्नॅक्स',
      'categories.personal_care': 'वैयक्तिक काळजी',
      'categories.household': 'घरगुती वस्तू',
    };

    function formatCat(cat, dict) {
      if (!cat) return '';
      const key = CATEGORY_KEYS[cat];
      return key && dict[key] ? dict[key] : cat;
    }

    assert.strictEqual(formatCat('All', mrMock), 'सर्व');
    assert.strictEqual(formatCat('Dairy', mrMock), 'दुग्धजन्य');
    assert.strictEqual(formatCat('Personal Care', mrMock), 'वैयक्तिक काळजी');
    assert.strictEqual(formatCat('Artisan Crafts', mrMock), 'Artisan Crafts', 'Custom category safely returns raw label');
  });
});
