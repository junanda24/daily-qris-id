#!/usr/bin/env node
'use strict';

/**
 * qris — tiny CLI for qris-id.
 *
 *   qris parse <payload>              print the parsed payload as JSON
 *   qris validate <payload>           print OK or the list of errors
 *   qris dynamic <payload> <amount> [--ref LABEL] [--fee-fixed N | --fee-percent N]
 *                                     convert a static payload to dynamic
 */

const {
  parse,
  validate,
  toDynamic,
  QrisError,
} = require('../dist/cjs/index.js');

function usage() {
  console.log(`qris — work with QRIS payloads

Usage:
  qris parse <payload>
  qris validate <payload>
  qris dynamic <payload> <amount> [--ref LABEL] [--fee-fixed N | --fee-percent N]

Examples:
  qris parse 00020101021126...
  qris dynamic 00020101021126... 50000 --ref INV-1001
`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function main(argv) {
  const [command, ...rest] = argv;

  if (command === undefined || command === '--help' || command === '-h') {
    usage();
    return;
  }

  if (command === 'parse') {
    const [payload] = rest;
    if (payload === undefined) {
      fail('Missing payload. Usage: qris parse <payload>');
    }
    try {
      const parsed = parse(payload);
      delete parsed.raw;
      console.log(JSON.stringify(parsed, null, 2));
    } catch (caught) {
      if (caught instanceof QrisError) {
        fail(`${caught.code}: ${caught.message}`);
      }
      throw caught;
    }
    return;
  }

  if (command === 'validate') {
    const [payload] = rest;
    if (payload === undefined) {
      fail('Missing payload. Usage: qris validate <payload>');
    }
    const result = validate(payload);
    if (result.valid) {
      console.log('OK — valid QRIS payload.');
      return;
    }
    console.error('Invalid QRIS payload:');
    for (const err of result.errors) {
      console.error(`  ${err.code}: ${err.message}`);
    }
    process.exit(1);
  }

  if (command === 'dynamic') {
    const [payload, amount, ...flags] = rest;
    if (payload === undefined || amount === undefined) {
      fail('Usage: qris dynamic <payload> <amount> [--ref LABEL]');
    }
    let reference;
    let fee;
    for (let i = 0; i < flags.length; i += 1) {
      if (flags[i] === '--ref' && flags[i + 1] !== undefined) {
        reference = flags[i + 1];
        i += 1;
      } else if (flags[i] === '--fee-fixed' && flags[i + 1] !== undefined) {
        fee = { type: 'fixed', value: flags[i + 1] };
        i += 1;
      } else if (flags[i] === '--fee-percent' && flags[i + 1] !== undefined) {
        fee = { type: 'percent', value: flags[i + 1] };
        i += 1;
      } else {
        fail(`Unknown flag '${flags[i]}'.`);
      }
    }
    try {
      console.log(toDynamic(payload, { amount, reference, fee }));
    } catch (caught) {
      if (caught instanceof QrisError) {
        fail(`${caught.code}: ${caught.message}`);
      }
      throw caught;
    }
    return;
  }

  fail(`Unknown command '${command}'. Run 'qris --help'.`);
}

main(process.argv.slice(2));
