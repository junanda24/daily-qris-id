/**
 * Real QRIS payloads used as test fixtures.
 *
 * Both strings come from public package documentation (pub.dev) and their
 * CRCs were verified independently before the first build:
 * - V1 'Fulung Store' (DANA) — documented in `qris_parser`, CRC 7279.
 * - V2 'VFS Global' (BNI) — documented in `flutter_qris`, CRC D7C5.
 * They are sample payloads published by those package authors, not live
 * merchant codes.
 */
'use strict';

const V1_FULUNG_STORE =
  '00020101021126570011ID.DANA.WWW011893600915387258349102098725834910303UMI51440014ID.CO.QRIS.WWW0215ID10253905048490303UMI5204481453033605802ID5912Fulung Store6014Kota Palembang61053011163047279';

const V2_VFS_GLOBAL =
  '00020101021126590013ID.CO.BNI.WWW011893600009150305256502096102070790303UBE51440014ID.CO.QRIS.WWW0215ID20222337822690303UBE5204472253033605802ID5912VFS GLOBAL 66015JAKARTA SELATAN61051294062070703A016304D7C5';

module.exports = { V1_FULUNG_STORE, V2_VFS_GLOBAL };
