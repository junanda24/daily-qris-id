/**
 * Known merchant-account GUI (sub-tag 00) → friendly provider name.
 *
 * Only GUIs verified against real published QRIS payloads are listed.
 * Unknown GUIs resolve to `null` — never guessed.
 *
 * Verified sources (public package documentation):
 * - 'ID.DANA.WWW' / 'ID.CO.QRIS.WWW' — Fulung Store sample (qris_parser)
 * - 'ID.CO.BNI.WWW' / 'ID.CO.QRIS.WWW' — VFS Global sample (flutter_qris)
 * - 'ID.CO.SHOPEE.WWW' — Baznas sample (qris)
 */
const KNOWN_PROVIDERS: Record<string, string> = {
  'ID.DANA.WWW': 'DANA',
  'ID.CO.BNI.WWW': 'BNI',
  'ID.CO.QRIS.WWW': 'QRIS',
  'ID.CO.SHOPEE.WWW': 'ShopeePay',
};

/** Friendly provider name for a GUI, or `null` when unknown. */
export function providerForGui(gui: string): string | null {
  return KNOWN_PROVIDERS[gui] ?? null;
}
