import { crc16 } from './crc16.js';
import { QrisError } from './errors.js';
import { providerForGui } from './providers.js';
import { decodeFields, type TlvField } from './tlv.js';
import type {
  AdditionalData,
  MerchantAccountInfo,
  QrisPayload,
} from './types.js';

const SINGLETON_TAGS: readonly string[] = [
  '00',
  '01',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '59',
  '60',
  '61',
  '62',
  '63',
];

function isAccountTag(tag: string): boolean {
  const n = Number.parseInt(tag, 10);
  return /^\d{2}$/.test(tag) && n >= 26 && n <= 51;
}

function findField(fields: TlvField[], tag: string): TlvField | undefined {
  return fields.find((field) => field.tag === tag);
}

function requireField(
  fields: TlvField[],
  tag: string,
  label: string,
): TlvField {
  const field = findField(fields, tag);
  if (field === undefined) {
    throw new QrisError(
      'MISSING_FIELD',
      `Missing required field ${tag} (${label}).`,
    );
  }
  return field;
}

function parseAccount(tag: string, value: string): MerchantAccountInfo {
  const subFields = decodeFields(value);
  const account: MerchantAccountInfo = {
    tag,
    gui: '',
    provider: null,
    extra: {},
  };

  for (const sub of subFields) {
    if (sub.tag === '00') {
      account.gui = sub.value;
      account.provider = providerForGui(sub.value);
    } else if (sub.tag === '01') {
      account.pan = sub.value;
    } else if (sub.tag === '02') {
      account.merchantId = sub.value;
    } else if (sub.tag === '03') {
      // Merchant criteria — free string; known values include
      // UMI / UME / UBE / RMI / RME. Never reject an unknown one.
      account.criteria = sub.value;
    } else {
      account.extra[sub.tag] = sub.value;
    }
  }

  if (account.gui === '') {
    throw new QrisError(
      'MISSING_FIELD',
      `Merchant account ${tag} is missing sub-tag 00 (GUI).`,
    );
  }
  return account;
}

function parseAdditionalData(value: string): AdditionalData {
  const subFields = decodeFields(value);
  const data: AdditionalData = { extra: {} };

  for (const sub of subFields) {
    if (sub.tag === '01') {
      data.billNumber = sub.value;
    } else if (sub.tag === '02') {
      data.mobileNumber = sub.value;
    } else if (sub.tag === '03') {
      data.storeLabel = sub.value;
    } else if (sub.tag === '04') {
      data.loyaltyNumber = sub.value;
    } else if (sub.tag === '05') {
      data.referenceLabel = sub.value;
    } else if (sub.tag === '06') {
      data.customerLabel = sub.value;
    } else if (sub.tag === '07') {
      data.terminalLabel = sub.value;
    } else if (sub.tag === '08') {
      data.purpose = sub.value;
    } else if (sub.tag === '09') {
      data.additionalConsumerDataRequest = sub.value;
    } else {
      data.extra[sub.tag] = sub.value;
    }
  }
  return data;
}

function checkLength(value: string, max: number, label: string): void {
  if ([...value].length > max) {
    throw new QrisError(
      'VALUE_TOO_LONG',
      `${label} is ${[...value].length} characters, max is ${max}.`,
    );
  }
}

/**
 * Parse a QRIS payload string into a structured object.
 * Strict: throws `QrisError` on any structural or rule violation,
 * including a CRC mismatch. Use `validate` for a non-throwing check.
 */
