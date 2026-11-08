import { crc16 } from './crc16.js';
import { QrisError } from './errors.js';
import { parse } from './parse.js';
import { decodeFields } from './tlv.js';
import type {
  QrisErrorCode,
  QrisPayload,
  QrisValidation,
  QrisValidationError,
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

function error(code: QrisErrorCode, message: string): QrisValidationError {
  return { code, message };
}

function checkLength(
  errors: QrisValidationError[],
  value: string,
  max: number,
  label: string,
): void {
  if ([...value].length > max) {
    errors.push(
      error(
        'VALUE_TOO_LONG',
        `${label} is ${[...value].length} characters, max is ${max}.`,
      ),
    );
  }
}

/**
 * Validate a QRIS payload without throwing.
 * Collects every detectable problem (not just the first one) and returns
 * the parsed payload only when the input is fully valid.
 */
export function validate(payload: string): QrisValidation {
  if (typeof payload !== 'string' || payload.length === 0) {
    return {
      valid: false,
      errors: [error('INVALID_PAYLOAD', 'Payload must be a non-empty string.')],
    };
  }

  let fields;
  try {
    fields = decodeFields(payload);
  } catch (caught) {
    if (caught instanceof QrisError) {
      return { valid: false, errors: [error(caught.code, caught.message)] };
    }
    throw caught;
  }

  const errors: QrisValidationError[] = [];
  const byTag = new Map<string, string>();
  const seenSingletons = new Set<string>();
  let accountCount = 0;

  for (const field of fields) {
    if (SINGLETON_TAGS.includes(field.tag)) {
      if (seenSingletons.has(field.tag)) {
        errors.push(
          error('INVALID_PAYLOAD', `Duplicate tag ${field.tag} in payload.`),
        );
      }
      seenSingletons.add(field.tag);
      if (!byTag.has(field.tag)) {
        byTag.set(field.tag, field.value);
      }
    }
    const n = Number.parseInt(field.tag, 10);
    if (/^\d{2}$/.test(field.tag) && n >= 26 && n <= 51) {
      accountCount += 1;
      try {
        decodeFields(field.value);
      } catch (caught) {
        if (caught instanceof QrisError) {
          errors.push(
            error(
              caught.code,
              `Merchant account ${field.tag}: ${caught.message}`,
            ),
          );
        } else {
          throw caught;
        }
      }
    }
  }

  const format = byTag.get('00');
  if (format === undefined) {
    errors.push(
      error(
        'MISSING_FIELD',
        'Missing required field 00 (Payload Format Indicator).',
      ),
    );
  } else if (format !== '01') {
    errors.push(
      error(
        'INVALID_PAYLOAD',
        `Payload Format Indicator must be '01', got '${format}'.`,
      ),
    );
  }

  const initiation = byTag.get('01');
  if (initiation === undefined) {
    errors.push(
      error(
        'MISSING_FIELD',
        'Missing required field 01 (Point of Initiation Method).',
      ),
    );
  } else if (initiation !== '11' && initiation !== '12') {
    errors.push(
      error(
        'INVALID_PAYLOAD',
        `Point of Initiation must be '11' (static) or '12' (dynamic), got '${initiation}'.`,
      ),
    );
  }

  const mcc = byTag.get('52');
  if (mcc === undefined) {
    errors.push(
      error(
        'MISSING_FIELD',
        'Missing required field 52 (Merchant Category Code).',
      ),
    );
  } else if (!/^\d{4}$/.test(mcc)) {
    errors.push(
      error(
        'INVALID_MCC',
        `Merchant Category Code must be 4 digits, got '${mcc}'.`,
      ),
    );
  }

  const currency = byTag.get('53');
  if (currency === undefined) {
    errors.push(
      error(
        'MISSING_FIELD',
        'Missing required field 53 (Transaction Currency).',
      ),
    );
  } else if (currency !== '360') {
    errors.push(
      error(
        'UNSUPPORTED_CURRENCY',
        `QRIS currency must be '360' (IDR), got '${currency}'.`,
      ),
    );
  }

  const country = byTag.get('58');
  if (country === undefined) {
    errors.push(
      error('MISSING_FIELD', 'Missing required field 58 (Country Code).'),
    );
  } else if (country !== 'ID') {
    errors.push(
      error(
        'UNSUPPORTED_COUNTRY',
        `QRIS country code must be 'ID', got '${country}'.`,
      ),
    );
  }

  const name = byTag.get('59');
  if (name === undefined) {
    errors.push(
      error('MISSING_FIELD', 'Missing required field 59 (Merchant Name).'),
    );
  } else {
    checkLength(errors, name, 25, 'Merchant Name');
  }

  const city = byTag.get('60');
  if (city === undefined) {
    errors.push(
      error('MISSING_FIELD', 'Missing required field 60 (Merchant City).'),
    );
  } else {
    checkLength(errors, city, 15, 'Merchant City');
  }

  const postal = byTag.get('61');
  if (postal !== undefined) {
    checkLength(errors, postal, 10, 'Postal Code');
  }

  const amount = byTag.get('54');
  if (initiation === '11' && amount !== undefined) {
    errors.push(
      error(
        'STATIC_WITH_AMOUNT',
        'Static QRIS (tag 01 = 11) must not carry a transaction amount (tag 54).',
      ),
    );
  }
  if (initiation === '12' && amount === undefined) {
    errors.push(
      error(
        'DYNAMIC_WITHOUT_AMOUNT',
        'Dynamic QRIS (tag 01 = 12) must carry a transaction amount (tag 54).',
      ),
    );
  }
  if (amount !== undefined && !/^\d+(\.\d{1,2})?$/.test(amount)) {
    errors.push(
      error(
        'INVALID_AMOUNT',
        `Transaction amount '${amount}' is not a valid amount.`,
      ),
    );
  }

  if (accountCount === 0) {
    errors.push(
      error(
        'MISSING_FIELD',
        'Missing merchant account information (tag 26–51).',
      ),
    );
  }

  const additional = byTag.get('62');
  if (additional !== undefined) {
    try {
      decodeFields(additional);
    } catch (caught) {
      if (caught instanceof QrisError) {
        errors.push(
          error(caught.code, `Additional data (tag 62): ${caught.message}`),
        );
      } else {
        throw caught;
      }
    }
  }

  const crc = byTag.get('63');
  if (crc === undefined) {
    errors.push(error('MISSING_FIELD', 'Missing required field 63 (CRC).'));
  } else {
    if (fields[fields.length - 1].tag !== '63') {
      errors.push(
        error('INVALID_PAYLOAD', 'CRC (tag 63) must be the last field.'),
      );
    }
    if (!/^[0-9A-Fa-f]{4}$/.test(crc)) {
      errors.push(
        error('INVALID_PAYLOAD', `CRC must be 4 hex characters, got '${crc}'.`),
      );
    } else if (crc.toUpperCase() !== crc16(payload.slice(0, -4))) {
      errors.push(
        error(
          'BAD_CRC',
          `CRC mismatch: payload carries '${crc.toUpperCase()}' but computed '${crc16(payload.slice(0, -4))}'.`,
        ),
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // All checks passed — parse strictly to build the payload object.
  let parsed: QrisPayload;
  try {
    parsed = parse(payload);
  } catch (caught) {
    if (caught instanceof QrisError) {
      return { valid: false, errors: [error(caught.code, caught.message)] };
    }
    throw caught;
  }
  return { valid: true, errors: [], payload: parsed };
}

/**
 * Quick sniff: `true` only when the payload fully parses (structure + CRC).
 * Never throws.
 */
export function isQris(payload: string): boolean {
  try {
    parse(payload);
    return true;
  } catch {
    return false;
  }
}
