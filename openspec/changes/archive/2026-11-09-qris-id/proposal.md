# Proposal — qris-id (2026-11-09)

## Apa ini

`qris-id` — library TypeScript zero-dependency untuk **parse, build, validasi, dan
konversi payload QRIS** (Quick Response Code Indonesian Standard) mengikuti
spesifikasi EMVCo Merchant-Presented Mode (TLV + CRC-16/CCITT-FALSE).

Satu fungsi mengubah stiker QRIS statis warung menjadi payload dinamis
bernominal:

```ts
import { toDynamic } from 'qris-id';

const dinamis = toDynamic(stikerStatis, { amount: 50000, reference: 'INV-1001' });
// → string payload QRIS dinamis, CRC sudah dihitung ulang, siap jadi QR code
```

## Kenapa ide ini mengejutkan

- Stiker QRIS ada di **setiap warung, kantin, dan toko di Indonesia** — tapi
  isinya cuma string TLV yang bisa dibaca dan ditulis ulang dengan kode murni.
  Hampir tidak ada developer yang sadar payload itu bisa di-generate tanpa
  gateway, tanpa API key, tanpa server.
- Di npm, nama `qris` sudah diambil paket 0.0.1 tanpa test (repo marengga/qris,
  dicek 2026-11-09). Yang ada di registry hari ini adalah SDK gateway berbayar
  (Midtrans, Xendit-style, OrderKuota) — **tidak ada satu pun library
  standalone zero-dep khusus payload QRIS**. Yang ada cuma di ekosistem Dart
  (qris_parser, flutter_qris — parse saja) dan PHP (static→dynamic saja).
  `qris-id` mengisi celah itu di JavaScript/TypeScript.
- Efek "kok kepikiran": Junan sebagai programmer bisa menempel QRIS-nya
  sendiri, lalu dari string itu mencetak invoice dengan nominal berbeda-beda
  — tanpa daftar ke payment gateway mana pun.

## Kenapa bentuk output ini

- **npm package** (bukan web app): masalahnya adalah masalah developer —
  butuh API yang enak dipakai, bukan UI. Rotasi program juga menuntut variasi:
  2 hari terakhir adalah web app (LULUS SIM!, 11-07) dan game (WARKOP!,
  11-08); npm package terakhir 10-31 (kata-angka).
- **Tanpa backend**: payload QRIS adalah komputasi string murni (TLV + CRC).
  Backend tidak menambah apa-apa — justru merusak (butuh server untuk
  sesuatu yang bisa jalan di browser/HP offline).
- **Zero dependency, TypeScript, dual ESM+CJS**: supaya bisa dipakai di
  Node, browser, React Native, dan edge runtime tanpa tarik-menarik
  dependensi.

## Fitur

1. `parse(payload)` — parse lengkap: field top-level, nested merchant
   account info (tag 26–51: GUI, PAN, NMID, kriteria UMI/UME/UBE/RMI/RME),
   additional data (tag 62), unknown tags dipertahankan.
2. `build(options)` — bangun payload statis atau dinamis dari opsi ramah
   (nama toko, kota, MCC, nominal). CRC dihitung otomatis.
3. `toDynamic(staticPayload, { amount, reference?, fee? })` — konversi
   statis→dinamis, fitur yang paling dicari (jaga semua field merchant,
   hitung ulang CRC).
4. `validate(payload)` — validasi tidak melempar: daftar error terstruktur
   (CRC salah, statis bawa nominal, dinamis tanpa nominal, MCC salah,
   nama > 25 karakter, dsb).
5. `crc16(data)` — CRC-16/CCITT-FALSE terekspos (nilai uji standar
   `"123456789"` → `29B1`).
6. `isQris(payload)` — sniff cepat.
7. CLI kecil `qris` (bonus): `parse`, `validate`, `dynamic` dari terminal.
8. Provider map: GUI terverifikasi → nama ramah (`ID.DANA.WWW` → DANA,
   `ID.CO.SHOPEE.WWW` → ShopeePay, `ID.CO.BNI.WWW` → BNI,
   `ID.CO.QRIS.WWW` → QRIS). Hanya yang terverifikasi dari vektor uji;
   GUI tak dikenal → `null`, bukan tebakan.

## Bukti kebenaran (bukan klaim)

- Dua vektor payload QRIS **nyata dari dokumentasi publik** (pub.dev:
  `qris_parser`, `flutter_qris`) sudah diverifikasi CRC-nya sebelum build
  dengan implementasi CRC independen — keduanya VALID:
  - Fulung Store / DANA (Kota Palembang), CRC `7279` ✓
  - VFS Global / BNI (Jakarta Selatan), CRC `D7C5` ✓
- Vektor-vetkor itu menjadi test fixture: parse → field eksak, dan
  build dari field hasil parse → string byte-identik dengan aslinya.
- Aturan EMVCo yang dipakai diverifikasi dari sumber publik (EMVCo MPM:
  TLV 2-digit, panjang = byte UTF-8, urutan tag menaik, tag 63 = CRC atas
  payload + literal `6304`).

## Anti-AI-slop / IP check

- Copy README Bahasa Indonesia natural, tanpa emoji di label, tanpa klaim
  "resmi Bank Indonesia" — ini library komunitas, bukan produk BI.
- Tidak ada aset pihak ketiga, tidak ada sprite/karakter berlisensi.
  Nama "QRIS" adalah standar Bank Indonesia; pemakaian nama untuk
  interoperabilitas dicantumkan dengan atribusi di README.
- Tidak ada data inventaris: semua contoh payload berasal dari dokumentasi
  publik (bukan QRIS toko sungguhan milik orang — PAN/NMID di contoh adalah
  yang dipublikasikan penulis paket Dart tersebut sebagai contoh).

## Kepatuhan standar

- Kode ikut `CODE_STANDARDS.md` (ES modules, `const`, `===`, penamaan,
  file < 300 baris, tanpa `console.log` di library) dan `ARCHITECTURE.md`
  (library murni: fungsi murni tanpa state global; error terstruktur
  berkode, bukan throw string).
- ESLint (flat config, recommended) + Prettier di `npm run lint`.
- Tidak ada secret dalam bentuk apa pun; tidak ada `.env`.

## Yang sengaja TIDAK dibuat

- Tidak ada render QR code menjadi gambar — itu ranah library QR
  (`qrcode`, `qr`); `qris-id` mengembalikan string payload, pengguna bebas
  memilih renderer.
- Tidak ada pemindaian gambar QR — input adalah string hasil decode.
- Tidak ada integrasi gateway / cek status pembayaran — butuh API key dan
  akun merchant; di luar scope library payload.
- Tidak ada Consumer-Presented Mode (BER-TLV) — QRIS di Indonesia praktis
  selalu Merchant-Presented Mode.
