#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Minimal canonicalization helpers (mirror lib/fieldIds.ts behavior)
function toDotKey(fieldId) {
  if (!fieldId) return fieldId;
  if (fieldId.includes('.')) return fieldId;
  return fieldId.replace(/[:_]+/g, '.');
}

function canonicalDot(fieldId) {
  if (!fieldId) return fieldId;
  return toDotKey(String(fieldId)).replace(/\.+/g, '.');
}

function parseDotKey(dotKey) {
  if (!dotKey) return { formId: '', fieldId: '' };
  const normalized = canonicalDot(dotKey);
  const idx = normalized.indexOf('.');
  if (idx === -1) return { formId: '', fieldId: normalized };
  const formId = normalized.slice(0, idx);
  const fieldId = normalized.slice(idx + 1);
  return { formId, fieldId };
}

function usage() {
  console.log('Usage: node scripts/migrateFieldIds.js --input <fields.json> [--dry-run] [--apply]');
}

// Minimal argv parsing to avoid extra dependencies
const rawArgs = process.argv.slice(2);
const argv = {};
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = rawArgs[i + 1];
    if (!next || next.startsWith('--')) {
      argv[key] = true;
    } else {
      argv[key] = next;
      i++;
    }
  } else if (a.startsWith('-')) {
    const key = a.slice(1);
    const next = rawArgs[i + 1];
    if (!next || next.startsWith('-')) {
      argv[key] = true;
    } else {
      argv[key] = next;
      i++;
    }
  }
}

const input = argv.input || argv.i || 'fields_export.json';
const dryRun = argv['dry-run'] !== undefined ? Boolean(argv['dry-run']) : true;
const apply = argv.apply === true || argv.a === true;

if (!fs.existsSync(path.resolve(input))) {
  console.error(`Input file not found: ${input}`);
  usage();
  process.exit(2);
}

const raw = fs.readFileSync(path.resolve(input), 'utf8');
let docs;
try {
  docs = JSON.parse(raw);
} catch (err) {
  console.error('Failed to parse input JSON:', err.message);
  process.exit(2);
}

if (!Array.isArray(docs)) {
  console.error('Input JSON must be an array of field documents');
  process.exit(2);
}

const mappings = [];
for (const doc of docs) {
  const oldForm = doc.formId || '';
  const oldField = doc.fieldId || '';
  const canonical = canonicalDot(oldField || (oldForm ? `${oldForm}.${oldField}` : ''));
  const parsed = parseDotKey(canonical);
  if (parsed.formId && parsed.formId !== oldForm) {
    mappings.push({ _id: doc._id, oldFormId: oldForm, oldFieldId: oldField, newFormId: parsed.formId, newFieldId: parsed.fieldId });
  }
}

const out = {
  inputFile: input,
  count: docs.length,
  proposedChanges: mappings.length,
  mappings,
};

const outPath = path.resolve('migrate_fieldids_report.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

console.log(`Dry-run complete. Total docs: ${docs.length}. Proposed changes: ${mappings.length}. Report written to ${outPath}`);

if (apply) {
  console.warn('Apply mode not implemented in this script. Use the report to perform changes with your Convex SDK or DB client after backup.');
}