export function parse(payload: string): QrisPayload {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new QrisError(
      'INVALID_PAYLOAD',
      'Payload must be a non-empty string.',
    );
  }

  const fields = decodeFields(payload);

  // No duplicate singleton tags.
  const seen = new Set<string>();
  for (const field of fields) {
    if (SINGLETON_TAGS.includes(field.tag)) {
      if (seen.has(field.tag)) {
        throw new QrisError(
          'INVALID_PAYLOAD',
          `Duplicate tag ${field.tag} in payload.`,
        );
      }
      seen.add(field.tag);
    }
  }

  const format = requireField(fields, '00', 'Payload Format Indicator');
  if (format.value !== '01') {
    throw new QrisError(
      'INVALID_PAYLOAD',
      `Payload Format Indicator must be '01', got '${format.value}'.`,
    );
  }

  const initiation = requireField(fields, '01', 'Point of Initiation Method');
  if (initiation.value !== '11' && initiation.value !== '12') {
    throw new QrisError(
      'INVALID_PAYLOAD',
      `Point of Initiation must be '11' (static) or '12' (dynamic), got '${initiation.value}'.`,
    );
  }
  const pointOfInitiation = initiation.value === '11' ? 'static' : 'dynamic';

  // CRC (tag 63) must be present, last, and correct.
  const crcField = requireField(fields, '63', 'CRC');
  if (fields[fields.length - 1].tag !== '63') {
    throw new QrisError(
      'INVALID_PAYLOAD',
      'CRC (tag 63) must be the last field.',
    );
  }
  if (!/^[0-9A-Fa-f]{4}$/.test(crcField.value)) {
    throw new QrisError(
      'INVALID_PAYLOAD',
      `CRC must be 4 hex characters, got '${crcField.value}'.`,
    );
  }
  const expectedCrc = crc16(payload.slice(0, -4));
  if (crcField.value.toUpperCase() !== expectedCrc) {
    throw new QrisError(
      'BAD_CRC',
      `CRC mismatch: payload carries '${crcField.value.toUpperCase()}' but computed '${expectedCrc}'.`,
    );
  }

  const mccField = requireField(fields, '52', 'Merchant Category Code');
  if (!/^\d{4}$/.test(mccField.value)) {
    throw new QrisError(
      'INVALID_MCC',
      `Merchant Category Code must be 4 digits, got '${mccField.value}'.`,
    );
  }

  const currencyField = requireField(fields, '53', 'Transaction Currency');
  if (currencyField.value !== '360') {
    throw new QrisError(
      'UNSUPPORTED_CURRENCY',
      `QRIS currency must be '360' (IDR), got '${currencyField.value}'.`,
    );
  }

  const countryField = requireField(fields, '58', 'Country Code');
  if (countryField.value !== 'ID') {
    throw new QrisError(
      'UNSUPPORTED_COUNTRY',
      `QRIS country code must be 'ID', got '${countryField.value}'.`,
    );
  }

  const nameField = requireField(fields, '59', 'Merchant Name');
  checkLength(nameField.value, 25, 'Merchant Name');

  const cityField = requireField(fields, '60', 'Merchant City');
  checkLength(cityField.value, 15, 'Merchant City');

  const postalField = findField(fields, '61');
  if (postalField !== undefined) {
    checkLength(postalField.value, 10, 'Postal Code');
  }

  const amountField = findField(fields, '54');
  if (pointOfInitiation === 'static' && amountField !== undefined) {
    throw new QrisError(
      'STATIC_WITH_AMOUNT',
      'Static QRIS (tag 01 = 11) must not carry a transaction amount (tag 54).',
    );
  }
  if (pointOfInitiation === 'dynamic' && amountField === undefined) {
    throw new QrisError(
      'DYNAMIC_WITHOUT_AMOUNT',
      'Dynamic QRIS (tag 01 = 12) must carry a transaction amount (tag 54).',
    );
  }

  let amount: string | undefined;
  let amountValue: number | undefined;
  if (amountField !== undefined) {
    if (!/^\d+(\.\d{1,2})?$/.test(amountField.value)) {
      throw new QrisError(
        'INVALID_AMOUNT',
        `Transaction amount '${amountField.value}' is not a valid amount.`,
      );
    }
    amount = amountField.value;
    amountValue = Number.parseFloat(amountField.value);
    if (!(amountValue > 0)) {
      throw new QrisError(
        'INVALID_AMOUNT',
        'Transaction amount must be greater than 0.',
      );
    }
  }

  const accounts: MerchantAccountInfo[] = [];
  const unknownTags: { tag: string; value: string }[] = [];
  for (const field of fields) {
    if (isAccountTag(field.tag)) {
      accounts.push(parseAccount(field.tag, field.value));
    }
  }
  if (accounts.length === 0) {
    throw new QrisError(
      'MISSING_FIELD',
      'Missing merchant account information (tag 26–51).',
    );
  }

  const additionalField = findField(fields, '62');
  const additionalData =
    additionalField === undefined
      ? undefined
      : parseAdditionalData(additionalField.value);

  for (const field of fields) {
    if (!SINGLETON_TAGS.includes(field.tag) && !isAccountTag(field.tag)) {
      unknownTags.push({ tag: field.tag, value: field.value });
    }
  }

  const result: QrisPayload = {
    raw: payload,
    pointOfInitiation,
    accounts,
    merchantCategoryCode: mccField.value,
    currency: currencyField.value,
    countryCode: countryField.value,
    merchantName: nameField.value,
    merchantCity: cityField.value,
    crc: crcField.value.toUpperCase(),
    crcValid: true,
    unknownTags,
  };
  if (amount !== undefined) {
    result.amount = amount;
  }
  if (amountValue !== undefined) {
    result.amountValue = amountValue;
  }
  const tipIndicator = findField(fields, '55');
  if (tipIndicator !== undefined) {
    result.tipIndicator = tipIndicator.value;
  }
  const tipFixed = findField(fields, '56');
  if (tipFixed !== undefined) {
    result.tipFixed = tipFixed.value;
  }
  const tipPercent = findField(fields, '57');
  if (tipPercent !== undefined) {
    result.tipPercent = tipPercent.value;
  }
  if (postalField !== undefined) {
    result.postalCode = postalField.value;
  }
  if (additionalData !== undefined) {
    result.additionalData = additionalData;
  }
  return result;
}
