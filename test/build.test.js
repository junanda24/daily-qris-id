'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parse, build, QrisError } = require('../dist/cjs/index.js');
const { V1_FULUNG_STORE, V2_VFS_GLOBAL } = require('./vectors.js');

function optionsFromParsed(p) {
  return {
    accounts: p.accounts.map((a) => ({
      tag: a.tag,
      gui: a.gui,
      pan: a.pan,
      merchantId: a.merchantId,
      criteria: a.criteria,
      extra: a.extra,
    })),
    merchantCategoryCode: p.merchantCategoryCode,
    merchantName: p.merchantName,
    merchantCity: p.merchantCity,
    postalCode: p.postalCode,
    additionalData: p.additionalData,
    extraTags: p.unknownTags,
  };
}

describe('build — round-trip with real vectors', () => {
  it('rebuilds V1 byte-identical', () => {
    assert.equal(
      build(optionsFromParsed(parse(V1_FULUNG_STORE))),
      V1_FULUNG_STORE,
    );
  });

  it('rebuilds V2 byte-identical', () => {
    assert.equal(build(optionsFromParsed(parse(V2_VFS_GLOBAL))), V2_VFS_GLOBAL);
  });
});

describe('build — static vs dynamic', () => {
  const base = {
    accounts: [{ gui: 'ID.CO.QRIS.WWW', merchantId: 'ID1020000000001' }],
    merchantCategoryCode: '5411',
    merchantName: 'Warung Kopi',
    merchantCity: 'Batam',
  };

  it('builds a static payload without an amount', () => {
    const payload = build(base);
    assert.ok(payload.startsWith('000201010211'));
    const parsed = parse(payload);
    assert.equal(parsed.pointOfInitiation, 'static');
    assert.equal(parsed.amount, undefined);
    assert.equal(parsed.accounts[0].tag, '26');
  });

  it('builds a dynamic payload with an amount', () => {
    const payload = build({ ...base, amount: 25000 });
    const parsed = parse(payload);
    assert.equal(parsed.pointOfInitiation, 'dynamic');
    assert.equal(parsed.amount, '25000');
    assert.equal(parsed.amountValue, 25000);
  });

  it('keeps a decimal amount as written', () => {
    const parsed = parse(build({ ...base, amount: '75000.50' }));
    assert.equal(parsed.amount, '75000.50');
    assert.equal(parsed.amountValue, 75000.5);
  });

  it('assigns tag 51 to the second account', () => {
    const payload = build({
      ...base,
      accounts: [
        { gui: 'ID.DANA.WWW', merchantId: 'ID1020000000001' },
        { gui: 'ID.CO.QRIS.WWW', merchantId: 'ID1020000000002' },
      ],
    });
    const parsed = parse(payload);
    assert.equal(parsed.accounts[0].tag, '26');
    assert.equal(parsed.accounts[1].tag, '51');
  });

  it('round-trips a merchant name with multi-byte characters', () => {
    const parsed = parse(
      build({ ...base, merchantName: 'Warung Énàk', merchantCity: 'Batam' }),
    );
    assert.equal(parsed.merchantName, 'Warung Énàk');
  });
});

describe('build — validation', () => {
  const base = {
    accounts: [{ gui: 'ID.CO.QRIS.WWW', merchantId: 'ID1020000000001' }],
    merchantCategoryCode: '5411',
    merchantName: 'Warung Kopi',
    merchantCity: 'Batam',
  };

  it('rejects a merchant name over 25 characters', () => {
    assert.throws(
      () =>
        build({ ...base, merchantName: 'Warung Kopi Nusantara Jaya Sekali' }),
      (err) => err instanceof QrisError && err.code === 'VALUE_TOO_LONG',
    );
  });

  it('rejects a city over 15 characters', () => {
    assert.throws(
      () => build({ ...base, merchantCity: 'Kota Palembang Jaya' }),
      (err) => err instanceof QrisError && err.code === 'VALUE_TOO_LONG',
    );
  });

  it('rejects a non-4-digit MCC', () => {
    assert.throws(
      () => build({ ...base, merchantCategoryCode: '48' }),
      (err) => err instanceof QrisError && err.code === 'INVALID_MCC',
    );
  });

  it('rejects zero, negative and over-precise amounts', () => {
    for (const amount of [0, -5000, '10.123', Number.NaN]) {
      assert.throws(
        () => build({ ...base, amount }),
        (err) => err instanceof QrisError && err.code === 'INVALID_AMOUNT',
        `amount ${amount} should be rejected`,
      );
    }
  });

  it('rejects an empty account list', () => {
    assert.throws(
      () => build({ ...base, accounts: [] }),
      (err) => err instanceof QrisError && err.code === 'MISSING_FIELD',
    );
  });

  it('rejects an extra tag outside 64–99', () => {
    assert.throws(
      () => build({ ...base, extraTags: [{ tag: '59', value: 'x' }] }),
      (err) => err instanceof QrisError && err.code === 'INVALID_TAG',
    );
  });
});
