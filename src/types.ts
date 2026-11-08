/**
 * Shared types for qris-id.
 * All text is plain ASCII/UTF-8; lengths in the QRIS wire format count
 * UTF-8 *bytes*, not characters.
 */

/** Static (`11`) or dynamic (`12`) point of initiation (tag 01). */
export type PointOfInitiation = 'static' | 'dynamic';

/** Merchant criteria (sub-tag 03 of merchant account info). */
export type MerchantCriteria = string;

/** One merchant account information template (tag 26–51). */
export interface MerchantAccountInfo {
  /** Top-level tag, e.g. '26' or '51'. */
  tag: string;
  /** Globally unique identifier (sub-tag 00), e.g. 'ID.DANA.WWW'. */
  gui: string;
  /** Friendly provider name for known GUIs, `null` when unknown. */
  provider: string | null;
  /** Payment network / merchant PAN (sub-tag 01). */
  pan?: string;
  /** Merchant ID / NMID (sub-tag 02). */
  merchantId?: string;
  /** Merchant criteria (sub-tag 03). Common values seen in the wild:
   *  'UMI' (usaha mikro), 'UME' (usaha menengah), 'UBE' (usaha besar),
   *  'RMI', 'RME'. Kept as a free string — new values must not break parsing. */
  criteria?: MerchantCriteria;
  /** Any other sub-tag, kept raw. */
  extra: Record<string, string>;
}

/** Additional data (tag 62) sub-fields. */
export interface AdditionalData {
  /** 01 — Bill number. */
  billNumber?: string;
  /** 02 — Mobile number. */
  mobileNumber?: string;
  /** 03 — Store label. */
  storeLabel?: string;
  /** 04 — Loyalty number. */
  loyaltyNumber?: string;
  /** 05 — Reference label. */
  referenceLabel?: string;
  /** 06 — Customer label. */
  customerLabel?: string;
  /** 07 — Terminal label. */
  terminalLabel?: string;
  /** 08 — Purpose of transaction. */
  purpose?: string;
  /** 09 — Additional consumer data request. */
  additionalConsumerDataRequest?: string;
  /** Any other sub-tag, kept raw. */
  extra: Record<string, string>;
}

/** A parsed QRIS payload. */
export interface QrisPayload {
  /** The exact input string. */
  raw: string;
  pointOfInitiation: PointOfInitiation;
  accounts: MerchantAccountInfo[];
  /** Merchant category code (tag 52), 4 digits. */
  merchantCategoryCode: string;
  /** Transaction currency (tag 53), '360' for IDR. */
  currency: string;
  /** Transaction amount as written (tag 54), present only on dynamic. */
  amount?: string;
  /** Transaction amount parsed as a number. */
  amountValue?: number;
  /** 55 — Tip / convenience fee indicator ('01' fixed, '02' percent). */
  tipIndicator?: string;
  /** 56 — Fixed tip / fee value. */
  tipFixed?: string;
  /** 57 — Tip / fee percentage. */
  tipPercent?: string;
  /** Country code (tag 58), 'ID'. */
  countryCode: string;
  /** Merchant name (tag 59), max 25 chars. */
  merchantName: string;
  /** Merchant city (tag 60), max 15 chars. */
  merchantCity: string;
  /** Postal code (tag 61). */
  postalCode?: string;
  /** Additional data (tag 62). */
  additionalData?: AdditionalData;
  /** CRC value from tag 63 (4 uppercase hex chars). */
  crc: string;
  /** Whether the embedded CRC matches the computed one. */
  crcValid: boolean;
  /** Top-level tags outside the known set, kept raw in order. */
  unknownTags: { tag: string; value: string }[];
}

/** Input for one merchant account when building a payload. */
export interface QrisAccountInput {
  /** Top-level tag. Defaults to '26' for the first account, '51' after. */
  tag?: string;
  /** Globally unique identifier (sub-tag 00), e.g. 'ID.DANA.WWW'. */
  gui: string;
  /** Payment network / merchant PAN (sub-tag 01). */
  pan?: string;
  /** Merchant ID / NMID (sub-tag 02). */
  merchantId?: string;
  /** Merchant criteria (sub-tag 03). Common values: 'UMI', 'UME', 'UBE',
   *  'RMI', 'RME'. */
  criteria?: MerchantCriteria;
  /** Any other sub-tag. */
  extra?: Record<string, string>;
}

/** Input for additional data (tag 62) when building a payload. */
export interface QrisAdditionalDataInput {
  billNumber?: string;
  mobileNumber?: string;
  storeLabel?: string;
  loyaltyNumber?: string;
  referenceLabel?: string;
  customerLabel?: string;
  terminalLabel?: string;
  purpose?: string;
  additionalConsumerDataRequest?: string;
  extra?: Record<string, string>;
}

/** Options for {@link build}. */
export interface QrisBuildOptions {
  /** At least one merchant account. */
  accounts: QrisAccountInput[];
  /** Merchant category code, exactly 4 digits. */
  merchantCategoryCode: string;
  /** Merchant name, max 25 chars. */
  merchantName: string;
  /** Merchant city, max 15 chars. */
  merchantCity: string;
  /** Postal code, max 10 chars. */
  postalCode?: string;
  /**
   * Transaction amount. When present the payload is dynamic (tag 01 = '12'
   * and tag 54 is set); when absent it is static (tag 01 = '11').
   * Numbers are formatted without grouping; at most 2 decimals.
   */
  amount?: number | string;
  /** Optional tip / convenience fee. */
  tip?:
    | { type: 'fixed'; value: number | string }
    | { type: 'percent'; value: number | string };
  /** Additional data (tag 62). */
  additionalData?: QrisAdditionalDataInput;
  /** Transaction currency, default '360' (IDR). */
  currency?: string;
  /** Country code, default 'ID'. */
  countryCode?: string;
  /** Extra top-level tags (65–99), emitted in ascending tag order. */
  extraTags?: { tag: string; value: string }[];
}

/** One validation problem, machine-readable via `code`. */
export interface QrisValidationError {
  code: QrisErrorCode;
  message: string;
}

/** Result of {@link validate}. Never throws for string input. */
export interface QrisValidation {
  valid: boolean;
  errors: QrisValidationError[];
  /** Parsed payload when the input is structurally sound. */
  payload?: QrisPayload;
}

/** Machine-readable error codes used by `QrisError` and `validate`. */
export type QrisErrorCode =
  | 'INVALID_PAYLOAD'
  | 'TRUNCATED'
  | 'BAD_LENGTH'
  | 'BAD_CRC'
  | 'MISSING_FIELD'
  | 'STATIC_WITH_AMOUNT'
  | 'DYNAMIC_WITHOUT_AMOUNT'
  | 'INVALID_AMOUNT'
  | 'INVALID_MCC'
  | 'VALUE_TOO_LONG'
  | 'NOT_STATIC'
  | 'UNSUPPORTED_CURRENCY'
  | 'UNSUPPORTED_COUNTRY'
  | 'INVALID_TAG';
