# qris-id

Parse, build, validate, dan convert **payload QRIS** (Quick Response Code
Indonesian Standard) — string di balik stiker QRIS yang ada di setiap warung
Indonesia. Zero dependency, TypeScript, jalan di Node, browser, dan edge
runtime.

> Library komunitas, **bukan produk resmi Bank Indonesia**. Nama "QRIS"
> dipakai untuk interoperabilitas dengan standar nasional tersebut.

## Kenapa ini ada

Stiker QRIS statis di meja kasir itu isinya cuma string TLV — dan string itu
bisa dibaca, ditulis ulang, dan diubah jadi payload dinamis ber-nominal
**tanpa gateway, tanpa API key, tanpa server**. `qris-id` membungkus
spesifikasi EMVCo Merchant-Presented Mode (TLV + CRC-16/CCITT-FALSE) jadi
API yang enak dipakai:

```ts
import { toDynamic } from 'qris-id';

// Stiker statis warung → payload dinamis Rp 50.000, siap jadi QR code.
const dinamis = toDynamic(stikerStatis, {
  amount: 50000,
  reference: 'INV-1001',
});
```

Di npm, nama `qris` sudah dipakai paket 0.0.1 tanpa test; yang lain adalah
SDK gateway berbayar. `qris-id` adalah library standalone khusus payload —
parse, build, validasi, konversi — tanpa dependensi apa pun.

## Instalasi

Belum dipublish ke npm registry (keputusan ada di pemilik repo). Install
langsung dari GitHub:

```bash
npm i github:junanda24/daily-qris-id
```

Kalau nanti dipublish: `npm i qris-id` (nama sudah dicek tersedia di npm).

## Cara pakai

### Parse payload yang di-scan

```ts
import { parse } from 'qris-id';

const shop = parse(
  '00020101021126570011ID.DANA.WWW011893600915387258349102098725834910303UMI51440014ID.CO.QRIS.WWW0215ID10253905048490303UMI5204481453033605802ID5912Fulung Store6014Kota Palembang61053011163047279',
);

shop.merchantName; // 'Fulung Store'
shop.merchantCity; // 'Kota Palembang'
shop.postalCode; // '30111'
shop.merchantCategoryCode; // '4814'
shop.pointOfInitiation; // 'static'
shop.accounts[0].provider; // 'DANA'
shop.accounts[0].pan; // '936009153872583491'
shop.accounts[1].merchantId; // 'ID1025390504849' (NMID)
shop.crcValid; // true
```

`parse` itu strict: payload rusak (CRC salah, struktur terpotong, aturan
dilanggar) melempar `QrisError` dengan `code` yang bisa di-switch
(`BAD_CRC`, `TRUNCATED`, `STATIC_WITH_AMOUNT`, ...).

### Bangun payload dari nol

```ts
import { build } from 'qris-id';

// Statis (tanpa nominal) — stiker yang bisa dicetak.
const statis = build({
  accounts: [{ gui: 'ID.CO.QRIS.WWW', merchantId: 'ID1020000000001' }],
  merchantCategoryCode: '5411',
  merchantName: 'Warung Kopi',
  merchantCity: 'Batam',
});

// Dinamis — tinggal tambah amount.
const dinamis = build({
  accounts: [{ gui: 'ID.CO.QRIS.WWW', merchantId: 'ID1020000000001' }],
  merchantCategoryCode: '5411',
  merchantName: 'Warung Kopi',
  merchantCity: 'Batam',
  amount: 25000,
  additionalData: { referenceLabel: 'INV-1001' },
});
```

Akun kedua otomatis dapat tag `51` (tag pertama `26`); tag eksplisit bisa
diisi lewat `accounts[i].tag`.

### Statis → dinamis (fitur utama)

```ts
import { toDynamic } from 'qris-id';

const dinamis = toDynamic(stikerStatis, {
  amount: 50000,
  reference: 'INV-1001', // masuk additional data (tag 62, sub 05)
  fee: { type: 'percent', value: 2 }, // atau { type: 'fixed', value: 2000 }
});
```

Semua field merchant dipertahankan, CRC dihitung ulang, unknown tag ikut
terbawa. Melempar `NOT_STATIC` kalau input sudah dinamis.

### Validasi tanpa throw

```ts
import { validate, isQris } from 'qris-id';

validate(payload);
// { valid: true, errors: [], payload: {...} }

validate('000201010211...rusak');
// { valid: false, errors: [{ code: 'BAD_CRC', message: '...' }] }

isQris('hello'); // false
```

`validate` mengumpulkan **semua** masalah yang terdeteksi, bukan cuma yang
pertama — cocok untuk menampilkan error di form.

### CRC

```ts
import { crc16 } from 'qris-id';

crc16('123456789'); // '29B1' (nilai uji standar CRC-16/CCITT-FALSE)
```

## CLI

```bash
npx qris parse <payload>
npx qris validate <payload>
npx qris dynamic <payload> 50000 --ref INV-1001
npx qris dynamic <payload> 50000 --fee-percent 2
```

## API

| Fungsi                               | Keterangan                                                   |
| ------------------------------------ | ------------------------------------------------------------ |
| `parse(payload)`                     | Parse strict → `QrisPayload`, throw `QrisError` bila invalid |
| `build(options)`                     | Bangun payload statis/dinamis, CRC otomatis                  |
| `toDynamic(static, { amount, ... })` | Konversi statis → dinamis                                    |
| `validate(payload)`                  | `{ valid, errors[], payload? }`, tidak pernah throw          |
| `isQris(payload)`                    | `true` hanya bila payload lolos `parse`                      |
| `crc16(data)`                        | CRC-16/CCITT-FALSE, 4 hex uppercase                          |
| `QrisError`                          | Error dengan `.code` (lihat tabel di bawah)                  |

