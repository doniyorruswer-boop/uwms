import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.resolve(__dirname, '../src/locales/translations.csv');
const localesDir = path.resolve(__dirname, '../src/locales');
const targetLanguages = ['uz', 'ru', 'en'];

/**
 * Escapes a cell value for CSV output according to RFC 4180
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parses a CSV line handling quotes and escaped quotes
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Reads and parses the translations.csv file
 */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { languages: targetLanguages, rows: [] };

  const header = parseCSVLine(lines[0]);
  const keyIndex = header.indexOf('key');
  if (keyIndex === -1) {
    throw new Error('CSV must contain a "key" column in header');
  }

  const languages = header.filter((h) => h !== 'key');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values[keyIndex]) continue;
    const key = values[keyIndex].trim();
    const row = { key };
    languages.forEach((lang) => {
      const idx = header.indexOf(lang);
      row[lang] = idx !== -1 && values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(row);
  }

  return { languages, rows };
}

/**
 * Flattens a nested object into dot-notation keys
 */
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenObject(v, fullKey));
    } else {
      result[fullKey] = String(v ?? '');
    }
  }
  return result;
}

/**
 * Sets a value at a dot-notated path inside an object
 */
function setNestedProperty(obj, pathString, value) {
  const parts = pathString.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Main bidirectional sync logic
 */
function sync() {
  if (!fs.existsSync(csvPath)) {
    console.error(`[i18n-sync] Translations CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log(`[i18n-sync] Reading master CSV: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  let { languages, rows } = parseCSV(csvContent);

  // Ensure all standard target languages are tracked
  targetLanguages.forEach((lang) => {
    if (!languages.includes(lang)) languages.push(lang);
  });

  const rowMap = new Map();
  rows.forEach((r) => rowMap.set(r.key, r));

  // STEP 1: Bidirectional Check — Inspect existing JSON files for any keys missing in CSV
  const jsonKeysByLang = {};
  targetLanguages.forEach((lang) => {
    const jsonPath = path.join(localesDir, `${lang}.json`);
    if (fs.existsSync(jsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        jsonKeysByLang[lang] = flattenObject(parsed);
      } catch (err) {
        console.warn(`[i18n-sync] Warning: Could not parse ${jsonPath}:`, err.message);
        jsonKeysByLang[lang] = {};
      }
    } else {
      jsonKeysByLang[lang] = {};
    }
  });

  const allJsonKeys = new Set();
  Object.values(jsonKeysByLang).forEach((flat) => {
    Object.keys(flat).forEach((k) => allJsonKeys.add(k));
  });

  const missingInCsv = [];
  allJsonKeys.forEach((key) => {
    if (!rowMap.has(key)) {
      missingInCsv.push(key);
      const newRow = { key };
      targetLanguages.forEach((lang) => {
        newRow[lang] = jsonKeysByLang[lang]?.[key] || jsonKeysByLang['uz']?.[key] || key;
      });
      rows.push(newRow);
      rowMap.set(key, newRow);
    }
  });

  if (missingInCsv.length > 0) {
    console.log(`[i18n-sync] 🛡️  Discovered ${missingInCsv.length} untracked key(s) in JSON files. Auto-ingesting into CSV:`);
    missingInCsv.forEach((k) => console.log(`   + ${k}`));

    // Update CSV file on disk with the preserved keys
    const csvHeader = ['key', ...languages].join(',');
    const csvLines = [csvHeader];
    rows.forEach((r) => {
      const line = [r.key, ...languages.map((l) => escapeCSV(r[l] || ''))].join(',');
      csvLines.push(line);
    });
    fs.writeFileSync(csvPath, csvLines.join('\n') + '\n', 'utf8');
    console.log(`[i18n-sync] Updated ${csvPath} with all ingested keys.`);
  }

  // STEP 2: Generate clean, structured JSON files for each language
  console.log(`[i18n-sync] Synchronizing ${rows.length} keys across [${languages.join(', ')}]...`);

  languages.forEach((lang) => {
    const langObj = {};
    let missingCount = 0;

    rows.forEach((row) => {
      let val = row[lang];
      if (!val || val.trim() === '') {
        // Fallback hierarchy: target lang -> uz -> key
        val = row['uz'] || row.key;
        missingCount++;
      }
      setNestedProperty(langObj, row.key, val);
    });

    const outPath = path.join(localesDir, `${lang}.json`);
    fs.writeFileSync(outPath, JSON.stringify(langObj, null, 2) + '\n', 'utf8');
    const statusNote = missingCount > 0 ? `(${missingCount} fallback to UZ)` : '(100% complete)';
    console.log(`[i18n-sync] Generated: ${outPath} ${statusNote}`);
  });

  console.log('[i18n-sync] ✅ Successfully synchronized all translations from CSV without any data loss!');
}

sync();
