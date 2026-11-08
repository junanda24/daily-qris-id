'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parse, QrisError } = require('../dist/cjs/index.js');
const { V1_FULUNG_STORE, V2_VFS_GLOBAL } = require('./vectors.js');

describe('parse — real vector V1 (Fulung Store / DANA)', () => {
  const p = parse(V1_FULUNG_STORE);

  it('identifies a static payload', () => {
    assert.equal(p.pointOfInitiation, 'static');
    assert.equal(p.amount, undefined);
  });

  it('reads merchant identity', () => {
    assert.equal(p.merchantName, 'Fulung Store');
    assert.equal(p.merchantCity, 'Kota Palembang');
    assert.equal(p.postalCode, '30111');
    assert.equal(p.merchantCategoryCode, '4814');
    assert.equal(p.currency, '360');
    assert.equal(p.countryCode, 'ID');
  });

  it('reads both merchant accounts', () => {
    assert.equal(p.accounts.length, 2);
    const [dana, qris] = p.accounts;
    assert.equal(dana.tag, '26');
    assert.equal(dana.gui, 'ID.DANA.WWW');
    assert.equal(dana.provider, 'DANA');
    assert.equal(dana.pan, '936009153872583491');
    assert.equal(dana.merchantId, '872583491');
    assert.equal(dana.criteria, 'UMI');
    assert.equal(qris.tag, '51');
    assert.equal(qris.gui, 'ID.CO.QRIS.WWW');
    assert.equal(qris.provider, 'QRIS');
    assert.equal(qris.merchantId, 'ID1025390504849');
    assert.equal(qris.criteria, 'UMI');
    assert.equal(qris.pan, undefined);
  });

  it('validates the CRC', () => {
    assert.equal(p.crc, '7279');
    assert.equal(p.crcValid, true);
  });
});

describe('parse — real vector V2 (VFS Global / BNI)', () => {
  const p = parse(V2_VFS_GLOBAL);

  it('reads merchant identity and the BNI account', () => {
    assert.equal(p.pointOfInitiation, 'static');
    assert.equal(p.merchantName, 'VFS GLOBAL 6');
    assert.equal(p.merchantCity, 'JAKARTA SELATAN');
    assert.equal(p.postalCode, '12940');
    assert.equal(p.merchantCategoryCode, '4722');
    assert.equal(p.accounts[0].gui, 'ID.CO.BNI.WWW');
    assert.equal(p.accounts[0].provider, 'BNI');
    assert.equal(p.accounts[0].pan, '936000091503052565');
    assert.equal(p.accounts[0].merchantId, '610207079');
    assert.equal(p.accounts[0].criteria, 'UBE');
  });

  it('reads additional data (terminal label)', () => {
    assert.equal(p.additionalData.terminalLabel, 'A01');
  });

  it('validates the CRC', () => {
    assert.equal(p.crc, 'D7C5');
    assert.equal(p.crcValid, true);
  });
});

describe('parse — strict rejections', () => {
  it('throws BAD_CRC when one character changes', () => {
    // Change one letter inside a value: structure stays intact, CRC breaks.
    const tampered = V1_FULUNG_STORE.replace('Fulung', 'Xulung');
    assert.throws(
      () => parse(tampered),
      (err) => {
        assert.ok(err instanceof QrisError);
        assert.equal(err.code, 'BAD_CRC');
        return true;
      },
    );
  });

  it('throws on a truncated payload', () => {
    assert.throws(
      () => parse(V1_FULUNG_STORE.slice(0, -20)),
      (err) => {
        assert.ok(err instanceof QrisError);
        assert.ok(
          ['TRUNCATED', 'BAD_LENGTH', 'MISSING_FIELD'].includes(err.code),
        );
        return true;
      },
    );
  });

  it('throws on empty input', () => {
    assert.throws(
      () => parse(''),
      (err) => err.code === 'INVALID_PAYLOAD',
    );
  });

  it('throws when the payload format indicator is wrong', () => {
    const bad = `000202${V1_FULUNG_STORE.slice(6)}`;
    assert.throws(
      () => parse(bad),
      (err) => err.code === 'INVALID_PAYLOAD',
    );
  });

  it('throws when the currency is not IDR', () => {
    // 5303360 -> 5303840, CRC recomputed so only the currency rule trips.
    const { crc16 } = require('../dist/cjs/index.js');
    const body = V1_FULUNG_STORE.slice(0, -8).replace('5303360', '5303840');
    const tampered = `${body}6304${crc16(`${body}6304`)}`;
    assert.throws(
      () => parse(tampered),
      (err) => {
        assert.equal(err.code, 'UNSUPPORTED_CURRENCY');
        return true;
      },
    );
  });

  it('throws when the country is not ID', () => {
    const { crc16 } = require('../dist/cjs/index.js');
    const body = V1_FULUNG_STORE.slice(0, -8).replace('5802ID', '5802SG');
    const tampered = `${body}6304${crc16(`${body}6304`)}`;
    assert.throws(
      () => parse(tampered),
      (err) => {
        assert.equal(err.code, 'UNSUPPORTED_COUNTRY');
        return true;
      },
    );
  });
});
