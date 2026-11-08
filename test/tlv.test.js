'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  encodeField,
  encodeFields,
  decodeFields,
} = require('../dist/cjs/tlv.js');

describe('tlv', () => {
  it('encodes and decodes a simple field', () => {
    assert.equal(encodeField('59', 'Warung Kopi'), '5911Warung Kopi');
    assert.deepEqual(decodeFields('5911Warung Kopi'), [
      { tag: '59', value: 'Warung Kopi' },
    ]);
  });

  it('counts UTF-8 bytes, not characters, for the length', () => {
    // 'É' is 2 bytes: 'Warung É' is 8 chars but 9 bytes.
    assert.equal(encodeField('59', 'Warung É'), '5909Warung É');
    assert.deepEqual(decodeFields('5909Warung É'), [
      { tag: '59', value: 'Warung É' },
    ]);
  });

  it('round-trips a nested template', () => {
    const inner = encodeFields([
      { tag: '00', value: 'ID.DANA.WWW' },
      { tag: '02', value: 'ID123' },
    ]);
    const outer = encodeField('26', inner);
    const [field] = decodeFields(outer);
    assert.equal(field.tag, '26');
    assert.deepEqual(decodeFields(field.value), [
      { tag: '00', value: 'ID.DANA.WWW' },
      { tag: '02', value: 'ID123' },
    ]);
  });

  it('rejects values longer than 99 bytes', () => {
    assert.throws(() => encodeField('59', 'x'.repeat(100)), /99/);
  });

  it('rejects a truncated stream', () => {
    assert.throws(
      () => decodeFields('5911Warung'),
      (err) => err.code === 'TRUNCATED' || err.code === 'BAD_LENGTH',
    );
  });

  it('rejects a length that runs past the end', () => {
    assert.throws(
      () => decodeFields('5999abc'),
      (err) => err.code === 'BAD_LENGTH',
    );
  });

  it('rejects a non-numeric tag', () => {
    assert.throws(
      () => decodeFields('XX02ab'),
      (err) => err.code === 'INVALID_TAG',
    );
  });
});
