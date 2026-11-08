'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validate, isQris, crc16 } = require('../dist/cjs/index.js');
const { V1_FULUNG_STORE, V2_VFS_GLOBAL } = require('./vectors.js');

/** Recompute the CRC after editing a payload body. */
function withNewCrc(body) {
  return `${body}6304${crc16(`${body}6304`)}`;
}

describe('validate', () => {
  it('accepts both real vectors', () => {
    for (const payload of [V1_FULUNG_STORE, V2_VFS_GLOBAL]) {
      const result = validate(payload);
      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
      assert.ok(result.payload);
    }
  });

  it('flags a bad CRC', () => {
    const tampered = V1_FULUNG_STORE.replace('Fulung', 'Xulung');
    const result = validate(tampered);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'BAD_CRC'));
  });

  it('flags a static payload carrying an amount', () => {
    // Insert tag 54 right after tag 53 in V1, CRC recomputed.
    const withAmount = withNewCrc(
      V1_FULUNG_STORE.slice(0, -8).replace('5802ID', '54061000005802ID'),
    );
    const result = validate(withAmount);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'STATIC_WITH_AMOUNT'));
  });

  it('flags a dynamic payload without an amount', () => {
    const dynamicNoAmount = withNewCrc(
      V1_FULUNG_STORE.slice(0, -8).replace('010211', '010212'),
    );
    const result = validate(dynamicNoAmount);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'DYNAMIC_WITHOUT_AMOUNT'));
  });

  it('collects several errors at once', () => {
    const body = V1_FULUNG_STORE.slice(0, -8)
      .replace('5303360', '5303840')
      .replace('5802ID', '5802SG');
    const result = validate(withNewCrc(body));
    assert.equal(result.valid, false);
    const codes = result.errors.map((e) => e.code);
    assert.ok(codes.includes('UNSUPPORTED_CURRENCY'));
    assert.ok(codes.includes('UNSUPPORTED_COUNTRY'));
  });

  it('rejects empty and truncated input without throwing', () => {
    assert.equal(validate('').valid, false);
    assert.equal(validate('').errors[0].code, 'INVALID_PAYLOAD');
    assert.equal(validate(V1_FULUNG_STORE.slice(0, 40)).valid, false);
  });
});

describe('isQris', () => {
  it('returns true for real payloads', () => {
    assert.equal(isQris(V1_FULUNG_STORE), true);
    assert.equal(isQris(V2_VFS_GLOBAL), true);
  });

  it('returns false for anything else, without throwing', () => {
    assert.equal(isQris('hello'), false);
    assert.equal(isQris(''), false);
    assert.equal(isQris(V1_FULUNG_STORE.replace('Fulung', 'Xulung')), false);
  });
});
