import { build } from './build.js';
import { QrisError } from './errors.js';
import { parse } from './parse.js';
import type { QrisAdditionalDataInput, QrisBuildOptions } from './types.js';

/** Options for {@link toDynamic}. */
export interface ToDynamicOptions {
  /** Transaction amount (numbers formatted without grouping). */
  amount: number | string;
  /** Optional reference label, stored in additional data (tag 62, sub 05). */
  reference?: string;
  /** Optional tip / convenience fee. */
  fee?:
    | { type: 'fixed'; value: number | string }
    | { type: 'percent'; value: number | string };
}

/**
 * Convert a static QRIS payload into a dynamic one with a fixed amount.
 *
 * All merchant fields are preserved, tag 01 becomes '12', tag 54 is set,
 * and the CRC is recomputed. Unknown top-level tags are carried over.
 * Throws `QrisError` (`NOT_STATIC`) when the input is already dynamic.
 */
export function toDynamic(
  staticPayload: string,
  options: ToDynamicOptions,
): string {
  const parsed = parse(staticPayload);
  if (parsed.pointOfInitiation !== 'static') {
    throw new QrisError(
      'NOT_STATIC',
      'Only a static QRIS payload can be converted to dynamic.',
    );
  }

  let additionalData: QrisAdditionalDataInput | undefined;
  if (parsed.additionalData !== undefined || options.reference !== undefined) {
    additionalData = {
      ...(parsed.additionalData ?? { extra: {} }),
    };
    if (options.reference !== undefined) {
      additionalData.referenceLabel = options.reference;
    }
  }

  let tip: QrisBuildOptions['tip'];
  if (options.fee !== undefined) {
    tip = options.fee;
  } else if (parsed.tipIndicator === '01' && parsed.tipFixed !== undefined) {
    tip = { type: 'fixed', value: parsed.tipFixed };
  } else if (parsed.tipIndicator === '02' && parsed.tipPercent !== undefined) {
    tip = { type: 'percent', value: parsed.tipPercent };
  }

  return build({
    accounts: parsed.accounts.map((account) => ({
      tag: account.tag,
      gui: account.gui,
      pan: account.pan,
      merchantId: account.merchantId,
      criteria: account.criteria,
      extra: account.extra,
    })),
    merchantCategoryCode: parsed.merchantCategoryCode,
    merchantName: parsed.merchantName,
    merchantCity: parsed.merchantCity,
    postalCode: parsed.postalCode,
    amount: options.amount,
    tip,
    additionalData,
    extraTags: parsed.unknownTags,
  });
}
