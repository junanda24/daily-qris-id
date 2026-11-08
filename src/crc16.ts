/**
 * CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF,
 * no reflection, no final XOR. Computed over UTF-8 bytes.
 *
 * Standard check value: crc16('123456789') === '29B1'.
 */
export function crc16(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let crc = 0xffff;

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}
