# Spec — qris-id

Capability: `qris-id` — parse, build, validate & convert QRIS payloads
(EMVCo Merchant-Presented Mode, TLV + CRC-16/CCITT-FALSE). Zero dependency,
TypeScript, Node ≥ 18, dual ESM + CJS, types included.

## Terminology

- **Payload**: string QRIS utuh, mis. `00020101021126...6304XXXX`.
- **TLV**: blok Tag (2 digit) + Length (2 digit, jumlah byte UTF-8 value) +
  Value.
- **Statis**: tag `01` = `11`, tanpa tag `54` (nominal).
- **Dinamis**: tag `01` = `12`, wajib ada tag `54` (nominal).
- **CRC**: tag `63`, 4 hex uppercase, CRC-16/CCITT-FALSE (poly `0x1021`,
  init `0xFFFF`) atas payload + literal `6304`.

## Requirements

### R1 — CRC-16/CCITT-FALSE

- **SHALL**: `crc16(data: string): string` mengembalikan 4 karakter hex
  uppercase dari CRC-16/CCITT-FALSE atas byte UTF-8 `data`.
- **WHEN** `crc16('123456789')` dipanggil **THEN** hasilnya `'29B1'`
  (nilai uji standar).
- **WHEN** `crc16('')` dipanggil **THEN** hasilnya `'FFFF'`.

### R2 — Parse payload valid

- **SHALL**: `parse(payload)` mengembalikan objek terstruktur dengan:
  `pointOfInitiation` (`static` | `dynamic`), `accounts[]` (tag, gui,
  provider ramah atau `null`, pan, merchantId/NMID, criteria, extra),
  `merchantCategoryCode`, `currency`, `amount` + `amountValue` (bila ada),
  tip (55/56/57), `countryCode`, `merchantName`, `merchantCity`,
  `postalCode`, `additionalData` (sub-tag 62), `crc`, `crcValid: true`,
  `unknownTags[]`.
- **WHEN** payload Fulung Store (vektor V1) di-parse **THEN** merchantName
  `'Fulung Store'`, merchantCity `'Kota Palembang'`, postalCode `'30111'`,
  MCC `'4814'`, currency `'360'`, countryCode `'ID'`, pointOfInitiation
  `'static'`, accounts[0].gui `'ID.DANA.WWW'`, provider `'DANA'`,
  pan `'936009153872583491'`, merchantId `'872583491'`, criteria `'UMI'`,
  accounts[1].gui `'ID.CO.QRIS.WWW'`, merchantId `'ID1025390504849'`,
  crc `'7279'`, crcValid `true`.
- **WHEN** payload VFS Global (vektor V2) di-parse **THEN** accounts[0].gui
  `'ID.CO.BNI.WWW'`, provider `'BNI'`, criteria `'UBE'`,
  additionalData.terminalLabel `'A01'`, MCC `'4722'`, crc `'D7C5'`,
  crcValid `true`.

### R3 — Parse menolak input rusak (strict)

- **SHALL**: `parse` melempar `QrisError` berkode (bukan string) untuk:
  payload kosong/bukan string, struktur TLV terpotong, length melewati
  akhir string, tag `00` bukan `'01'`, tag `01` bukan `'11'`/`'12'`,
  field wajib hilang (52/53/58/59/60), CRC tidak cocok, statis membawa
  tag `54`, dinamis tanpa tag `54`, currency bukan `'360'`, country bukan
  `'ID'`.
- **WHEN** satu karakter payload V1 diubah (CRC jadi tidak cocok)
  **THEN** `parse` melempar error kode `BAD_CRC`.
- **WHEN** payload dipotong di tengah **THEN** `parse` melempar error kode
  `TRUNCATED` atau `BAD_LENGTH`.

### R4 — Build payload

- **SHALL**: `build(options)` menghasilkan string payload valid (CRC benar,
  tag urut menaik, panjang = byte UTF-8) dari opsi ramah.
- **WHEN** `build` dipanggil dengan field hasil parse V1 **THEN** hasilnya
  byte-identik dengan string V1 asli.
