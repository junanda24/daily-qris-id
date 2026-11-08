# Design — qris-id

## Stack

- **TypeScript 5** (strict), target ES2022. Dua `tsconfig` (CJS + ESM) →
  `dist/cjs` dan `dist/esm`. Tanpa bundler — library kecil, tsc cukup.
- **Zero runtime dependency.** `TextEncoder` untuk panjang byte UTF-8
  (jalan di Node ≥ 18 dan browser).
- **Test**: Node built-in `node:test` + `node:assert/strict`, tanpa framework.
  Test import dari `dist/cjs` (hasil build yang sebenarnya dikirim).
- **Lint**: ESLint 9 flat config (`@eslint/js` recommended) + Prettier
  (2-space, single quotes, semicolons, trailing commas). `npm run lint`.
- **CLI**: `bin/qris.js` (shebang node, tanpa dependensi, import dari
  `dist/cjs`).

## Struktur file

```
qris-id/
  package.json            # exports ESM+CJS, bin, scripts
  tsconfig.json           # base (strict, declaration)
  tsconfig.cjs.json       # module commonjs → dist/cjs
  tsconfig.esm.json       # module nodenext → dist/esm
  eslint.config.js        # flat config
  .prettierrc
  src/
    index.ts              # public API: re-export + QrisError
    types.ts              # semua interface & error codes
    errors.ts             # class QrisError { code }
    crc16.ts              # CRC-16/CCITT-FALSE (murni)
    tlv.ts                # encode/decode TLV + nested (murni)
    providers.ts          # map GUI terverifikasi → nama provider
    parse.ts              # parse(payload) strict
    build.ts              # build(options)
    validate.ts           # validate(payload), isQris(payload)
    convert.ts            # toDynamic()
  test/
    crc16.test.js  parse.test.js  build.test.js
    validate.test.js  convert.test.js
    vectors.js            # V1 + V2 (payload nyata, CRC terverifikasi)
  bin/qris.js
  examples/basic.mjs
  README.md  CHANGELOG.md  LICENSE (MIT)
```

Setiap file < 300 baris. Fungsi murni, tanpa state global (library murni —
"lima keranjang state" tidak berlaku: tidak ada state sama sekali; semua
input lewat argumen, semua output lewat return value).

## Alur data

```
parse:  string → tlv.decode (top-level) → pecah nested 26–51 & 62
        → validasi aturan (R3) → QrisPayload
build:  QrisBuildOptions → tlv.encode per field (urut kanonik)
        → + '6304' → crc16 → string
toDynamic: parse (strict) → build dari field hasil parse + amount
        (+ reference/fee, unknownTags ikut) → string
validate: try parse → sukses: { valid: true, payload }
        → QrisError: kumpulkan SEMUA error yang bisa dideteksi
          (bukan cuma yang pertama) → { valid: false, errors }
```

## Keputusan teknis penting

1. **Panjang = byte UTF-8, bukan karakter.** EMVCo menghitung panjang
   dalam byte. Untuk ASCII hasilnya sama; untuk nama bertanda (é, ñ)
   byte-length yang benar. Implementasi: `new TextEncoder().encode(v).length`.
2. **parse strict, validate lenient.** Data pembayaran tidak boleh
   "setengah benar": `parse` melempar di kesalahan pertama; `validate`
   mengumpulkan semua error untuk UX form.
3. **Round-trip byte-identik adalah test utama.** Kalau `build(parse(V))`
   tidak sama persis dengan `V`, ada yang salah di encoder — test ini
   menjaga kedua arah sekaligus.
4. **Provider map minimal & jujur.** Hanya 4 GUI yang terverifikasi dari
   vektor uji. GUI lain → `provider: null`. Tidak menebak.
5. **Unknown tags dipertahankan di parse dan ikut di toDynamic.**
   Tag 65–99 (RFU) tidak dibuang diam-diam.
6. **Amount sebagai string di output parse** (`amount: '100000'`) +
   `amountValue: number` — string menjaga presisi & format asli
   (`'100000.00'` tetap `'100000.00'`); number untuk hitung.
7. **Error berkode.** `QrisError.code` dari union literal
   (`BAD_CRC`, `TRUNCATED`, `MISSING_FIELD`, `STATIC_WITH_AMOUNT`,
   `DYNAMIC_WITHOUT_AMOUNT`, `INVALID_AMOUNT`, `INVALID_MCC`,
   `VALUE_TOO_LONG`, `NOT_STATIC`, `UNSUPPORTED_CURRENCY`,
   `UNSUPPORTED_COUNTRY`, `INVALID_PAYLOAD`) — konsumen bisa switch
   tanpa parse pesan.
8. **Urutan tag kanonik saat build**: 00, 01, 26–51, 52, 53, 54, 55, 56,
   57, 58, 59, 60, 61, 62, unknown (menaik), 63.

## Batas field (EMVCo/QRIS)

| Field | Tag | Batas |
|---|---|---|
| Merchant name | 59 | ≤ 25 karakter |
| Merchant city | 60 | ≤ 15 karakter |
| Postal code | 61 | ≤ 10 karakter |
| MCC | 52 | tepat 4 digit |
| Currency | 53 | `360` (IDR) |
| Country | 58 | `ID` |
| Amount | 54 | ≤ 13 karakter, format `^\d+(\.\d{1,2})?$`, > 0 |
| Nilai TLV | semua | ≤ 99 byte |

## Verifikasi

- `npm run build` → tsc dua target hijau.
- `npm test` → `node --test test/` (5 file, termasuk round-trip V1/V2 +
  CRC check-value).
- `npm run lint` → eslint + prettier check.
- `npm pack --dry-run` → isi tarball hanya `dist` + `bin` + README dkk.
- Install tarball di folder kosong → `require` + `import` jalan,
  `toDynamic` pada V1 menghasilkan payload valid.
- CLI: `node bin/qris.js dynamic <V1> 50000` → stdout lolos `validate`.
