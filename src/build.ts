import { crc16 } from './crc16.js';
import { QrisError } from './errors.js';
import { encodeField, encodeFields, type TlvField } from './tlv.js';
import type { QrisAdditionalDataInput, QrisBuildOptions } from './types.js';

const MAX_NAME = 25;
const MAX_CITY = 15;
const MAX_POSTAL = 10;
const MAX_AMOUNT_CHARS = 13;

const ADDITIONAL_DATA_ORDER: (keyof QrisAdditionalDataInput)[] = [
  'billNumber',
  'mobileNumber',
  'storeLabel',
  'loyaltyNumber',
  'referenceLabel',
  'customerLabel',
  'terminalLabel',
  'purpose',
  'additionalConsumerDataRequest',
];

const ADDITIONAL_DATA_TAGS: Record<string, string> = {
  billNumber: '01',
  mobileNumber: '02',
  storeLabel: '03',
  loyaltyNumber: '04',
  referenceLabel: '05',
  customerLabel: '06',
  terminalLabel: '07',
  purpose: '08',
  additionalConsumerDataRequest: '09',
};

function checkLength(value: string, max: number, label: string): void {
  if ([...value].length > max) {
    throw new QrisError(
      'VALUE_TOO_LONG',
      `${label} is ${[...value].length} characters, max is ${max}.`,
    );
  }
}

/**
 * Normalize an amount to its canonical wire form: digits with at most
 * 2 decimals, no leading zeros, at most 13 characters, greater than 0.
 */
function normalizeAmount(value: number | string, label: string): string {
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new QrisError(
        'INVALID_AMOUNT',
        `${label} must be a finite number.`,
      );
    }
    text = String(value);
  } else {
    text = value.trim();
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new QrisError(
      'INVALID_AMOUNT',
      `${label} '${text}' is not a valid amount (digits, at most 2 decimals).`,
    );
  }
  const [intPart, fracPart] = text.split('.');
  const normalizedInt = intPart.replace(/^0+(?=\d)/, '');
  const normalized =
    fracPart === undefined ? normalizedInt : `${normalizedInt}.${fracPart}`;
  if (normalized.length > MAX_AMOUNT_CHARS) {
    throw new QrisError(
      'INVALID_AMOUNT',
      `${label} '${text}' exceeds ${MAX_AMOUNT_CHARS} characters.`,
    );
  }
  if (Number.parseFloat(normalized) <= 0) {
    throw new QrisError('INVALID_AMOUNT', `${label} must be greater than 0.`);
  }
  return normalized;
}

function encodeAccountFields(options: QrisBuildOptions): TlvField[] {
  if (options.accounts.length === 0) {
    throw new QrisError(
      'MISSING_FIELD',
      'At least one merchant account is required.',
    );
  }

  const usedTags = new Set<string>();
  const defaultTags = ['26', '51', '27', '28', '29', '30'];
  let defaultIndex = 0;

  return options.accounts.map((account) => {
    let tag = account.tag;
    if (tag === undefined) {
      while (
        defaultIndex < defaultTags.length &&
        usedTags.has(defaultTags[defaultIndex])
      ) {
        defaultIndex += 1;
      }
      tag = defaultTags[defaultIndex] ?? '50';
      defaultIndex += 1;
    }
    if (!/^\d{2}$/.test(tag)) {
      throw new QrisError(
        'INVALID_TAG',
        `Account tag must be two digits, got '${tag}'.`,
      );
    }
    const n = Number.parseInt(tag, 10);
    if (n < 26 || n > 51) {
      throw new QrisError(
        'INVALID_TAG',
        `Merchant account tag must be 26–51, got '${tag}'.`,
      );
    }
    if (usedTags.has(tag)) {
      throw new QrisError(
        'INVALID_TAG',
        `Duplicate merchant account tag '${tag}'.`,
      );
    }
    usedTags.add(tag);

    if (account.gui === '') {
      throw new QrisError(
        'MISSING_FIELD',
        'Merchant account GUI (sub-tag 00) is required.',
      );
    }

    const subFields: TlvField[] = [{ tag: '00', value: account.gui }];
    if (account.pan !== undefined) {
      subFields.push({ tag: '01', value: account.pan });
    }
    if (account.merchantId !== undefined) {
      subFields.push({ tag: '02', value: account.merchantId });
    }
    if (account.criteria !== undefined) {
      subFields.push({ tag: '03', value: account.criteria });
    }
    if (account.extra !== undefined) {
      const extraTags = Object.keys(account.extra).sort();
      for (const extraTag of extraTags) {
        subFields.push({ tag: extraTag, value: account.extra[extraTag] });
      }
    }
    return { tag, value: encodeFields(subFields) };
  });
}