### Field `QrisPayload`

| Field                        | Tag      | Keterangan                                                                         |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `pointOfInitiation`          | 01       | `'static'` (11) / `'dynamic'` (12)                                                 |
| `accounts[]`                 | 26–51    | `gui`, `provider`, `pan`, `merchantId` (NMID), `criteria`, `extra`                 |
| `merchantCategoryCode`       | 52       | 4 digit                                                                            |
| `currency`                   | 53       | `'360'` (IDR)                                                                      |
| `amount` / `amountValue`     | 54       | Hanya dinamis; string asli + number                                                |
| `tipIndicator/Fixed/Percent` | 55/56/57 | Biaya tip/convenience                                                              |
| `countryCode`                | 58       | `'ID'`                                                                             |
| `merchantName`               | 59       | Maks 25 karakter                                                                   |
| `merchantCity`               | 60       | Maks 15 karakter                                                                   |
| `postalCode`                 | 61       | Maks 10 karakter                                                                   |
| `additionalData`             | 62       | `billNumber`, `mobileNumber`, `storeLabel`, `referenceLabel`, `terminalLabel`, ... |
| `crc` / `crcValid`           | 63       | CRC 4 hex + hasil verifikasi                                                       |
| `unknownTags[]`              | 64–99    | Tag di luar set yang dikenal, dipertahankan apa adanya                             |

### Error codes

| Code                       | Arti                                         |
| -------------------------- | -------------------------------------------- |
| `INVALID_PAYLOAD`          | Bukan string / format dasar salah            |
| `TRUNCATED` / `BAD_LENGTH` | TLV terpotong / panjang tidak konsisten      |
| `BAD_CRC`                  | CRC tidak cocok                              |
| `MISSING_FIELD`            | Field wajib hilang                           |
| `STATIC_WITH_AMOUNT`       | Statis membawa tag 54                        |
| `DYNAMIC_WITHOUT_AMOUNT`   | Dinamis tanpa tag 54                         |
| `INVALID_AMOUNT`           | Nominal ≤ 0 / format salah / > 13 karakter   |
| `INVALID_MCC`              | MCC bukan 4 digit                            |
| `VALUE_TOO_LONG`           | Nilai melewati batas (nama/kota/dll)         |
| `NOT_STATIC`               | `toDynamic` dipanggil pada payload dinamis   |
| `UNSUPPORTED_CURRENCY`     | Currency bukan `360`                         |
| `UNSUPPORTED_COUNTRY`      | Country bukan `ID`                           |
| `INVALID_TAG`              | Tag tidak valid / duplikat / di luar rentang |

## Aturan format yang dipakai

- TLV: tag 2 digit + length 2 digit + value. **Length = jumlah byte
  UTF-8**, bukan jumlah karakter (penting untuk nama beraksen).
- Tag urut menaik saat build; tag 63 (CRC) selalu terakhir.
- CRC = CRC-16/CCITT-FALSE (poly `0x1021`, init `0xFFFF`) atas payload +
  literal `6304`, ditulis 4 hex uppercase.
- Statis (`11`) tanpa tag 54; dinamis (`12`) wajib tag 54.
- Currency `360` (IDR), country `ID` — library ini khusus QRIS.

## Provider yang dikenali

Hanya GUI yang terverifikasi dari payload nyata yang dipetakan ke nama
ramah; sisanya `provider: null` (tidak ditebak):

| GUI                | Provider  |
| ------------------ | --------- |
| `ID.DANA.WWW`      | DANA      |
| `ID.CO.BNI.WWW`    | BNI       |
| `ID.CO.SHOPEE.WWW` | ShopeePay |
| `ID.CO.QRIS.WWW`   | QRIS      |

## Yang sengaja tidak dibuat

- **Render QR code jadi gambar** — itu ranah library QR (`qrcode`,
  `qr`); `qris-id` mengembalikan string payload.
- **Scan gambar QR** — input adalah string hasil decode.
- **Integrasi gateway / cek status pembayaran** — butuh API key dan akun
  merchant.
- **Consumer-Presented Mode (BER-TLV)** — QRIS di Indonesia praktis selalu
  Merchant-Presented Mode.

## Pengembangan

```bash
npm install
npm test        # build + 53 test (node:test, tanpa framework)
npm run lint    # eslint + prettier
npm run build   # tsc → dist/cjs + dist/esm
```

Struktur:

```
src/
  index.ts      # public API
  types.ts      # interface + error codes
  errors.ts     # QrisError
  crc16.ts      # CRC-16/CCITT-FALSE
  tlv.ts        # codec TLV + nested
  providers.ts  # map GUI → provider
  parse.ts      # parse strict
  build.ts      # build payload
  validate.ts   # validate + isQris
  convert.ts    # toDynamic
test/           # node:test; vectors.js = 2 payload QRIS nyata
bin/qris.js     # CLI
examples/basic.mjs
```

## Kebenaran data

Dua payload contoh di test adalah payload **nyata dari dokumentasi publik**
(paket Dart `qris_parser` dan `flutter_qris`) dan CRC-nya diverifikasi
independen sebelum build. Test round-trip membuktikan
`build(parse(V)) === V` byte-per-byte untuk keduanya.

## Lisensi

MIT. Dibuat 2026-11-09 sebagai bagian dari program "1 Hari 1 Project".
