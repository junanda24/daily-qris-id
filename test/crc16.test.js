'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { crc16 } = require('../dist/cjs/index.js');

describe('crc16', () => {
  it('returns the standard check value for "123456789"', () => {
    assert.equal(crc16('123456789'), '29B1');
  });

  it('returns FFFF for empty input', () => {
    assert.equal(crc16(''), 'FFFF');
  });

  it('matches the CRC embedded in the real V1 payload', () => {
    const { V1_FULUNG_STORE } = require('./vectors.js');
    // CRC covers the payload including the literal '6304' header.
    assert.equal(crc16(V1_FULUNG_STORE.slice(0, -4)), '7279');
  });

  it('matches the CRC embedded in the real V2 payload', () => {
    const { V2_VFS_GLOBAL } = require('./vectors.js');
    assert.equal(crc16(V2_VFS_GLOBAL.slice(0, -4)), 'D7C5');
  });

  it('returns 4 uppercase hex characters', () => {
    assert.match(crc16('warung kopi 123'), /^[0-9A-F]{4}$/);
  });
});