function encodeAdditionalData(
  input: QrisAdditionalDataInput,
): string | undefined {
  const subFields: TlvField[] = [];
  for (const key of ADDITIONAL_DATA_ORDER) {
    const value = input[key];
    if (typeof value === 'string') {
      subFields.push({ tag: ADDITIONAL_DATA_TAGS[key], value });
    }
  }
  if (input.extra !== undefined) {
    const extraTags = Object.keys(input.extra).sort();
    for (const extraTag of extraTags) {
      subFields.push({ tag: extraTag, value: input.extra[extraTag] });
    }
  }
  if (subFields.length === 0) {
    return undefined;
  }
  return encodeFields(subFields);
}

/**
 * Build a QRIS payload string from friendly options.
 * Present `amount` → dynamic (`010212` + tag 54); absent → static (`010211`).
 * The CRC (tag 63) is computed automatically.
 */
export function build(options: QrisBuildOptions): string {
  if (!/^\d{4}$/.test(options.merchantCategoryCode)) {
    throw new QrisError(
      'INVALID_MCC',
      `Merchant Category Code must be 4 digits, got '${options.merchantCategoryCode}'.`,
    );
  }
  if (options.merchantName === '') {
    throw new QrisError('MISSING_FIELD', 'Merchant Name is required.');
  }
  checkLength(options.merchantName, MAX_NAME, 'Merchant Name');
  if (options.merchantCity === '') {
    throw new QrisError('MISSING_FIELD', 'Merchant City is required.');
  }
  checkLength(options.merchantCity, MAX_CITY, 'Merchant City');
  if (options.postalCode !== undefined) {
    checkLength(options.postalCode, MAX_POSTAL, 'Postal Code');
  }

  const currency = options.currency ?? '360';
  if (currency !== '360') {
    throw new QrisError(
      'UNSUPPORTED_CURRENCY',
      `QRIS currency must be '360' (IDR), got '${currency}'.`,
    );
  }
  const countryCode = options.countryCode ?? 'ID';
  if (countryCode !== 'ID') {
    throw new QrisError(
      'UNSUPPORTED_COUNTRY',
      `QRIS country code must be 'ID', got '${countryCode}'.`,
    );
  }

  const isDynamic = options.amount !== undefined;
  const amount =
    options.amount === undefined
      ? undefined
      : normalizeAmount(options.amount, 'Transaction amount');

  let tipIndicator: string | undefined;
  let tipFixed: string | undefined;
  let tipPercent: string | undefined;
  if (options.tip !== undefined) {
    if (options.tip.type === 'fixed') {
      tipIndicator = '01';
      tipFixed = normalizeAmount(options.tip.value, 'Fixed tip');
    } else {
      tipIndicator = '02';
      tipPercent = normalizeAmount(options.tip.value, 'Tip percentage');
      if (Number.parseFloat(tipPercent) > 100) {
        throw new QrisError(
          'INVALID_AMOUNT',
          'Tip percentage must not exceed 100.',
        );
      }
    }
  }

  const fields: TlvField[] = [
    { tag: '00', value: '01' },
    { tag: '01', value: isDynamic ? '12' : '11' },
    ...encodeAccountFields(options),
    { tag: '52', value: options.merchantCategoryCode },
    { tag: '53', value: currency },
  ];
  if (amount !== undefined) {
    fields.push({ tag: '54', value: amount });
  }
  if (tipIndicator !== undefined) {
    fields.push({ tag: '55', value: tipIndicator });
  }
  if (tipFixed !== undefined) {
    fields.push({ tag: '56', value: tipFixed });
  }
  if (tipPercent !== undefined) {
    fields.push({ tag: '57', value: tipPercent });
  }
  fields.push(
    { tag: '58', value: countryCode },
    { tag: '59', value: options.merchantName },
    { tag: '60', value: options.merchantCity },
  );
  if (options.postalCode !== undefined) {
    fields.push({ tag: '61', value: options.postalCode });
  }
  if (options.additionalData !== undefined) {
    const additional = encodeAdditionalData(options.additionalData);
    if (additional !== undefined) {
      fields.push({ tag: '62', value: additional });
    }
  }
  if (options.extraTags !== undefined) {
    const sorted = [...options.extraTags].sort((a, b) =>
      a.tag.localeCompare(b.tag),
    );
    for (const extra of sorted) {
      if (!/^\d{2}$/.test(extra.tag)) {
        throw new QrisError(
          'INVALID_TAG',
          `Extra tag must be two digits, got '${extra.tag}'.`,
        );
      }
      const n = Number.parseInt(extra.tag, 10);
      if (n < 64 || n > 99) {
        throw new QrisError(
          'INVALID_TAG',
          `Extra tags must be 64–99 (RFU/unreserved), got '${extra.tag}'.`,
        );
      }
      fields.push({ tag: extra.tag, value: extra.value });
    }
  }

  const withoutCrc = encodeFields(fields);
  const crc = crc16(`${withoutCrc}6304`);
  return `${withoutCrc}${encodeField('63', crc)}`;
}