- **WHEN** `build` dipanggil dengan field hasil parse V2 **THEN** hasilnya
  byte-identik dengan string V2 asli.
- **WHEN** `amount` diisi **THEN** hasilnya dinamis (`010212` + tag `54`);
  **WHEN** `amount` tidak diisi **THEN** hasilnya statis (`010211`, tanpa
  tag `54`).
- **WHEN** `merchantName` > 25 karakter atau `merchantCity` > 15 karakter
  **THEN** `build` melempar `QrisError` kode `VALUE_TOO_LONG`.
- **WHEN** `amount` ≤ 0, NaN, atau format desimal > 2 angka
  **THEN** `build` melempar `QrisError` kode `INVALID_AMOUNT`.
- **WHEN** `merchantCategoryCode` bukan 4 digit **THEN** `build` melempar
  `QrisError` kode `INVALID_MCC`.
- **SHALL**: `build` mendukung ≥ 2 merchant account (tag `26` lalu `51`
  bila tag tidak disebut eksplisit) dan `additionalData` (tag 62).

### R5 — Konversi statis → dinamis

- **SHALL**: `toDynamic(staticPayload, { amount, reference?, fee? })`
  mengembalikan payload dinamis: field merchant dipertahankan, tag `01`
  jadi `12`, tag `54` = nominal, `reference` masuk
  `additionalData.referenceLabel`, `fee` masuk tag 55/56/57, CRC dihitung
  ulang; unknown tags ikut terbawa.
- **WHEN** `toDynamic(V1, { amount: 50000 })` dipanggil **THEN** hasilnya
  ter-parse sebagai dinamis dengan `amountValue` `50000`, merchantName
  tetap `'Fulung Store'`, dan `crcValid` `true`.
- **WHEN** `toDynamic` dipanggil pada payload yang sudah dinamis
  **THEN** melempar `QrisError` kode `NOT_STATIC`.
- **WHEN** `fee: { type: 'percent', value: 2 }` dipakai **THEN** tag `55`
  = `'01'` dan tag `57` = `'2'`.

### R6 — Validasi tidak melempar

- **SHALL**: `validate(payload)` tidak pernah melempar untuk input string;
  mengembalikan `{ valid: boolean, errors: { code, message }[], payload? }`.
- **WHEN** payload valid **THEN** `valid` `true`, `errors` kosong,
  `payload` terisi.
- **WHEN** CRC salah **THEN** `valid` `false` dan ada error kode `BAD_CRC`.
- **WHEN** payload statis membawa tag `54` **THEN** ada error kode
  `STATIC_WITH_AMOUNT`.
- **WHEN** payload dinamis tanpa tag `54` **THEN** ada error kode
  `DYNAMIC_WITHOUT_AMOUNT`.

### R7 — Sniff cepat

- **SHALL**: `isQris(payload)` mengembalikan `true` hanya bila payload
  lolos `parse` (struktur + CRC); `false` untuk string lain tanpa melempar.

### R8 — Packaging & API

- **SHALL**: package `qris-id` v0.1.0, zero dependency runtime, entry
  ESM (`dist/esm/index.js`) + CJS (`dist/cjs/index.js`) + types
  (`.d.ts`), `exports` terdefinisi, `files` hanya `dist` + `bin`.
- **SHALL**: `npm test` hijau (Node built-in test runner, tanpa test
  framework eksternal); `npm run build` hijau; `npm run lint` hijau.
- **SHALL**: `npm pack --dry-run` sukses; install lokal dari tarball dan
  `require('qris-id')` + `import` keduanya jalan (diuji).
- **SHALL**: README berisi instalasi, contoh `parse`/`build`/`toDynamic`,
  tabel field, daftar error code, dan catatan "bukan produk resmi BI".

### R9 — CLI bonus

- **SHALL**: bin `qris` menyediakan `parse <payload>`, `validate
  <payload>`, `dynamic <payload> <amount> [--ref LABEL]`, dan `--help`;
  keluar dengan kode non-zero bila input tidak valid.
- **WHEN** `qris dynamic <V1> 50000` dijalankan **THEN** stdout berisi
  payload dinamis yang lolos `validate`.
