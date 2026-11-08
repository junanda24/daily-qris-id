import { QrisError } from './errors.js';

/**
 * Minimal TLV (Tag-Length-Value) codec for EMVCo Merchant-Presented Mode.
 *
 * Wire format: TTLLVVV... where TT is a 2-digit tag, LL is a 2-digit
 * decimal length counting UTF-8 *bytes* of the value, and VVV is the value.
 * Nested templates (tags 26–51 and 62) use the same encoding one level down.
 */

export interface TlvField {
  tag: string;
  value: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function byteLength(value: string): number {
  return encoder.encode(value).length;
}

/** Encode one field. Throws when the value exceeds 99 bytes. */
export function encodeField(tag: string, value: string): string {
  if (!/^\d{2}$/.test(tag)) {
    throw new QrisError('INVALID_TAG', `Tag must be two digits, got '${tag}'.`);
  }
  const length = byteLength(value);
  if (length > 99) {
    throw new QrisError(
      'VALUE_TOO_LONG',
      `Value of tag ${tag} is ${length} bytes, max is 99.`,
    );
  }
  return `${tag}${String(length).padStart(2, '0')}${value}`;
}

/** Encode a list of fields in the given order. */
export function encodeFields(fields: TlvField[]): string {
  return fields.map((field) => encodeField(field.tag, field.value)).join('');
}

/**
 * Decode a TLV string into fields. Throws `QrisError` (`TRUNCATED` /
 * `BAD_LENGTH` / `INVALID_TAG`) on malformed input.
 */
export function decodeFields(input: string): TlvField[] {
  if (typeof input !== 'string') {
    throw new QrisError('INVALID_PAYLOAD', 'Payload must be a string.');
  }

  const fields: TlvField[] = [];
  let offset = 0;

  while (offset < input.length) {
    if (offset + 4 > input.length) {
      throw new QrisError(
        'TRUNCATED',
        `Truncated TLV header at offset ${offset}.`,
      );
    }

    const tag = input.slice(offset, offset + 2);
    const lengthText = input.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) {
      throw new QrisError(
        'INVALID_TAG',
        `Invalid TLV header '${tag}${lengthText}' at offset ${offset}.`,
      );
    }

    const length = Number.parseInt(lengthText, 10);
    const valueStart = offset + 4;
    // Length counts UTF-8 bytes; walk char by char so multi-byte
    // characters are not split.
    let bytesSeen = 0;
    let valueEnd = valueStart;
    while (valueEnd < input.length && bytesSeen < length) {
      const char = input[valueEnd];
      bytesSeen += encoder.encode(char).length;
      valueEnd += 1;
    }
    if (bytesSeen !== length) {
      throw new QrisError(
        'BAD_LENGTH',
        `Tag ${tag} declares ${length} bytes but only ${bytesSeen} remain.`,
      );
    }

    const value = input.slice(valueStart, valueEnd);
    // Validate UTF-8 round-trip so a split multi-byte char is caught.
    if (decoder.decode(encoder.encode(value)) !== value) {
      throw new QrisError('BAD_LENGTH', `Tag ${tag} value is not valid UTF-8.`);
    }

    fields.push({ tag, value });
    offset = valueEnd;
  }

  return fields;
}
