'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parse, build, toDynamic, QrisError } = require('../dist/cjs/index.js');
const { V1_FULUNG_STORE, V2_VFS_GLOBAL } = require('./vectors.js');

describe('toDynamic', () => {
  it('converts V1 to a dynamic payload with the amount', () => {
    const dynamic = toDynamic(V1_FULUNG_STORE, { amount: 50000 });
    const parsed = parse(dynamic);
    assert.equal(parsed.pointOfInitiation, 'dynamic');
    assert.equal(parsed.amount, '50000');
    assert.equal(parsed.amountValue, 50000);
    assert.equal(parsed.merchantName, 'Fulung Store');
    assert.equal(parsed.merchantCity, 'Kota Palembang');
    assert.equal(parsed.merchantCategoryCode, '4814');
    assert.equal(parsed.accounts[0].gui, 'ID.DANA.WWW');
    assert.equal(parsed.crcValid, true);
  });

  it('keeps a decimal amount as written', () => {
    const parsed = parse(toDynamic(V1_FULUNG_STORE, { amount: '75000.50' }));
    assert.equal(parsed.amount, '75000.50');
  });

  it('stores a reference label in additional data', () => {
    const parsed = parse(
      toDynamic(V1_FULUNG_STORE, { amount: 120000, reference: 'INV-1001' }),
    );
    assert.equal(parsed.additionalData.referenceLabel, 'INV-1001');
  });

  it('supports a fixed fee', () => {
    const parsed = parse(
      toDynamic(V1_FULUNG_STORE, {
        amount: 50000,
        fee: { type: 'fixed', value: 2000 },
      }),
    );
    assert.equal(parsed.tipIndicator, '01');
    assert.equal(parsed.tipFixed, '2000');
  });

  it('supports a percentage fee', () => {
    const parsed = parse(
      toDynamic(V1_FULUNG_STORE, {
        amount: 50000,
        fee: { type: 'percent', value: 2 },
      }),
    );
    assert.equal(parsed.tipIndicator, '02');
    assert.equal(parsed.tipPercent, '2');
  });

  it('carries unknown tags over to the dynamic payload', () => {
    const withExtra = build({
      accounts: [{ gui: 'ID.CO.QRIS.WWW', merchantId: 'ID1020000000001' }],
      merchantCategoryCode: '5411',
      merchantName: 'Warung Kopi',
      merchantCity: 'Batam',
      extraTags: [{ tag: '80', value: 'TEST' }],
    });
    const parsed = parse(toDynamic(withExtra, { amount: 10000 }));
    assert.deepEqual(parsed.unknownTags, [{ tag: '80', value: 'TEST' }]);
  });

  it('refuses a payload that is already dynamic', () => {
    const dynamic = toDynamic(V2_VFS_GLOBAL, { amount: 10000 });
    assert.throws(
      () => toDynamic(dynamic, { amount: 20000 }),
      (err) => {
        assert.ok(err instanceof QrisError);
        assert.equal(err.code, 'NOT_STATIC');
        return true;
      },
    );
  });
});
