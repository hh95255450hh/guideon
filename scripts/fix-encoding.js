#!/usr/bin/env node
/**
 * Fix mojibake in project files.
 *
 * Background: some HTML/JS files were edited in a tool that read UTF-8 bytes
 * as cp1256, then saved as UTF-8. Result: emojis and Arabic became garbled.
 * Example: "📊" → "ًں'ٹ", "عربي" → "ط¹ط±ط¨ظٹ".
 *
 * Reverse: re-encode the corrupted UTF-8 string as cp1256 bytes, then
 * decode those bytes as UTF-8.
 *
 * Usage: node scripts/fix-encoding.js
 */
const fs   = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const ROOT = path.join(__dirname, '..');

// Files most likely affected (HTML + bundled JS in public/). Skip node_modules.
const TARGETS = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(p);
    } else if (/\.(html|js|css|md|json|sql)$/i.test(entry.name)) {
      // Skip minified bundles to avoid breaking them
      if (/\.min\./i.test(entry.name)) continue;
      TARGETS.push(p);
    }
  }
}
walk(ROOT);

// Patterns that indicate mojibake (UTF-8 of cp1256-misread UTF-8)
// Common signals: doubled "ï" "ï¸" sequences, "ï¿½" replacement char, runs of
// Arabic-block code points adjacent to ASCII (e.g., "ط¹ط±ط¨ظٹ").
const MOJIBAKE_HINTS = [
  /[ï][؀-ۿ]/,                 // ï followed by Arabic = signal of corrupted emoji
  /[؀-ۿ]{2,}[ï"]/,            // Arabic glyphs adjacent to Latin diacritics
  /ًں[-ۿ]/,                  // Common emoji prefix
  /âœ"|âڈ|âœ…|â›"|â€¦|â¤|â­گ|â­"/,    // Specific corrupted emoji patterns
  /ط[؀-ۿ]ط[؀-ۿ]/,   // Arabic prefix doubled = Arabic word corrupted
];

function looksCorrupted(s) {
  return MOJIBAKE_HINTS.some(re => re.test(s));
}

function fixString(s) {
  // Encode as cp1256, decode as utf-8
  const bytes = iconv.encode(s, 'win1256');
  return iconv.decode(bytes, 'utf8');
}

let fixedCount = 0;
let skippedCount = 0;

for (const file of TARGETS) {
  const original = fs.readFileSync(file, 'utf8');
  if (!looksCorrupted(original)) {
    skippedCount++;
    continue;
  }

  const fixed = fixString(original);

  // Safety: ensure fix didn't introduce more replacement chars than it removed
  const origRepl = (original.match(/�/g) || []).length;
  const fixedRepl = (fixed.match(/�/g) || []).length;
  if (fixedRepl > origRepl + 10) {
    console.warn(`SKIP ${path.relative(ROOT, file)} — fix would introduce ${fixedRepl - origRepl} replacement chars`);
    skippedCount++;
    continue;
  }

  fs.writeFileSync(file, fixed, 'utf8');
  console.log(`✓ Fixed ${path.relative(ROOT, file)}`);
  fixedCount++;
}

console.log(`\nDone. Fixed: ${fixedCount}, Skipped: ${skippedCount}, Total scanned: ${TARGETS.length}`);
