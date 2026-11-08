// Basic usage of qris-id. Run with: node examples/basic.mjs
import { parse, build, toDynamic, validate, crc16 } from '../dist/esm/index.js';

// A real static QRIS payload (sample from public package docs).
const STATIC_QRIS =
  '00020101021126570011ID.DANA.WWW011893600915387258349102098725834910303UMI51440014ID.CO.QRIS.WWW0215ID10253905048490303UMI5204481453033605802ID5912Fulung Store6014Kota Palembang61053011163047279';

// 1. Parse it.
const shop = parse(STATIC_QRIS);
console.log('Merchant:', shop.merchantName, '-', shop.merchantCity);
console.log(
  'Provider:',
  shop.accounts[0].provider,
  '| NMID:',
  shop.accounts[1].merchantId,
);

// 2. Turn the warung sticker into a dynamic payload for Rp 50.000.
const dynamic = toDynamic(STATIC_QRIS, {
  amount: 50000,
  reference: 'INV-1001',
});
console.log('\nDynamic payload:', dynamic);
console.log('Valid?', validate(dynamic).valid);

// 3. Build a fresh static payload from scratch.
const fresh = build({
  accounts: [{ gui: 'ID.CO.QRIS.WWW', merchantId: 'ID1020000000001' }],
  merchantCategoryCode: '5411',
  merchantName: 'Warung Kopi',
  merchantCity: 'Batam',
});
console.log('\nFresh static payload:', fresh);
console.log('Parsed back:', parse(fresh).merchantName);

// 4. CRC, exposed for your own tooling.
console.log('\ncrc16("123456789") =', crc16('123456789'), '(expect 29B1)');
